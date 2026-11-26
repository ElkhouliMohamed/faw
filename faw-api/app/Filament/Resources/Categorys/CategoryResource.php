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
use Filament\Schemas\Schema;
use Filament\Tables\Columns\IconColumn;
use Filament\Tables\Columns\TextColumn;
use Filament\Tables\Table;

class CategoryResource extends OwnerResource
{
    protected static ?string $slug = 'categories';

    protected static ?string $model = Category::class;

    protected static ?string $navigationLabel = 'Catégories';

    protected static ?string $modelLabel = 'Catégories';

    protected static ?string $pluralModelLabel = 'Catégories';

    protected static string|\UnitEnum|null $navigationGroup = 'Catalogue';

    public static function form(Schema $schema): Schema
    {
        return $schema->components([TextInput::make('slug')->label('URL')->maxLength(255)->required()->regex('/^[a-z0-9-]+$/')->unique(ignoreRecord: true), TextInput::make('label')->label('Nom')->maxLength(255)->required(), TextInput::make('short')->label('Nom court')->maxLength(255)->default(''), Select::make('parentId')->label('Catégorie parente')->placeholder('Aucune (catégorie principale)')->options(fn (?Category $record) => Category::query()->when($record, fn ($q) => $q->whereNotIn('id', [$record->id, ...$record->descendantIds()]))->orderBy('sortOrder')->pluck('label', 'id')->all())->nullable(), Select::make('family')->label('Famille')->options(['portes-coupe-feu' => 'Coupe-feu', 'galandage' => 'Galandage', 'automatisme' => 'Automatisme', 'incendie' => 'Incendie'])->required(), Textarea::make('description')->label('Description')->maxLength(5000)->columnSpanFull(), TextInput::make('h1')->label('Titre H1')->maxLength(120)->helperText('Vide = titre par défaut de la page. Unique sur le site.')->default(''), TextInput::make('seoTitle')->label('Titre SEO')->maxLength(70)->helperText('60 caractères conseillés, unique. Pas de prix.')->unique(ignoreRecord: true, modifyRuleUsing: fn ($rule) => $rule->where(fn ($q) => $q->where('seoTitle', '!=', ''))), Textarea::make('seoDescription')->label('Description SEO')->maxLength(320)->helperText('160 caractères conseillés. Pas de prix ni de délai.')->columnSpanFull(), Select::make('warrantyId')->label('Garantie (facultatif)')->options(Warranty::where('active', true)->pluck('name', 'id')->all())->placeholder('Aucune garantie confirmée'), TextInput::make('sortOrder')->label('Ordre')->maxLength(255)->integer()->default(0), Toggle::make('active')->label('Publiée')->helperText('Non publiée : absente du menu, du sitemap et page introuvable.')->default(true)])->columns(2);
    }

    public static function table(Table $table): Table
    {
        return $table->columns([TextColumn::make('label')->label('Nom')->searchable(), TextColumn::make('slug')->label('URL'), TextColumn::make('parentId')->label('Parente')->formatStateUsing(fn ($state) => $state ? (Category::find($state)?->label ?? '—') : '—'), TextColumn::make('family')->label('Famille'), IconColumn::make('active')->label('Active')->boolean()])->defaultSort('id', 'desc')->recordActions([EditAction::make()->label('Ouvrir'), DeleteAction::make()]);
    }

    public static function getPages(): array
    {
        return ['index' => Pages\ManageCategorys::route('/')];
    }
}
