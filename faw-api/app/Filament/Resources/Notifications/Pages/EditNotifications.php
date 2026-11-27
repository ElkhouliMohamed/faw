<?php

namespace App\Filament\Resources\Notifications\Pages;

use App\Filament\Resources\Notifications\NotificationsResource;
use App\Models\SystemConfig;
use Filament\Resources\Pages\EditRecord;
use Filament\Schemas\Schema;
use Filament\Support\Components\Attributes\Unexposed;
use Illuminate\Contracts\Support\Htmlable;
use Illuminate\Database\Eloquent\Model;

/**
 * Single-record settings screen for e-mail notifications (Resend / SMTP).
 * Registered as the resource index (the configuration row is opened directly,
 * and created with its defaults if it is missing) and as the regular edit route.
 */
class EditNotifications extends EditRecord
{
    protected static string $resource = NotificationsResource::class;

    #[Unexposed]
    public function mount(int|string|null $record = null): void
    {
        parent::mount($record ?? NotificationsResource::singletonRecord()->getKey());
    }

    /** Read-only roles may open the screen; saving is checked separately. */
    protected function authorizeAccess(): void
    {
        abort_unless(NotificationsResource::canView($this->getRecord()), 403);
    }

    protected function canSaveConfig(): bool
    {
        return NotificationsResource::canEdit($this->getRecord());
    }

    #[Unexposed]
    public function form(Schema $schema): Schema
    {
        return parent::form($schema)->disabled(! $this->canSaveConfig());
    }

    /** Secrets (Resend key, SMTP password) are write-only: only non-secret values are sent to the browser. */
    protected function mutateFormDataBeforeFill(array $data): array
    {
        return ['fields' => $this->getRecord()->formValues()];
    }

    /** SystemConfig::saveForm() filters unknown keys and keeps blank secrets (audited by the model). */
    protected function handleRecordUpdate(Model $record, array $data): Model
    {
        abort_unless($this->canSaveConfig(), 403);
        /** @var SystemConfig $record */
        $record->saveForm($data['fields'] ?? []);

        return $record;
    }

    /** Clear typed-in secrets from the Livewire state after saving (same as the other config pages). */
    protected function afterSave(): void
    {
        $this->fillForm();
    }

    protected function getHeaderActions(): array
    {
        return NotificationsResource::connectorActions();
    }

    protected function getFormActions(): array
    {
        return $this->canSaveConfig() ? [$this->getSaveFormAction()->label('Enregistrer')] : [];
    }

    protected function getSavedNotificationTitle(): ?string
    {
        return 'Configuration enregistrée';
    }

    #[Unexposed]
    public function getTitle(): string|Htmlable
    {
        return NotificationsResource::definition()['label'];
    }

    public function getSubheading(): ?string
    {
        return $this->canSaveConfig()
            ? 'Expéditeur, coordonnées affichées dans les e-mails et transport (Resend ou SMTP). Modifiez les valeurs puis cliquez sur « Enregistrer ».'
            : 'Consultation seule : votre rôle ne permet pas de modifier cette configuration.';
    }

    #[Unexposed]
    public function getBreadcrumbs(): array
    {
        return [];
    }
}
