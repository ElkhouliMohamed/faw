<?php

namespace App\Filament\Resources\Quotes;

use App\Filament\Resources\OwnerResource;
use App\Models\Quote;
use App\Models\QuoteVersion;
use App\Services\EmailSettings;
use App\Services\QuoteService;
use App\Support\ResourceAccess;
use Filament\Actions\Action;
use Filament\Actions\EditAction;
use Filament\Forms\Components\Hidden;
use Filament\Forms\Components\Repeater;
use Filament\Forms\Components\Select;
use Filament\Forms\Components\Textarea;
use Filament\Forms\Components\TextInput;
use Filament\Forms\Components\Toggle;
use Filament\Infolists\Components\TextEntry;
use Filament\Notifications\Notification;
use Filament\Schemas\Components\Tabs;
use Filament\Schemas\Components\Tabs\Tab;
use Filament\Schemas\Schema;
use Filament\Tables\Columns\TextColumn;
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

    public static function form(Schema $schema): Schema
    {
        return $schema->components([Tabs::make('devis')->tabs([Tab::make('Devis')->schema([TextInput::make('clientName')->label('Client')->maxLength(255)->disabled(), TextInput::make('phone')->label('Téléphone')->maxLength(255)->disabled(), TextInput::make('email')->label('Email')->maxLength(255)->disabled(), TextInput::make('city')->label('Ville')->maxLength(255)->disabled(), TextInput::make('status')->label('Statut')->maxLength(255)->disabled(), TextInput::make('number')->label('Numéro réservé')->maxLength(255)->disabled(), TextInput::make('totalTtc')->label('Total TTC (DH)')->maxLength(255)->disabled(), Textarea::make('reviewReasons')->label('Validation bloquée')->maxLength(5000)->columnSpanFull()->disabled(), Textarea::make('transport')->label('Transport')->maxLength(5000)->columnSpanFull()->disabled(), Textarea::make('note')->label('Note de demande (non modifiable)')->maxLength(5000)->columnSpanFull()->disabled(), Textarea::make('line_details')->label('Articles')->formatStateUsing(fn ($record) => $record ? collect(json_decode($record->lines, true))->map(fn ($l) => $l['qty'].' × '.($l['title'] ?? $l['id']).' — '.($l['total'] ?? '').' DH TTC')->implode("\n") : '')->disabled()->dehydrated(false)->columnSpanFull(), TextInput::make('link_state')->label('Lien privé client')->formatStateUsing(fn ($record) => $record ? static::linkSummary($record) : '')->helperText('Le lien n’est jamais stocké en clair. Pour le renvoyer au client : « Régénérer le lien ».')->disabled()->dehydrated(false)->columnSpanFull(), TextInput::make('emailStatus')->label('État email')->maxLength(255)->disabled()->helperText(EmailSettings::ready() ? 'Email automatique configuré' : 'Email automatique désactivé : SMTP / Resend non configuré')])->columns(2), Tab::make('Versions')->badge(fn ($record) => $record ? (QuoteVersion::where('quote_id', $record->id)->count() ?: null) : null)->schema([TextEntry::make('versions_history')->hiddenLabel()->state(fn ($record) => $record ? static::versionsHtml($record) : '')->html()->columnSpanFull()])])->columnSpanFull()]);
    }

    public static function table(Table $table): Table
    {
        return $table->columns([TextColumn::make('id')->label('Demande')->sortable(), TextColumn::make('clientName')->label('Client')->searchable(), TextColumn::make('status')->label('Statut')->badge(), TextColumn::make('number')->label('Numéro'), TextColumn::make('versionNumber')->label('Version')->placeholder('—'), TextColumn::make('customerDecision')->label('Décision client')->badge()->placeholder('—'), TextColumn::make('totalTtc')->label('Total')->suffix(' DH TTC'), TextColumn::make('reviewReasons')->label('Revue équipe')->wrap()->limit(60), TextColumn::make('createdAt')->label('Date')->dateTime('d/m/Y H:i')->sortable()])->defaultSort('createdAt', 'desc')->recordActions([EditAction::make()->label('Ouvrir'), Action::make('valider')->label('Valider')->color('success')->requiresConfirmation()->modalDescription('Réserve un numéro, génère le PDF et l’envoie au client par e-mail (pièce jointe, sans lien) si Resend est configuré.')->visible(fn ($record) => auth()->user()?->canDo('validate.quotes') && $record->status === 'à valider')->action(function ($record) {
            try {
                $message = app(QuoteService::class)->validate($record);
                Notification::make()->title($message)->success()->send();
            } catch (\Throwable $e) {
                Notification::make()->title('Validation bloquée')->body($e instanceof ValidationException ? collect($e->errors())->flatten()->implode(' ; ') : $e->getMessage())->danger()->send();
            }
        }), Action::make('pdf')->label('PDF')->visible(fn ($record) => auth()->user()?->canDo('view.quotes') && in_array($record->status, ['validé', 'envoyé']) && $record->pdfFile)->url(fn ($record) => route('admin.quote.pdf', $record))->openUrlInNewTab(), Action::make('renvoyer')->label('Renvoyer l’email')->requiresConfirmation()->visible(fn ($record) => auth()->user()?->canDo('validate.quotes') && in_array($record->status, ['validé', 'envoyé']))->disabled(fn () => ! EmailSettings::ready())->tooltip(fn () => EmailSettings::ready() ? '' : 'SMTP / Resend non configuré — email désactivé')->action(function ($record) {
            $message = Cache::lock('faw-quote-workflow', 120)->block(5, fn () => app(QuoteService::class)->sendEmail($record->fresh(), true));
            Notification::make()->title($message)->send();
        }), Action::make('refuser')->label('Refuser')->color('danger')->requiresConfirmation()->visible(fn ($record) => auth()->user()?->canDo('validate.quotes') && in_array($record->status, ['à valider', 'validé']))->schema([Textarea::make('reason')->label('Motif')->required()->maxLength(300)])->action(fn ($record, $data) => $record->update(['status' => 'refusé', 'cancelReason' => $data['reason'], 'cancelledAt' => now()])), static::newVersionAction(), static::revokeLinkAction(), static::regenerateLinkAction()]);
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
        return ['index' => Pages\ManageQuotes::route('/')];
    }
}
