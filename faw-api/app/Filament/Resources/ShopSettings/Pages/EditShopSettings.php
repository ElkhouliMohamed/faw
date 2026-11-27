<?php

namespace App\Filament\Resources\ShopSettings\Pages;

use App\Filament\Resources\ShopSettings\ShopSettingsResource;
use App\Models\SystemConfig;
use Filament\Resources\Pages\EditRecord;
use Filament\Schemas\Schema;
use Filament\Support\Components\Attributes\Unexposed;
use Illuminate\Contracts\Support\Htmlable;
use Illuminate\Database\Eloquent\Model;

/**
 * Single-record settings screen. Registered as the resource index (the
 * configuration row is opened directly, and created with its defaults if it is
 * missing) and as the regular edit route.
 */
class EditShopSettings extends EditRecord
{
    protected static string $resource = ShopSettingsResource::class;

    #[Unexposed]
    public function mount(int|string|null $record = null): void
    {
        parent::mount($record ?? ShopSettingsResource::singletonRecord()->getKey());
    }

    /** Read-only roles may open the screen; saving is checked separately. */
    protected function authorizeAccess(): void
    {
        abort_unless(ShopSettingsResource::canView($this->getRecord()), 403);
    }

    protected function canSaveConfig(): bool
    {
        return ShopSettingsResource::canEdit($this->getRecord());
    }

    #[Unexposed]
    public function form(Schema $schema): Schema
    {
        return parent::form($schema)->disabled(! $this->canSaveConfig());
    }

    /** Secrets are write-only: only non-secret values are sent to the browser. */
    protected function mutateFormDataBeforeFill(array $data): array
    {
        return ['fields' => $this->getRecord()->formValues()];
    }

    /** SystemConfig::saveForm() filters unknown keys, keeps blank secrets and forces disabled connectors off (audited by the model). */
    protected function handleRecordUpdate(Model $record, array $data): Model
    {
        abort_unless($this->canSaveConfig(), 403);
        /** @var SystemConfig $record */
        $record->saveForm($data['fields'] ?? []);

        return $record;
    }

    /** Clear any secret just typed so it never stays in the browser state. */
    protected function afterSave(): void
    {
        $this->fillForm();
    }

    protected function getHeaderActions(): array
    {
        return ShopSettingsResource::connectorActions();
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
        return ShopSettingsResource::definition()['label'];
    }

    public function getSubheading(): ?string
    {
        return $this->canSaveConfig() ? 'Modifiez les valeurs puis cliquez sur « Enregistrer ».' : 'Consultation seule : votre rôle ne permet pas de modifier cette configuration.';
    }

    #[Unexposed]
    public function getBreadcrumbs(): array
    {
        return [];
    }
}
