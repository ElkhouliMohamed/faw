<?php

namespace App\Filament\Pages;

use App\Filament\Pages\Concerns\HasKanbanBoard;
use App\Filament\Resources\Quotes\QuoteResource;
use App\Models\Quote;
use App\Services\EmailSettings;
use App\Services\QuoteService;
use Filament\Actions\Action;
use Filament\Notifications\Notification;
use Filament\Pages\Page;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Support\Facades\Cache;

/**
 * Quote pipeline board. Team steps are drag targets and open the same confirmations as the quote page
 * (validation = QuoteService::validate, sending = QuoteService::sendEmail, refusal with a reason).
 * Customer decisions (accepted, refused, change requested) come only from the customer portal.
 */
class QuotesKanban extends Page
{
    use HasKanbanBoard;

    /** Pipeline columns, in business order. */
    public const COLUMNS = [
        'a_valider' => 'À valider',
        'valide' => 'Validé (non envoyé)',
        'envoye' => 'Envoyé au client',
        'modification' => 'Modification demandée',
        'accepte' => 'Accepté par le client',
        'refuse' => 'Refusé',
    ];

    /** Columns the team can drop a card on (the others are customer decisions). */
    public const TEAM_TARGETS = ['valide', 'envoye', 'refuse'];

    protected static ?string $navigationLabel = 'Devis — Tableau';

    protected static ?string $title = 'Devis — Tableau';

    protected static ?string $slug = 'devis-tableau';

    protected static string|\UnitEnum|null $navigationGroup = 'Ventes';

    protected static ?int $navigationSort = 21;

    protected string $view = 'filament.kanban.board';

    public static function canAccess(): bool
    {
        return (bool) auth()->user()?->canDo('view.quotes');
    }

    public static function getNavigationBadge(): ?string
    {
        $n = Quote::where('status', 'à valider')->count() + Quote::whereIn('status', ['validé', 'envoyé'])->where('customerDecision', 'modification demandée')->count();

        return $n > 0 ? (string) $n : null;
    }

    public static function getNavigationBadgeColor(): ?string
    {
        return 'warning';
    }

    public static function getNavigationBadgeTooltip(): ?string
    {
        return 'Devis à valider ou à modifier';
    }

    public function getSubheading(): ?string
    {
        return 'Glissez un devis vers « Validé », « Envoyé » ou « Refusé » : la même confirmation que sur la fiche du devis s’ouvre. Les décisions du client arrivent automatiquement depuis son lien privé.';
    }

    /** @return array<string, string> */
    public function sources(): array
    {
        return [];
    }

    public function canMove(): bool
    {
        return (bool) $this->currentUser()?->canDo('validate.quotes');
    }

    public function hasPaymentFilter(): bool
    {
        return false;
    }

    /** @return array<string, string> */
    public function paymentOptions(): array
    {
        return [];
    }

    /** @return array<string, string> */
    public function cityOptions(): array
    {
        return Quote::query()->distinct()->orderBy('city')->pluck('city')->filter(fn ($c) => trim((string) $c) !== '')->mapWithKeys(fn ($c) => [$c => $c])->all();
    }

    public function listUrl(): string
    {
        return QuoteResource::getUrl();
    }

    public static function columnOf(Quote $q): string
    {
        return match (true) {
            $q->status === 'refusé' => 'refuse',
            $q->customerDecision === 'accepté' => 'accepte',
            $q->customerDecision === 'refusé' => 'refuse',
            $q->customerDecision === 'modification demandée' => 'modification',
            $q->status === 'envoyé' => 'envoye',
            $q->status === 'validé' => 'valide',
            default => 'a_valider',
        };
    }

    protected function scopeColumn(Builder $q, string $column): void
    {
        $undecided = fn (Builder $w) => $w->whereNull('customerDecision')->orWhereNotIn('customerDecision', ['accepté', 'refusé', 'modification demandée']);
        match ($column) {
            'refuse' => $q->where(fn (Builder $w) => $w->where('status', 'refusé')->orWhere('customerDecision', 'refusé')),
            'accepte' => $q->where('status', '!=', 'refusé')->where('customerDecision', 'accepté'),
            'modification' => $q->where('status', '!=', 'refusé')->where('customerDecision', 'modification demandée'),
            'envoye' => $q->where('status', 'envoyé')->where($undecided),
            'valide' => $q->where('status', 'validé')->where($undecided),
            default => $q->whereNotIn('status', ['refusé', 'envoyé', 'validé'])->where($undecided),
        };
    }

    protected function baseQuery(): Builder
    {
        $q = Quote::query();
        $this->applySearch($q, ['number', 'versionNumber', 'clientName', 'phone', 'email', 'city']);
        if ($this->city !== '') {
            $q->where('city', $this->city);
        }
        $this->applyDateRange($q, 'createdAt', ms: true);

        return $q;
    }

    public function board(): array
    {
        $canMove = $this->canMove();
        $colors = ['a_valider' => 'warning', 'valide' => 'info', 'envoye' => 'primary', 'modification' => 'warning', 'accepte' => 'success', 'refuse' => 'danger'];
        $columns = [];
        foreach (self::COLUMNS as $key => $label) {
            $query = $this->baseQuery();
            $this->scopeColumn($query, $key);
            $count = (clone $query)->count();
            $cards = $query->orderByDesc('createdAt')->limit(self::CARDS_PER_COLUMN)->get()->map(fn (Quote $q) => [
                'id' => (string) $q->getKey(),
                'title' => $q->versionNumber ?: ($q->number ?: 'Demande #'.$q->getKey()),
                'subtitle' => trim($q->clientName.($q->clientType && $q->clientType !== 'particulier' ? ' · '.$q->clientType : '')),
                'city' => (string) $q->city,
                'amount' => static::money($q->totalTtc),
                'meta' => $q->reviewReasons ? 'Revue : '.mb_strimwidth((string) $q->reviewReasons, 0, 60, '…') : ($q->email ? 'Email client renseigné' : 'Sans email client'),
                'age' => static::age($q->createdAt),
                'url' => QuoteResource::getUrl('view', ['record' => $q]),
                'locked' => ! in_array($key, ['a_valider', 'valide'], true),
            ])->all();
            $columns[] = ['key' => $key, 'label' => $label, 'color' => $colors[$key], 'count' => $count, 'droppable' => $canMove && in_array($key, self::TEAM_TARGETS, true), 'cards' => $cards];
        }

        return $columns;
    }

    /**
     * Drop handler: checks the pipeline step, then opens the same confirmation (and service call) as the quote page.
     * Validation and refusal keep their confirmation/reason, so a drag never changes a quote silently.
     */
    public function moveCard(string|int $id, string $to): void
    {
        abort_unless(static::canAccess(), 403);
        if (! $this->canMove()) {
            $this->notifyRefused('Seul un responsable habilité à valider les devis peut les déplacer.');

            return;
        }
        $q = Quote::find($id);
        if (! $q) {
            $this->notifyRefused('Devis introuvable.');

            return;
        }
        $from = static::columnOf($q);
        if ($from === $to) {
            return;
        }
        $error = match (true) {
            ! array_key_exists($to, self::COLUMNS) => 'Colonne inconnue.',
            ! in_array($to, self::TEAM_TARGETS, true) => 'Cette étape est une décision du client : elle se fait uniquement depuis son lien privé.',
            $to === 'valide' && $from !== 'a_valider' => 'Seul un devis « à valider » peut être validé.',
            $to === 'envoye' && $from !== 'valide' => 'Seul un devis validé peut être envoyé. Pour un nouvel envoi, utilisez « Renvoyer l’email » sur la fiche.',
            $to === 'envoye' && ! EmailSettings::ready() => 'Email automatique désactivé : SMTP / Resend non configuré.',
            $to === 'refuse' && ! in_array($from, ['a_valider', 'valide'], true) => 'Seul un devis à valider ou validé (non envoyé) peut être refusé.',
            default => null,
        };
        if ($error) {
            $this->notifyRefused($error);

            return;
        }
        $action = ['valide' => 'valider', 'envoye' => 'envoyer', 'refuse' => 'refuser'][$to];
        $this->mountAction($action, ['quote' => $q->getKey()]);
    }

    protected function boardQuote(array $arguments): ?Quote
    {
        return Quote::find($arguments['quote'] ?? 0);
    }

    public function validerAction(): Action
    {
        return QuoteResource::validateAction()->record(fn (array $arguments) => $this->boardQuote($arguments));
    }

    public function refuserAction(): Action
    {
        return QuoteResource::refuseAction()->record(fn (array $arguments) => $this->boardQuote($arguments))
            ->after(fn () => Notification::make()->title('Devis refusé')->success()->send());
    }

    /** First e-mail of a validated quote: same service call as the end of the validation. */
    public function envoyerAction(): Action
    {
        return Action::make('envoyer')->label('Envoyer au client')->requiresConfirmation()
            ->modalDescription('Envoie le PDF du devis au client par e-mail (pièce jointe, sans lien).')
            ->record(fn (array $arguments) => $this->boardQuote($arguments))
            ->visible(fn ($record) => auth()->user()?->canDo('validate.quotes') && $record?->status === 'validé' && EmailSettings::ready())
            ->action(function (Quote $record) {
                abort_unless(auth()->user()?->canDo('validate.quotes'), 403);
                try {
                    $message = Cache::lock('faw-quote-workflow', 120)->block(5, fn () => app(QuoteService::class)->sendEmail($record->fresh()));
                    Notification::make()->title($message)->success()->send();
                } catch (\Throwable $e) {
                    Notification::make()->title('Envoi impossible')->body($e->getMessage())->danger()->send();
                }
            });
    }
}
