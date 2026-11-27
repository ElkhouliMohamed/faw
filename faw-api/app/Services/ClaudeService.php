<?php

namespace App\Services;

use App\Models\AuditEntry;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use RuntimeException;

class ClaudeService
{
    /** Claude Opus 5.5 (thinking is always on; effort controls depth). */
    public const MODEL = 'claude-opus-5-5';

    public static function apiKey(): ?string
    {
        $key = config('services.anthropic.key') ?: env('ANTHROPIC_API_KEY');
        return is_string($key) && filled($key) ? trim($key) : null;
    }

    public static function isConfigured(): bool
    {
        return self::apiKey() !== null;
    }

    /**
     * Rate limit: up to 10 AI requests per user per minute.
     */
    public static function checkRateLimit(int|string $userId): bool
    {
        $key = "claude_rate_limit:user:{$userId}";
        $hits = (int) Cache::get($key, 0);
        if ($hits >= 10) {
            return false;
        }
        Cache::put($key, $hits + 1, now()->addMinute());
        return true;
    }

    /**
     * Send prompt to Claude API. With $schema, the reply is constrained to valid JSON matching it.
     *
     * @param  array<string, mixed>|null  $schema  JSON Schema (objects need additionalProperties=false + required)
     */
    public static function complete(string $system, string $userPrompt, ?array $schema = null): string
    {
        $apiKey = self::apiKey();
        if (! $apiKey) {
            throw new RuntimeException('Clé API Claude (ANTHROPIC_API_KEY) non configurée.');
        }

        $userId = Auth::id() ?? 'system';
        if (! self::checkRateLimit($userId)) {
            throw new RuntimeException('Limite de requêtes atteinte. Veuillez patienter une minute avant de réessayer.');
        }

        // A long generation can exceed PHP's default 30 s execution limit.
        @set_time_limit(200);

        $outputConfig = ['effort' => 'medium'];
        if ($schema !== null) {
            $outputConfig['format'] = ['type' => 'json_schema', 'schema' => $schema];
        }

        $response = Http::withHeaders([
            'x-api-key' => $apiKey,
            'anthropic-version' => '2023-06-01',
            // Server-side fallback: if a safety classifier declines, the API retries on a suitable model.
            'anthropic-beta' => 'server-side-fallback-2026-07-01',
            'content-type' => 'application/json',
        ])->timeout(180)->post('https://api.anthropic.com/v1/messages', [
            'model' => self::MODEL,
            // Long FR + AR content: a low cap would cut the JSON mid-way.
            'max_tokens' => 16000,
            'output_config' => $outputConfig,
            'fallbacks' => 'default',
            'system' => $system,
            'messages' => [
                ['role' => 'user', 'content' => $userPrompt],
            ],
        ]);

        if ($response->failed()) {
            Log::error('Claude API Error', ['status' => $response->status(), 'body' => $response->body()]);
            throw new RuntimeException('Erreur de communication avec l’API Claude : ' . ($response->json('error.message') ?? $response->body()));
        }

        $stopReason = $response->json('stop_reason');
        if ($stopReason === 'refusal') {
            Log::warning('Claude API refusal', ['details' => $response->json('stop_details')]);
            throw new RuntimeException('L’IA a refusé de générer ce contenu. Reformulez les notes et réessayez.');
        }
        if ($stopReason === 'max_tokens') {
            throw new RuntimeException('La réponse de l’IA a été tronquée. Raccourcissez les notes ou générez en plusieurs fois.');
        }

        // Log audit usage
        if (class_exists(AuditEntry::class) && Auth::check()) {
            AuditEntry::record(
                entity: 'ClaudeAI',
                entityId: 'anthropic',
                action: 'generate',
                user: Auth::user(),
                changes: ['model' => $response->json('model') ?? self::MODEL]
            );
        }

        // Thinking blocks come first; take the text blocks only.
        $text = collect($response->json('content') ?? [])
            ->filter(fn ($block) => is_array($block) && ($block['type'] ?? null) === 'text')
            ->pluck('text')
            ->implode('');

        return trim($text);
    }

    /** JSON Schema for an object whose listed properties are all required strings. */
    private static function stringObjectSchema(array $keys, array $extra = []): array
    {
        $properties = array_fill_keys($keys, ['type' => 'string']) + $extra;

        return [
            'type' => 'object',
            'properties' => $properties,
            'required' => array_keys($properties),
            'additionalProperties' => false,
        ];
    }

    /**
     * Generate product marketing & SEO package (French and Arabic).
     *
     * @param array{title: string, notes?: string, category?: string} $input
     * @return array{shortDescription: string, description: string, seoTitle: string, seoDescription: string, title_ar: string, shortDescription_ar: string, description_ar: string, seoTitle_ar: string, seoDescription_ar: string, faq: array<int, array{q: string, a: string}>}
     */
    public static function generateProductPackage(array $input): array
    {
        $system = <<<PROMPT
Tu es un expert en e-commerce B2B, menuiserie aluminium, portes coupe-feu et matériel de sécurité au Maroc (Casablanca), travaillant pour FAW Aluminium.
Génère pour un produit les textes commerciaux en français et leur traduction en arabe.
Tu dois répondre STRICTEMENT en JSON valide avec la structure suivante (aucun markdown, aucune balise code) :
{
  "shortDescription": "Résumé accrocheur en 1-2 phrases (français)",
  "description": "Description technique et commerciale détaillée (français)",
  "seoTitle": "Titre SEO optimal < 60 caractères (français)",
  "seoDescription": "Description SEO < 160 caractères (français)",
  "title_ar": "Titre du produit en arabe",
  "shortDescription_ar": "Résumé court en arabe",
  "description_ar": "Description détaillée en arabe",
  "seoTitle_ar": "Titre SEO en arabe",
  "seoDescription_ar": "Description SEO en arabe",
  "faq": [
    {"q": "Question fréquente 1 ?", "a": "Réponse technique et précise 1."},
    {"q": "Question fréquente 2 ?", "a": "Réponse technique et précise 2."}
  ]
}
PROMPT;

        $userPrompt = "Produit: " . ($input['title'] ?? '') . "\n"
            . "Catégorie: " . ($input['category'] ?? '') . "\n"
            . "Notes et spécifications techniques: " . ($input['notes'] ?? 'Produit standard de haute qualité FAW.');

        $schema = self::stringObjectSchema(
            ['shortDescription', 'description', 'seoTitle', 'seoDescription', 'title_ar', 'shortDescription_ar', 'description_ar', 'seoTitle_ar', 'seoDescription_ar'],
            ['faq' => ['type' => 'array', 'items' => self::stringObjectSchema(['q', 'a'])]],
        );
        $text = self::complete($system, $userPrompt, $schema);
        $json = self::extractJson($text);

        return [
            'shortDescription' => (string) ($json['shortDescription'] ?? ''),
            'description' => (string) ($json['description'] ?? ''),
            'seoTitle' => (string) ($json['seoTitle'] ?? ''),
            'seoDescription' => (string) ($json['seoDescription'] ?? ''),
            'title_ar' => (string) ($json['title_ar'] ?? ''),
            'shortDescription_ar' => (string) ($json['shortDescription_ar'] ?? ''),
            'description_ar' => (string) ($json['description_ar'] ?? ''),
            'seoTitle_ar' => (string) ($json['seoTitle_ar'] ?? ''),
            'seoDescription_ar' => (string) ($json['seoDescription_ar'] ?? ''),
            'faq' => is_array($json['faq'] ?? null) ? $json['faq'] : [],
        ];
    }

    /**
     * Generate blog post from outline/notes (French and Arabic).
     *
     * @param array{title: string, outline?: string} $input
     * @return array{excerpt: string, bodyHtml: string, seoTitle: string, seoDescription: string, title_ar: string, excerpt_ar: string, bodyHtml_ar: string, seoTitle_ar: string, seoDescription_ar: string}
     */
    public static function generateBlogPost(array $input): array
    {
        $system = <<<PROMPT
Tu es un rédacteur professionnel spécialisé en sécurité incendie, normes de construction au Maroc et menuiserie aluminium pour le blog de FAW Aluminium à Casablanca.
Rédige un article de blog complet en français ainsi que son titre, extrait, contenu et SEO traduits en arabe.
Tu dois répondre STRICTEMENT en JSON valide avec la structure suivante (aucun markdown, aucune balise code) :
{
  "excerpt": "Introduction / chapeau captivant en français",
  "bodyHtml": "<p>Contenu complet en HTML propre avec <h2>, <p>, <ul>, <li></p>",
  "seoTitle": "Titre SEO optimal < 60 caractères (français)",
  "seoDescription": "Description SEO < 160 caractères (français)",
  "title_ar": "Titre de l'article en arabe",
  "excerpt_ar": "Chapeau de l'article en arabe",
  "bodyHtml_ar": "<p dir=\"rtl\">Contenu complet en arabe en HTML propre</p>",
  "seoTitle_ar": "Titre SEO en arabe",
  "seoDescription_ar": "Description SEO en arabe"
}
PROMPT;

        $userPrompt = "Titre de l'article: " . ($input['title'] ?? '') . "\n"
            . "Plan ou notes de cadrage: " . ($input['outline'] ?? 'Normes, conseils et bonnes pratiques pour les professionnels au Maroc.');

        $schema = self::stringObjectSchema(
            ['excerpt', 'bodyHtml', 'seoTitle', 'seoDescription', 'title_ar', 'excerpt_ar', 'bodyHtml_ar', 'seoTitle_ar', 'seoDescription_ar'],
        );
        $text = self::complete($system, $userPrompt, $schema);
        $json = self::extractJson($text);

        return [
            'excerpt' => (string) ($json['excerpt'] ?? ''),
            'bodyHtml' => (string) ($json['bodyHtml'] ?? ''),
            'seoTitle' => (string) ($json['seoTitle'] ?? ''),
            'seoDescription' => (string) ($json['seoDescription'] ?? ''),
            'title_ar' => (string) ($json['title_ar'] ?? ''),
            'excerpt_ar' => (string) ($json['excerpt_ar'] ?? ''),
            'bodyHtml_ar' => (string) ($json['bodyHtml_ar'] ?? ''),
            'seoTitle_ar' => (string) ($json['seoTitle_ar'] ?? ''),
            'seoDescription_ar' => (string) ($json['seoDescription_ar'] ?? ''),
        ];
    }

    private static function extractJson(string $text): array
    {
        $text = trim($text);
        if (str_starts_with($text, '```json')) {
            $text = substr($text, 7);
        }
        if (str_starts_with($text, '```')) {
            $text = substr($text, 3);
        }
        if (str_ends_with($text, '```')) {
            $text = substr($text, 0, -3);
        }
        $decoded = json_decode(trim($text), true);
        return is_array($decoded) ? $decoded : [];
    }
}
