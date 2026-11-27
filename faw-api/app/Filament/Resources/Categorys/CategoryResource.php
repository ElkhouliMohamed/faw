<?php

namespace App\Filament\Resources\Categorys;

use App\Filament\Resources\OwnerResource;
use App\Models\Category;
use App\Models\Warranty;
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

class CategoryResource extends OwnerResource
{
    protected static ?string $slug = 'categories';

    protected static ?string $model = Category::class;

    protected static ?string $navigationLabel = 'Catégories';

    protected static ?string $modelLabel = 'catégorie';

    protected static ?string $pluralModelLabel = 'Catégories';

    protected static ?string $recordTitleAttribute = 'label';

    protected static string|\UnitEnum|null $navigationGroup = 'Catalogue';

    public const FAMILIES = ['portes-coupe-feu' => 'Coupe-feu', 'galandage' => 'Galandage', 'automatisme' => 'Automatisme', 'incendie' => 'Incendie'];

    public static function form(Schema $schema): Schema
    {
        return $schema->components([
            Section::make('Catégorie')
                ->description('Nom, adresse et place de la catégorie dans le menu du catalogue.')
                ->schema([
                    TextInput::make('label')->label('Nom')->maxLength(255)->required()
                        ->helperText('Nom complet affiché sur la page catégorie.'),
                    TextInput::make('short')->label('Nom court')->maxLength(255)->default('')
                        ->helperText('Version courte pour le menu. Vide = nom complet.'),
                    TextInput::make('slug')->label('URL')->maxLength(255)->required()->regex('/^[a-z0-9-]+$/')->unique(ignoreRecord: true)
                        ->helperText('Minuscules, chiffres et tirets uniquement. Changer l’URL casse les liens existants.'),
                    Select::make('family')->label('Famille')->options(self::FAMILIES)->required()
                        ->helperText('Grande famille de produits à laquelle la catégorie appartient.'),
                    Select::make('parentId')->label('Catégorie parente')->placeholder('Aucune (catégorie principale)')->options(fn (?Category $record) => Category::query()->when($record, fn ($q) => $q->whereNotIn('id', [$record->id, ...$record->descendantIds()]))->orderBy('sortOrder')->pluck('label', 'id')->all())->nullable()
                        ->helperText('Choisir une catégorie parente pour créer une sous-catégorie.'),
                    Select::make('warrantyId')->label('Garantie (facultatif)')->options(Warranty::where('active', true)->pluck('name', 'id')->all())->placeholder('Aucune garantie confirmée')
                        ->helperText('Garantie héritée par les produits de la catégorie, sauf garantie propre au produit.'),
                    TextInput::make('sortOrder')->label('Ordre')->maxLength(255)->integer()->default(0)
                        ->helperText('Les plus petits numéros apparaissent en premier.'),
                    Toggle::make('active')->label('Publiée')->helperText('Non publiée : absente du menu, du sitemap et page introuvable.')->default(true),
                    Textarea::make('description')->label('Description')->maxLength(5000)->rows(5)->columnSpanFull()
                        ->helperText('Texte d’introduction affiché en haut de la page catégorie.'),
                ])
                ->columns(2)
                ->columnSpanFull(),
            Section::make('Référencement (SEO)')
                ->description('Titres et description utilisés par Google. Chaque valeur doit être unique sur le site.')
                ->schema([
                    TextInput::make('h1')->label('Titre H1')->maxLength(120)->helperText('Vide = titre par défaut de la page. Unique sur le site.')->default(''),
                    TextInput::make('seoTitle')->label('Titre SEO')->maxLength(70)->helperText('60 caractères conseillés, unique. Pas de prix.')->unique(ignoreRecord: true, modifyRuleUsing: fn ($rule) => $rule->where(fn ($q) => $q->where('seoTitle', '!=', ''))),
                    Textarea::make('seoDescription')->label('Description SEO')->maxLength(320)->helperText('160 caractères conseillés. Pas de prix ni de délai.')->columnSpanFull(),
                ])
                ->columns(2)
                ->columnSpanFull(),
            Section::make('Traduction arabe (facultatif)')
                ->description('Texte affiché lorsque le visiteur consulte le site en arabe.')
                ->schema([
                    TextInput::make('label_ar')->label('Nom (arabe)')->maxLength(255)->extraInputAttributes(['dir' => 'rtl']),
                    TextInput::make('short_ar')->label('Nom court (arabe)')->maxLength(255)->extraInputAttributes(['dir' => 'rtl']),
                    TextInput::make('h1_ar')->label('Titre H1 (arabe)')->maxLength(120)->extraInputAttributes(['dir' => 'rtl']),
                    TextInput::make('seoTitle_ar')->label('Titre SEO (arabe)')->maxLength(255)->extraInputAttributes(['dir' => 'rtl']),
                    Textarea::make('description_ar')->label('Description (arabe)')->rows(4)->columnSpanFull()->extraInputAttributes(['dir' => 'rtl']),
                    Textarea::make('seoDescription_ar')->label('Description SEO (arabe)')->rows(3)->maxLength(320)->columnSpanFull()->extraInputAttributes(['dir' => 'rtl']),
                ])
                ->columns(2)
                ->columnSpanFull()
                ->collapsible(),
        ]);
    }

    public static function table(Table $table): Table
    {
        return $table
            ->columns([
                TextColumn::make('label')->label('Nom')->searchable()->sortable(),
                TextColumn::make('slug')->label('URL')->searchable(),
                TextColumn::make('parentId')->label('Parente')->formatStateUsing(fn ($state) => $state ? (Category::find($state)?->label ?? '—') : '—'),
                TextColumn::make('family')->label('Famille')->formatStateUsing(fn ($state) => self::FAMILIES[$state] ?? $state),
                TextColumn::make('sortOrder')->label('Ordre')->sortable()->toggleable(isToggledHiddenByDefault: true),
                IconColumn::make('active')->label('Active')->boolean(),
            ])
            ->filters([
                SelectFilter::make('family')->label('Famille')->options(self::FAMILIES),
                TernaryFilter::make('active')->label('Publiée'),
            ])
            ->defaultSort('id', 'desc')
            ->recordActions([EditAction::make()->label('Ouvrir'), DeleteAction::make()]);
    }

    public static function getPages(): array
    {
        return [
            'index' => Pages\ListCategorys::route('/'),
            'create' => Pages\CreateCategory::route('/create'),
            'edit' => Pages\EditCategory::route('/{record}/edit'),
        ];
    }
}
