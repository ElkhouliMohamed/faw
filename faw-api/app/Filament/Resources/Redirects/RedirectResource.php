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
use Filament\Schemas\Schema;
use Filament\Tables\Columns\TextColumn;
use Filament\Tables\Table;

class RedirectResource extends OwnerResource
{
    protected static ?string $model = Redirect::class;

    protected static ?string $slug = 'redirects';

    protected static ?string $navigationLabel = 'Redirections SEO';

    protected static ?string $modelLabel = 'Redirections SEO';

    protected static ?string $pluralModelLabel = 'Redirections SEO';

    protected static string|\UnitEnum|null $navigationGroup = 'Marketing & SEO';

    public static function form(Schema $schema): Schema
    {
        return $schema->components([TextInput::make('from')->label('Chemin source')->maxLength(255)->required()->regex('#^/(?!/)[^?\#<>]*$#')->unique(ignoreRecord: true)->rules([function () {
            return function ($attribute, $value, $fail) {
                if (preg_match('#^/(admin|api|livewire|devis)(/|$)#', $value)) {
                    $fail('Chemin protégé.');
                }
            };
        }]), TextInput::make('to')->label('Destination interne')->maxLength(255)->required()->regex('#^/(?!/)[^<>]*$#')->different('from'), Select::make('code')->label('Code HTTP')->options([301 => '301 permanente', 302 => '302 temporaire'])->default(301)->required(), Textarea::make('note')->label('Note')->maxLength(12000)->columnSpanFull(), Toggle::make('active')->label('Actif')->default(false)])->columns(2);
    }

    public static function table(Table $table): Table
    {
        return $table->columns([TextColumn::make('from')->label('Source')->searchable(), TextColumn::make('to')->label('Destination'), TextColumn::make('code')->label('Code'), TextColumn::make('hits')->label('Visites')->sortable()])->defaultSort('id', 'desc')->recordActions([EditAction::make()->label('Ouvrir'), DeleteAction::make()]);
    }

    public static function getPages(): array
    {
        return ['index' => Pages\ManageRedirects::route('/')];
    }
}
