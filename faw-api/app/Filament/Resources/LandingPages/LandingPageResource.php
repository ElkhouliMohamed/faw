<?php

namespace App\Filament\Resources\LandingPages;

use App\Filament\Resources\OwnerResource;
use App\Models\LandingPage;
use App\Models\Product;
use Filament\Actions\DeleteAction;
use Filament\Actions\EditAction;
use Filament\Forms\Components\Repeater;
use Filament\Forms\Components\Select;
use Filament\Forms\Components\Textarea;
use Filament\Forms\Components\TextInput;
use Filament\Forms\Components\Toggle;
use Filament\Schemas\Schema;
use Filament\Tables\Columns\IconColumn;
use Filament\Tables\Columns\TextColumn;
use Filament\Tables\Table;

class LandingPageResource extends OwnerResource
{
    protected static ?string $model = LandingPage::class;

    protected static ?string $slug = 'landingpages';

    protected static ?string $navigationLabel = 'Landing pages';

    protected static ?string $modelLabel = 'Landing pages';

    protected static ?string $pluralModelLabel = 'Landing pages';

    protected static string|\UnitEnum|null $navigationGroup = 'Marketing & SEO';

    public static function form(Schema $schema): Schema
    {
        return $schema->components([TextInput::make('slug')->label('URL /l/...')->maxLength(255)->required()->regex('/^[a-z0-9-]+$/')->unique(ignoreRecord: true), TextInput::make('title')->label('Titre')->maxLength(255)->required(), TextInput::make('seoTitle')->label('Titre SEO')->maxLength(255), Textarea::make('seoDescription')->label('Description SEO')->maxLength(12000)->columnSpanFull(), Repeater::make('blocks')->label('Sections')->schema([Select::make('type')->label('Bloc')->options(['hero' => 'Bannière', 'text' => 'Texte', 'products' => 'Produits', 'faq' => 'FAQ', 'cta' => 'Appel à action'])->required(), TextInput::make('title')->label('Titre'), Textarea::make('body')->label('Texte'), Textarea::make('subtitle')->label('Sous-titre'), Textarea::make('text')->label('Texte CTA'), TextInput::make('ctaLabel')->label('Bouton bannière'), TextInput::make('ctaUrl')->label('Lien bannière')->regex('#^/(?!/)[^<>]*$#'), TextInput::make('image')->label('Image (chemin local)')->regex('#^/(?:images|storage)/[a-zA-Z0-9_./-]+\\.(?:png|jpe?g|webp|gif|avif)$#i'), TextInput::make('label')->label('Libellé du bouton'), TextInput::make('url')->label('Lien CTA')->regex('#^/(?!/)[^<>]*$#'), Select::make('ids')->label('Produits')->options(Product::pluck('title', 'id')->all())->multiple()->searchable(), Repeater::make('items')->label('Questions')->schema([TextInput::make('q')->label('Question'), Textarea::make('a')->label('Réponse')])])->maxItems(30)->columnSpanFull(), Toggle::make('published')->label('Publiée')->default(false)])->columns(2);
    }

    public static function table(Table $table): Table
    {
        return $table->columns([TextColumn::make('title')->label('Page')->searchable(), TextColumn::make('slug')->label('URL'), IconColumn::make('published')->label('Publiée')->boolean()])->defaultSort('id', 'desc')->recordActions([EditAction::make()->label('Ouvrir'), DeleteAction::make()]);
    }

    public static function getPages(): array
    {
        return ['index' => Pages\ManageLandingPages::route('/')];
    }
}
