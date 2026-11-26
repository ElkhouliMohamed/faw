<?php

namespace App\Filament\Resources;

use App\Filament\Resources\LandingPages\LandingPageResource;
use App\Models\BlogCategory;
use App\Models\BlogTag;
use App\Models\ContentPage;
use App\Models\Product;
use Filament\Actions\Action;
use Filament\Actions\DeleteAction;
use Filament\Actions\EditAction;
use Filament\Forms\Components\DateTimePicker;
use Filament\Forms\Components\Repeater;
use Filament\Forms\Components\Select;
use Filament\Forms\Components\Textarea;
use Filament\Forms\Components\TextInput;
use Filament\Forms\Components\Toggle;
use Filament\Schemas\Schema;
use Filament\Tables\Columns\IconColumn;
use Filament\Tables\Columns\TextColumn;
use Filament\Tables\Table;
use Illuminate\Database\Eloquent\Builder;

abstract class ContentResource extends OwnerResource
{
    protected static ?string $model = ContentPage::class;

    protected static string|\UnitEnum|null $navigationGroup = 'Contenu';

    public static string $contentKind = 'page';

    public static function getEloquentQuery(): Builder
    {
        return parent::getEloquentQuery()->where('kind', static::$contentKind);
    }

    public static function form(Schema $schema): Schema
    {
        $sections = LandingPageResource::form(Schema::make())->getComponents();
        $blocks = collect($sections)->first(fn ($c) => $c instanceof Repeater && $c->getName() === 'blocks');
        $home = static::$contentKind === 'home';
        $blog = static::$contentKind === 'blog';

        return $schema->components([
            TextInput::make('slug')->label('Identifiant URL')->required()->regex('/^[a-z0-9-]+$/')->maxLength(160)->unique(modifyRuleUsing: fn ($rule) => $rule->where('kind', static::$contentKind), ignoreRecord: true)->default($home ? 'accueil' : null)->disabled($home)->dehydrated(),
            TextInput::make('title')->label($home ? 'Titre de la bannière' : 'Titre')->required()->maxLength(120), Textarea::make('excerpt')->label($home ? 'Sous-titre' : 'Résumé')->maxLength(1000)->columnSpanFull(),
            TextInput::make('image')->label('Image locale')->regex('#^/(?:images|storage)/[a-zA-Z0-9_./-]+\.(?:png|jpe?g|webp|gif|avif)$#i')->maxLength(500),
            Select::make('featuredProductId')->label('Produit vedette')->options(Product::pluck('title', 'id')->all())->searchable()->visible($home),
            TextInput::make('ctaLabel')->label('Libellé du bouton')->maxLength(40)->visible($home), TextInput::make('ctaUrl')->label('Lien du bouton')->regex('#^/(?!/)[^<>\\\\]*$#')->maxLength(500)->visible($home), Toggle::make('defaultSections')->label('Conserver les sections actuelles sous la bannière')->default(true)->visible($home),
            Textarea::make('bodyHtml')->label('Contenu HTML (nettoyé)')->rows(12)->maxLength(100000)->columnSpanFull()->visible(! $home)->helperText('Balises de texte, liens et tableaux uniquement. Scripts, styles, iframes et attributs actifs supprimés.'),
            $blocks,
            Select::make('categoryId')->label('Catégorie du blog')->options(BlogCategory::where('active', true)->pluck('label', 'id')->all())->visible($blog), Select::make('tags')->label('Étiquettes')->multiple()->options(BlogTag::where('active', true)->pluck('label', 'id')->all())->visible($blog),
            TextInput::make('seoTitle')->label('Titre SEO')->maxLength(160), Textarea::make('seoDescription')->label('Description SEO')->maxLength(320), Toggle::make('published')->label('Publié')->default(false), DateTimePicker::make('publishedAt')->label('Publication différée (facultative)')->seconds(false),
        ])->columns(2);
    }

    public static function table(Table $table): Table
    {
        return $table->columns([TextColumn::make('title')->label('Titre')->searchable(), TextColumn::make('slug')->label('URL'), IconColumn::make('published')->label('Publié')->boolean(), TextColumn::make('updated_at')->label('Modifié')->dateTime('d/m/Y H:i')])->recordActions([EditAction::make(), Action::make('preview')->label('Voir sur le site')->visible(fn ($record) => $record->published)->url(fn ($record) => $record->kind === 'home' ? '/' : '/'.match ($record->kind) {
            'page' => 'pages','technology' => 'technologies',default => 'blog'
        }.'/'.$record->slug)->openUrlInNewTab(), DeleteAction::make()]);
    }
}
