<?php

namespace App\Filament\Resources\Products\Pages;

use App\Filament\Resources\Products\ProductResource;
use App\Services\ClaudeService;
use Filament\Actions\Action;
use Filament\Actions\DeleteAction;
use Filament\Forms\Components\Textarea;
use Filament\Forms\Components\TextInput;
use Filament\Notifications\Notification;
use Filament\Resources\Pages\EditRecord;
use Throwable;

class EditProduct extends EditRecord
{
    protected static string $resource = ProductResource::class;

    protected function getHeaderActions(): array
    {
        return [
            Action::make('generateAi')
                ->label('Générer avec l’IA')
                ->icon('heroicon-o-sparkles')
                ->color('primary')
                ->visible(fn () => ClaudeService::isConfigured())
                ->form([
                    TextInput::make('notes')
                        ->label('Notes / spécifications rapides')
                        ->placeholder('Ex: Porte 1 vantail EI60 90x212.5 cm, norme marocaine, acier galva')
                        ->required(),
                ])
                ->action(function (array $data) {
                    $product = $this->getRecord();
                    try {
                        $result = ClaudeService::generateProductPackage([
                            'title' => (string) $product->title,
                            'category' => (string) $product->category,
                            'notes' => (string) ($data['notes'] ?? ''),
                        ]);

                        $this->form->fill([
                            ...$this->form->getState(),
                            'shortDescription' => $result['shortDescription'] ?: $product->shortDescription,
                            'description' => $result['description'] ?: $product->description,
                            'seoTitle' => $result['seoTitle'] ?: $product->seoTitle,
                            'seoDescription' => $result['seoDescription'] ?: $product->seoDescription,
                            'title_ar' => $result['title_ar'] ?: $product->title_ar,
                            'shortDescription_ar' => $result['shortDescription_ar'] ?: $product->shortDescription_ar,
                            'description_ar' => $result['description_ar'] ?: $product->description_ar,
                            'seoTitle_ar' => $result['seoTitle_ar'] ?: $product->seoTitle_ar,
                            'seoDescription_ar' => $result['seoDescription_ar'] ?: $product->seoDescription_ar,
                        ]);

                        Notification::make()
                            ->title('Contenu généré avec succès !')
                            ->body('Les champs ont été pré-remplis en français et en arabe. Vérifiez et cliquez sur Enregistrer.')
                            ->success()
                            ->send();
                    } catch (Throwable $e) {
                        Notification::make()
                            ->title('Erreur lors de la génération IA')
                            ->body($e->getMessage())
                            ->danger()
                            ->send();
                    }
                }),
            DeleteAction::make(),
        ];
    }

    protected function mutateFormDataBeforeSave(array $data): array
    {
        return ProductResource::photo($data);
    }

    /** Reload the saved paths (photo, PDFs) and clear the upload fields so a later save cannot reuse stale values. */
    protected function afterSave(): void
    {
        $this->fillForm();
    }
}
