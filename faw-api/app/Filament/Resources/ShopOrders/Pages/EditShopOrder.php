<?php

namespace App\Filament\Resources\ShopOrders\Pages;

use App\Filament\Resources\ShopOrders\ShopOrderResource;
use App\Models\ShopOrder;
use App\Models\User;
use Filament\Actions\ViewAction;
use Filament\Resources\Pages\EditRecord;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Validation\ValidationException;

class EditShopOrder extends EditRecord
{
    protected static string $resource = ShopOrderResource::class;

    public function getTitle(): string
    {
        return 'Modifier la commande '.$this->getRecord()->number;
    }

    protected function getHeaderActions(): array
    {
        return [ViewAction::make()->label('Voir')];
    }

    protected function getRedirectUrl(): ?string
    {
        return static::getResource()::getUrl('view', ['record' => $this->getRecord()]);
    }

    /** Team notes are saved directly; a status change goes through ShopOrder::changeStatus (history + checks). */
    protected function handleRecordUpdate(Model $record, array $data): Model
    {
        /** @var ShopOrder $record */
        $status = isset($data['status']) ? (string) $data['status'] : null;
        unset($data['status']);
        $user = auth()->user();
        if ($status !== null && $status !== (string) $record->status) {
            try {
                $record->changeStatus($status, $user instanceof User ? $user : null);
            } catch (ValidationException $e) {
                throw ValidationException::withMessages(['data.status' => collect($e->errors())->flatten()->implode(' ; ')]);
            }
            $record->refresh();
        }
        if ($data !== []) {
            $record->update($data);
        }

        return $record;
    }
}
