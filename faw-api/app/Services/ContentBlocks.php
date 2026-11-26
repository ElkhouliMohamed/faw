<?php

namespace App\Services;

use Illuminate\Support\Facades\Validator;
use Illuminate\Validation\ValidationException;

class ContentBlocks
{
    public static function normalize(mixed $raw): array
    {
        $blocks = is_string($raw) ? json_decode($raw, true) : $raw;
        if (! is_array($blocks) || count($blocks) > 30) {
            throw ValidationException::withMessages(['blocks' => 'Maximum 30 sections.']);
        }
        $out = [];
        foreach ($blocks as $block) {
            $keys = match ($block['type'] ?? '') {
                'hero' => ['title', 'subtitle', 'ctaLabel', 'ctaUrl', 'image'],'products' => ['title', 'ids'],'text' => ['title', 'body'],'faq' => ['title', 'items'],'cta' => ['title', 'text', 'label', 'url'],default => null
            };
            if (! $keys) {
                throw ValidationException::withMessages(['blocks' => 'Type de section invalide.']);
            }
            $b = ['type' => $block['type']];
            foreach ($keys as $key) {
                $b[$key] = in_array($key, ['ids', 'items']) ? array_values($block[$key] ?? []) : (string) ($block[$key] ?? '');
            }
            $rules = ['title' => 'string|max:120', 'subtitle' => 'string|max:300', 'body' => 'string|max:8000', 'text' => 'string|max:400', 'ctaLabel' => 'string|max:40', 'label' => 'string|max:40', 'ids' => 'array|max:24', 'ids.*' => 'string|max:40', 'items' => 'array|max:30', 'items.*.q' => 'required|string|max:200', 'items.*.a' => 'required|string|max:1500'];
            foreach (['url', 'ctaUrl'] as $key) {
                $rules[$key] = ['nullable', 'string', 'max:500', 'regex:#^/(?!/)[^<>\\\\]*$#'];
            }
            $rules['image'] = ['nullable', 'string', 'max:500', 'regex:#^/(?:images|storage)/[a-zA-Z0-9_./-]+\\.(?:png|jpe?g|webp|gif|avif)$#i'];
            if (in_array($b['type'], ['hero', 'cta'])) {
                $rules['title'] = 'required|string|max:120';
            }
            if ($b['type'] === 'cta') {
                $rules['label'] = 'required|string|max:40';
                $rules['url'][0] = 'required';
            }
            if ($b['type'] === 'text') {
                $rules['body'] = 'required|string|max:8000';
            }
            Validator::make($b, $rules)->validate();
            $out[] = $b;
        }

        return $out;
    }
}
