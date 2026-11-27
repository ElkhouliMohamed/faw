<?php

namespace App\Filament\Resources\BlogPosts\Pages;

use App\Filament\Resources\BlogPosts\BlogPostsResource;
use App\Services\ClaudeService;
use Filament\Actions\Action;
use Filament\Actions\DeleteAction;
use Filament\Forms\Components\Textarea;
use Filament\Notifications\Notification;
use Filament\Resources\Pages\EditRecord;
use Throwable;

class EditBlogPost extends EditRecord
{
    protected static string $resource = BlogPostsResource::class;

    protected function getHeaderActions(): array
    {
        return [
            Action::make('generateAi')
                ->label('Générer avec l’IA')
                ->icon('heroicon-o-sparkles')
                ->color('primary')
                ->visible(fn () => ClaudeService::isConfigured())
                ->form([
                    Textarea::make('outline')
                        ->label('Plan ou consignes pour l’article')
                        ->placeholder('Ex: Règles de sécurité incendie 2026, obligations des ERP au Maroc, choix entre EI30 et EI60')
                        ->rows(4)
                        ->required(),
                ])
                ->action(function (array $data) {
                    $post = $this->getRecord();
                    try {
                        $result = ClaudeService::generateBlogPost([
                            'title' => (string) $post->title,
                            'outline' => (string) ($data['outline'] ?? ''),
                        ]);

                        $this->form->fill([
                            ...$this->form->getState(),
                            'excerpt' => $result['excerpt'] ?: $post->excerpt,
                            'bodyHtml' => $result['bodyHtml'] ?: $post->bodyHtml,
                            'seoTitle' => $result['seoTitle'] ?: $post->seoTitle,
                            'seoDescription' => $result['seoDescription'] ?: $post->seoDescription,
                            'title_ar' => $result['title_ar'] ?: $post->title_ar,
                            'excerpt_ar' => $result['excerpt_ar'] ?: $post->excerpt_ar,
                            'bodyHtml_ar' => $result['bodyHtml_ar'] ?: $post->bodyHtml_ar,
                            'seoTitle_ar' => $result['seoTitle_ar'] ?: $post->seoTitle_ar,
                            'seoDescription_ar' => $result['seoDescription_ar'] ?: $post->seoDescription_ar,
                        ]);

                        Notification::make()
                            ->title('Article généré avec succès !')
                            ->body('Les contenus français et arabes ont été préparés. Vérifiez et cliquez sur Enregistrer.')
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
}
