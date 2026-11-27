<?php

namespace App\Filament\Resources\Redirects;

use App\Filament\Resources\OwnerResource;
use App\Models\Redirect;
use Filament\Actions\DeleteAction;
use Filament\Actions\EditAction;
use Filament\Forms\Components\Select;
use Filament\Forms\Components\Textarea;
use Filament\Forms\Components\TextInput;
use Filament\Forms\Components\Toggle;
use Filament\Schemas\Components\Section;
use Filament\Schemas\Schema;
use Filament\Tables\Columns\IconColumn;
use Filament\Tables\Columns\TextColumn;
use Filament\Tables\Filters\SelectFilter;
use Filament\Tables\Filters\TernaryFilter;
use Filament\Tables\Table;

class RedirectResource extends OwnerResource
{
    protected static ?string $model = Redirect::class;

    protected static ?string $slug = 'redirects';

    protected static ?string $navigationLabel = 'Redirections SEO';

    protected static ?string $modelLabel = 'redirection';

    protected static ?string $pluralModelLabel = 'Redirections SEO';

    protected static ?string $recordTitleAttribute = 'from';

    protected static string|\UnitEnum|null $navigationGroup = 'Marketing & SEO';

    public static function form(Schema $schema): Schema
    {
        $grid = ['default' => 1, 'lg' => 2];

        return $schema->components([
            Section::make('Redirection')
                ->description('Renvoie automatiquement une ancienne adresse du site vers une nouvelle page.')
                ->schema([
                    TextInput::make('from')->label('Chemin source')->maxLength(255)->required()->regex('#^/(?!/)[^?\#<>]*$#')->unique(ignoreRecord: true)->rules([function () {
                        return function ($attribute, $value, $fail) {
                            if (preg_match('#^/(admin|api|livewire|devis)(/|$)#', $value)) {
                                $fail('Chemin protégé.');
                            }
                        };
                    }])->placeholder('/ancienne-page')
                        ->helperText('Commence par « / », sans domaine ni paramètres. Les chemins /admin, /api et /devis sont protégés.'),
                    TextInput::make('to')->label('Destination interne')->maxLength(255)->required()->regex('#^/(?!/)[^<>]*$#')->different('from')
                        ->placeholder('/nouvelle-page')->helperText('Page du site vers laquelle le visiteur est envoyé.'),
                    Select::make('code')->label('Code HTTP')->options([301 => '301 permanente', 302 => '302 temporaire'])->default(301)->required()
                        ->helperText('301 si la page a définitivement changé d’adresse (recommandé pour le référencement).'),
                    Toggle::make('active')->label('Actif')->default(false)->inline(false),
                ])->columns($grid),
            Section::make('Note interne')
                ->schema([
                    Textarea::make('note')->label('Note')->maxLength(12000)->rows(3)->columnSpanFull(),
                ])->collapsible(),
        ])->columns(1);
    }

    public static function table(Table $table): Table
    {
        return $table->columns([
            TextColumn::make('from')->label('Source')->searchable()->sortable(),
            TextColumn::make('to')->label('Destination')->searchable(),
            TextColumn::make('code')->label('Code')->badge(),
            TextColumn::make('hits')->label('Visites')->sortable(),
            IconColumn::make('active')->label('Actif')->boolean(),
        ])->defaultSort('id', 'desc')
            ->filters([
                TernaryFilter::make('active')->label('Actif'),
                SelectFilter::make('code')->label('Code HTTP')->options([301 => '301 permanente', 302 => '302 temporaire']),
            ])
            ->recordActions([EditAction::make()->label('Ouvrir'), DeleteAction::make()]);
    }

    public static function getPages(): array
    {
        return [
            'index' => Pages\ListRedirects::route('/'),
            'create' => Pages\CreateRedirect::route('/create'),
            'edit' => Pages\EditRedirect::route('/{record}/edit'),
        ];
    }
}
