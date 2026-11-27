<?php

namespace App\Filament\Resources\Quotes;

use App\Filament\Resources\OwnerResource;
use App\Models\Quote;
use App\Models\QuoteVersion;
use App\Services\EmailSettings;
use App\Services\QuoteService;
use App\Support\ResourceAccess;
use Filament\Actions\Action;
use Filament\Actions\ViewAction;
use Filament\Forms\Components\Hidden;
use Filament\Forms\Components\Repeater;
use Filament\Forms\Components\Select;
use Filament\Forms\Components\Textarea;
use Filament\Forms\Components\TextInput;
use Filament\Forms\Components\Toggle;
use Filament\Infolists\Components\TextEntry;
use Filament\Notifications\Notification;
use Filament\Schemas\Components\Section;
use Filament\Schemas\Components\Tabs;
use Filament\Schemas\Components\Tabs\Tab;
use Filament\Schemas\Schema;
use Filament\Tables\Columns\TextColumn;
use Filament\Tables\Filters\SelectFilter;
use Filament\Tables\Table;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\HtmlString;
use Illuminate\Validation\ValidationException;

class QuoteResource extends OwnerResource
{
    protected static ?string $model = Quote::class;

    protected static ?string $navigationLabel = 'Devis';

    protected static ?string $modelLabel = 'Devis';

    protected static ?string $pluralModelLabel = 'Devis';

    protected static string|\UnitEnum|null $navigationGroup = 'Ventes';

    protected static ?int $navigationSort = 20;

    public static function canCreate(): bool
    {
        return false;
    }

    public static function canDelete(Model $record): bool
    {
        return false;
    }

    public static function canEdit(Model $record): bool
    {
        return static::userCan(ResourceAccess::abilities(static::class)['view']);
    }

    public static function getNavigationBadge(): ?string
    {
        $n = Quote::where('status', 'à valider')->count();

        return $n > 0 ? (string) $n : null;
    }

    public static function getNavigationBadgeColor(): ?string
    {
        return 'warning';
    }

    public static function getNavigationBadgeTooltip(): ?string
    {
        return 'Demandes de devis à valider';
    }

    public static function statusColor(?string $status): string
    {
        return match ($status) {
            'à valider' => 'warning',
            'validé' => 'info',
            'envoyé' => 'primary',
            'refusé' => 'danger',
            default => 'gray',
        };
    }

    public static function decisionColor(?string $decision): string
    {
        return match ($decision) {
            'accepté' => 'success',
            'refusé' => 'danger',
            'modification demandée' => 'warning',
            default => 'gray',
        };
    }

    public static function infolist(Schema $schema): Schema
    {
        $dh = fn ($state) => $state === null || $state === '' ? '—' : number_format((float) $state, 0, ',', ' ').' DH TTC';

        return $schema->components([Tabs::make('devis')->tabs([
            Tab::make('Devis')->schema([
                Section::make('Demande')->schema([
                    TextEntry::make('status')->label('Statut')->badge()->color(fn ($state) => static::statusColor($state)),
                    TextEntry::make('customerDecision')->label('Décision du client')->badge()->color(fn ($state) => static::decisionColor($state))->placeholder('En attente'),
                    TextEntry::make('number')->label('Numéro réservé')->placeholder('Pas encore validé'),
                    TextEntry::make('versionNumber')->label('Version en cours')->placeholder('—'),
                    TextEntry::make('totalTtc')->label('Total TTC')->formatStateUsing($dh)->weight('bold'),
                    TextEntry::make('createdAt')->label('Reçue le')->dateTime('d/m/Y H:i', 'Africa/Casablanca'),
                ])->columns(['default' => 1, 'md' => 3]),
                Section::make('Client')->schema([
                    TextEntry::make('clientName')->label('Client'),
                    TextEntry::make('clientType')->label('Type')->placeholder('—'),
                    TextEntry::make('phone')->label('Téléphone')->copyable()->placeholder('—'),
                    TextEntry::make('email')->label('Email')->copyable()->placeholder('—'),
                    TextEntry::make('city')->label('Ville'),
                ])->columns(['default' => 1, 'md' => 3]),
                Section::make('Contenu')->schema([
                    TextEntry::make('line_details')->label('Articles')->state(fn (Quote $record) => collect(json_decode((string) $record->lines, true) ?: [])->map(fn ($l) => ($l['qty'] ?? '').' × '.($l['title'] ?? $l['id'] ?? '').' — '.($l['total'] ?? '').' DH TTC')->implode("\n"))->extraAttributes(['style' => 'white-space:pre-line'])->columnSpanFull(),
                    TextEntry::make('transport')->label('Transport')->placeholder('—')->columnSpanFull(),
                    TextEntry::make('note')->label('Note de demande (non modifiable)')->placeholder('—')->columnSpanFull(),
                    TextEntry::make('reviewReasons')->label('Validation bloquée')->placeholder('Aucun blocage')->color('danger')->columnSpanFull(),
                    TextEntry::make('cancelReason')->label('Motif du refus')->placeholder('—')->visible(fn (Quote $record) => $record->status === 'refusé')->columnSpanFull(),
                ]),
                Section::make('Lien privé et email')->schema([
                    TextEntry::make('link_state')->label('Lien privé client')->state(fn (Quote $record) => static::linkSummary($record))->helperText('Le lien n’est jamais stocké en clair. Pour le renvoyer au client : « Régénérer le lien ».'),
                    TextEntry::make('emailStatus')->label('État email')->placeholder('—')->helperText(fn () => EmailSettings::ready() ? 'Email automatique configuré' : 'Email automatique désactivé : SMTP / Resend non configuré'),
                ])->columns(['default' => 1, 'md' => 2]),
            ]),
            Tab::make('Versions')->badge(fn ($record) => $record ? (QuoteVersion::where('quote_id', $record->id)->count() ?: null) : null)->schema([TextEntry::make('versions_history')->hiddenLabel()->state(fn ($record) => $record ? static::versionsHtml($record) : '')->html()->columnSpanFull()]),
        ])->columnSpanFull()]);
    }

    public static function table(Table $table): Table
    {
        return $table->columns([
            TextColumn::make('id')->label('Demande')->sortable(),
            TextColumn::make('clientName')->label('Client')->searchable()->description(fn (Quote $record) => $record->city ?: null),
            TextColumn::make('status')->label('Statut')->badge()->color(fn ($state) => static::statusColor($state)),
            TextColumn::make('number')->label('Numéro'),
            TextColumn::make('versionNumber')->label('Version')->placeholder('—'),
            TextColumn::make('customerDecision')->label('Décision client')->badge()->color(fn ($state) => static::decisionColor($state))->placeholder('—'),
            TextColumn::make('totalTtc')->label('Total')->suffix(' DH TTC'),
            TextColumn::make('reviewReasons')->label('Revue équipe')->wrap()->limit(60)->toggleable(),
            TextColumn::make('createdAt')->label('Date')->dateTime('d/m/Y H:i', 'Africa/Casablanca')->sortable(),
        ])->defaultSort('createdAt', 'desc')
            ->filters([SelectFilter::make('status')->label('Statut')->options(['à valider' => 'À valider', 'validé' => 'Validé', 'envoyé' => 'Envoyé', 'refusé' => 'Refusé'])])
            ->recordActions([ViewAction::make()->label('Ouvrir'), ...static::workflowActions()]);
    }

    /** Workflow actions, shared by the list rows and the quote page header. @return list<Action> */
    public static function workflowActions(): array
    {
        return [static::validateAction(), static::pdfAction(), static::resendAction(), static::refuseAction(), static::newVersionAction(), static::revokeLinkAction(), static::regenerateLinkAction()];
    }

    public static function validateAction(): Action
    {
        return Action::make('valider')->label('Valider')->color('success')->icon('heroicon-o-check-badge')->requiresConfirmation()
            ->modalDescription('Réserve un numéro, génère le PDF et l’envoie au client par e-mail (pièce jointe, sans lien) si Resend est configuré.')
            ->visible(fn ($record) => auth()->user()?->canDo('validate.quotes') && $record?->status === 'à valider')
            ->action(function ($record) {
                abort_unless(auth()->user()?->canDo('validate.quotes'), 403);
                try {
                    $message = app(QuoteService::class)->validate($record);
                    Notification::make()->title($message)->success()->send();
                } catch (\Throwable $e) {
                    Notification::make()->title('Validation bloquée')->body($e instanceof ValidationException ? collect($e->errors())->flatten()->implode(' ; ') : $e->getMessage())->danger()->send();
                }
            });
    }

    public static function pdfAction(): Action
    {
        return Action::make('pdf')->label('PDF')->icon('heroicon-o-document-arrow-down')->color('gray')
            ->visible(fn ($record) => auth()->user()?->canDo('view.quotes') && in_array($record?->status, ['validé', 'envoyé']) && $record?->pdfFile)
            ->url(fn ($record) => $record ? route('admin.quote.pdf', $record) : null)->openUrlInNewTab();
    }

    public static function resendAction(): Action
    {
        return Action::make('renvoyer')->label('Renvoyer l’email')->icon('heroicon-o-paper-airplane')->requiresConfirmation()
            ->visible(fn ($record) => auth()->user()?->canDo('validate.quotes') && in_array($record?->status, ['validé', 'envoyé']))
            ->disabled(fn () => ! EmailSettings::ready())
            ->tooltip(fn () => EmailSettings::ready() ? '' : 'SMTP / Resend non configuré — email désactivé')
            ->action(function ($record) {
                abort_unless(auth()->user()?->canDo('validate.quotes'), 403);
                $message = Cache::lock('faw-quote-workflow', 120)->block(5, fn () => app(QuoteService::class)->sendEmail($record->fresh(), true));
                Notification::make()->title($message)->send();
            });
    }

    public static function refuseAction(): Action
    {
        return Action::make('refuser')->label('Refuser')->color('danger')->icon('heroicon-o-x-circle')->requiresConfirmation()
            ->modalDescription('Le devis passe au statut « refusé ». Le motif est conservé dans la fiche.')
            ->visible(fn ($record) => auth()->user()?->canDo('validate.quotes') && in_array($record?->status, ['à valider', 'validé']))
            ->schema([Textarea::make('reason')->label('Motif')->required()->maxLength(300)])
            ->action(function ($record, $data) {
                abort_unless(auth()->user()?->canDo('validate.quotes'), 403);
                $record->update(['status' => 'refusé', 'cancelReason' => $data['reason'], 'cancelledAt' => now()]);
            });
    }

    public static function versionsHtml(Quote $record): HtmlString
    {
        $versions = QuoteVersion::where('quote_id', $record->id)->with('emails')->orderByDesc('version')->get();
        if ($versions->isEmpty()) {
            return new HtmlString('<p>Aucune version émise : le devis n’est pas encore validé.</p>');
        }
        $e = fn ($v) => e((string) $v);
        $canPdf = (bool) auth()->user()?->canDo('view.quotes');
        $status = ['queued' => 'en file', 'sent' => 'envoyé', 'failed' => 'échec'];
        $rows = '';
        foreach ($versions as $v) {
            $mail = $status[$v->email_status] ?? 'non envoyé';
            if ($v->email_message_id) {
                $mail .= ' · id '.$e($v->email_message_id);
            }
            if ($v->email_status === 'failed' && $v->email_error) {
                $mail .= ' · '.$e($v->email_error);
            }
            $mail .= ' · '.$v->emails->count().' tentative(s)';
            $pdf = $canPdf ? '<a href="'.$e(route('admin.quote.version.pdf', [$record, $v->version])).'" target="_blank" rel="noopener noreferrer">'.$e($v->pdf_file).'</a>' : $e($v->pdf_file);
            $rows .= '<tr><td>'.$v->version.'</td><td><strong>'.$e($v->number).'</strong></td><td>'.$e($v->issued_at?->setTimezone('Africa/Casablanca')->format('d/m/Y H:i')).'</td><td>'.$e($v->total_ttc).' '.$e($v->currency).' TTC</td><td>'.$e($v->delivery['label'] ?? '').'</td><td>'.$e(\Carbon\Carbon::parse($v->valid_until)->format('d/m/Y')).'</td><td>'.$e($v->reason ?? '').'</td><td>'.$mail.'</td><td>'.$pdf.'</td></tr>';
        }

        $labels = ['accepted' => 'Acceptée', 'refused' => 'Refusée', 'modification_requested' => 'Modification demandée'];
        $decisions = \App\Models\QuoteDecision::where('quote_id', $record->id)->orderByDesc('id')->get();
        $dl = $decisions->map(fn ($d) => '<li>'.$e($d->created_at?->setTimezone('Africa/Casablanca')->format('d/m/Y H:i')).' — '.$e($labels[$d->decision] ?? $d->decision).' (version '.$e($d->version_number).')'.($d->message ? ' : '.$e($d->message) : '').($d->decision === 'accepted' ? ' · IP '.$e($d->ip).' · '.$e(mb_substr((string) $d->user_agent, 0, 80)) : '').'</li>')->implode('');
        $decisionsHtml = $dl !== '' ? '<h4 style="margin-top:16px;font-weight:600">Décisions du client (portail)</h4><ul style="font-size:13px">'.$dl.'</ul>' : '';

        return new HtmlString('<table class="faw-versions" style="width:100%;font-size:13px;border-collapse:collapse"><thead><tr style="text-align:left"><th>V.</th><th>Numéro</th><th>Émise le</th><th>Total</th><th>Livraison (hors total)</th><th>Valable jusqu’au</th><th>Motif</th><th>Email</th><th>PDF</th></tr></thead><tbody>'.$rows.'</tbody></table>'.$decisionsHtml);
    }

    public static function newVersionAction(): Action
    {
        return Action::make('nouvelleVersion')->label('Nouvelle version')
            ->modalDescription('Modifie les conditions commerciales d’un devis émis : crée la version suivante avec un nouveau PDF. Les versions précédentes et leurs PDF restent intacts. Aucun nouveau numéro n’est réservé.')
            ->visible(fn ($record) => auth()->user()?->canDo('validate.quotes') && in_array($record->status, ['validé', 'envoyé']) && $record->number && $record->pdfFile)
            ->fillForm(function (Quote $record) {
                $v = app(QuoteService::class)->ensureCurrentVersion($record);

                return [
                    'lines' => array_map(fn ($l) => ['position' => $l['position'], 'name' => $l['reference'].' — '.$l['name'], 'qty' => $l['qty'], 'unit_ttc' => $l['unit_ttc']], $v->lines),
                    'mode' => $v->delivery['mode'] ?? 'a_confirmer', 'ville' => $v->delivery['city'] ?? null, 'montant' => $v->delivery['amount_ttc'] ?? null, 'send' => true,
                ];
            })
            ->schema([
                Repeater::make('lines')->label('Lignes du devis')->schema([
                    Hidden::make('position'),
                    TextInput::make('name')->label('Article')->disabled()->dehydrated(false)->columnSpan(2),
                    TextInput::make('qty')->label('Quantité')->integer()->minValue(1)->maxValue(10000)->required(),
                    TextInput::make('unit_ttc')->label('Prix unitaire TTC (DH)')->integer()->minValue(1)->required(),
                ])->columns(4)->addable(false)->reorderable(false)->minItems(1),
                Select::make('mode')->label('Livraison (toujours hors total)')->options(['retrait' => 'Retrait au dépôt (gratuit)', 'option' => 'Livraison en option, hors total', 'a_confirmer' => 'Livraison à confirmer'])->required()->live(),
                TextInput::make('ville')->label('Ville')->maxLength(120),
                TextInput::make('montant')->label('Montant de la livraison en option (DH TTC)')->integer()->minValue(1)->visible(fn ($get) => $get('mode') === 'option'),
                Textarea::make('reason')->label('Motif du changement')->required()->maxLength(500),
                Toggle::make('send')->label('Envoyer cette version au client par e-mail (PDF en pièce jointe)')->default(true),
            ])
            ->action(function (Quote $record, array $data) {
                abort_unless(auth()->user()?->canDo('validate.quotes'), 403);
                try {
                    [, $message] = app(QuoteService::class)->createVersion($record, $data['lines'] ?? [], ['mode' => $data['mode'] ?? '', 'ville' => $data['ville'] ?? null, 'montant' => $data['montant'] ?? null], (string) ($data['reason'] ?? ''), (bool) ($data['send'] ?? false));
                    Notification::make()->title($message)->success()->send();
                } catch (\Throwable $e) {
                    Notification::make()->title('Nouvelle version bloquée')->body($e instanceof ValidationException ? collect($e->errors())->flatten()->implode(' ; ') : $e->getMessage())->danger()->send();
                }
            });
    }

    public static function linkSummary(Quote $record): string
    {
        $state = $record->linkState();
        $until = $record->tokenExpiresAt?->setTimezone('Africa/Casablanca')->format('d/m/Y H:i');

        return match ($state) {
            'actif' => 'Actif jusqu’au '.$until,
            'révoqué' => 'Révoqué le '.$record->tokenRevokedAt?->setTimezone('Africa/Casablanca')->format('d/m/Y H:i'),
            default => 'Expiré'.($until ? ' depuis le '.$until : ''),
        };
    }

    public static function revokeLinkAction(): Action
    {
        return Action::make('revoquerLien')->label('Révoquer le lien')->color('danger')->requiresConfirmation()
            ->modalDescription('Le lien privé envoyé au client cesse immédiatement de fonctionner (page de suivi et PDF).')
            ->visible(fn ($record) => auth()->user()?->canDo('validate.quotes') && $record->linkState() === 'actif')
            ->action(function (Quote $record) {
                abort_unless(auth()->user()?->canDo('validate.quotes'), 403);
                $record->revokeLink();
                Notification::make()->title('Lien révoqué')->success()->send();
            });
    }

    public static function regenerateLinkAction(): Action
    {
        return Action::make('regenererLien')->label('Régénérer le lien')->requiresConfirmation()
            ->modalDescription('Crée un nouveau lien privé. L’ancien lien cesse de fonctionner. Le nouveau lien n’est affiché qu’une seule fois.')
            ->visible(fn () => auth()->user()?->canDo('validate.quotes'))
            ->action(function (Quote $record) {
                abort_unless(auth()->user()?->canDo('validate.quotes'), 403);
                $raw = $record->regenerateLink();
                Notification::make()->title('Nouveau lien privé (affiché une seule fois)')
                    ->body(rtrim((string) config('faw.site_url'), '/').'/devis/suivi/'.$raw)
                    ->success()->persistent()->send();
            });
    }

    public static function getPages(): array
    {
        return [
            'index' => Pages\ListQuotes::route('/'),
            'view' => Pages\ViewQuote::route('/{record}'),
        ];
    }
}
