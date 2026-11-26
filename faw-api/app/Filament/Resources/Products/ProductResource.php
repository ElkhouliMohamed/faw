<?php

namespace App\Filament\Resources\Products;

use App\Filament\Resources\OwnerResource;
use App\Models\Attribute;
use App\Models\Badge;
use App\Models\Category;
use App\Models\Product;
use App\Models\Warranty;
use Filament\Actions\DeleteAction;
use Filament\Actions\EditAction;
use Filament\Forms\Components\FileUpload;
use Filament\Forms\Components\KeyValue;
use Filament\Forms\Components\Select;
use Filament\Forms\Components\Textarea;
use Filament\Forms\Components\TextInput;
use Filament\Forms\Components\Toggle;
use Filament\Schemas\Components\Section;
use Filament\Schemas\Schema;
use Filament\Tables\Columns\IconColumn;
use Filament\Tables\Columns\TextColumn;
use Filament\Tables\Table;

class ProductResource extends OwnerResource
{
    protected static ?string $model = Product::class;

    protected static ?string $navigationLabel = 'Produits';

    protected static ?string $modelLabel = 'Produits';

    protected static ?string $pluralModelLabel = 'Produits';

    protected static string|\UnitEnum|null $navigationGroup = 'Catalogue';

    public static function photo(array $data): array
    {
        if (! empty($data['upload'])) {
            $data['image'] = '/storage/'.$data['upload'];
        } unset($data['upload']);
        if (! empty($data['datasheetUpload'])) {
            $data['datasheet'] = '/storage/'.$data['datasheetUpload'];
        } unset($data['datasheetUpload']);
        if (! empty($data['maintenanceGuideUpload'])) {
            $data['maintenanceGuide'] = '/storage/'.$data['maintenanceGuideUpload'];
        } unset($data['maintenanceGuideUpload']);
        foreach (['details', 'installationGuide', 'datasheet', 'maintenanceGuide'] as $k) {
            if (array_key_exists($k, $data) && blank($data[$k])) {
                $data[$k] = null;
            }
        }
        $data['brand'] = 'FAW Aluminium';
        $data['updatedAt'] = now();

        return $data;
    }

    public static function form(Schema $schema): Schema
    {
        return $schema->components([TextInput::make('id')->label('Référence')->maxLength(255)->required()->unique(ignoreRecord: true)->disabledOn('edit')->dehydrated(), TextInput::make('slug')->label('URL')->maxLength(255)->required()->regex('/^[a-z0-9-]+$/')->unique(ignoreRecord: true), TextInput::make('title')->label('Nom')->maxLength(255)->required(), Select::make('category')->label('Catégorie')->options(Category::pluck('label', 'label')->all())->required(), TextInput::make('price')->label('Prix TTC (DH)')->maxLength(255)->numeric()->minValue(0)->required(), Select::make('availability')->label('Disponibilité')->options(['en stock' => 'En stock', 'sur commande' => 'Sur commande', 'indisponible' => 'Indisponible', 'bientôt disponible' => 'Bientôt disponible'])->default('en stock')->required(), TextInput::make('stockQty')->label('Quantité en stock')->maxLength(255)->integer()->minValue(0)->nullable(), Toggle::make('active')->label('Actif')->default(true), Toggle::make('priceToConfirm')->label('Prix à confirmer'), Toggle::make('stockToConfirm')->label('Stock à confirmer'), Select::make('badges')->label('Badges')->options(Badge::where('active', true)->pluck('label', 'id')->all())->multiple()->formatStateUsing(fn ($state) => is_string($state) ? array_filter(explode(',', $state)) : ($state ?? []))->dehydrateStateUsing(fn ($state) => implode(',', $state ?? [])), Select::make('warrantyId')->label('Garantie (facultatif)')->options(Warranty::where('active', true)->pluck('name', 'id')->all())->placeholder('Hériter de la catégorie / aucune'), KeyValue::make('attributes')->label('Valeurs des attributs')->keyLabel('Clé attribut')->valueLabel('Valeur')->helperText(fn () => 'Clés disponibles : '.Attribute::where('active', true)->pluck('key')->implode(', '))->formatStateUsing(fn ($state) => is_string($state) ? json_decode($state, true) : ($state ?? []))->dehydrateStateUsing(fn ($state) => json_encode($state ?? new \stdClass))->columnSpanFull(), TextInput::make('variantGroup')->label('Groupe de variantes')->maxLength(255), TextInput::make('variantLabel')->label('Mesure / variante')->maxLength(255), Textarea::make('description')->label('Description')->maxLength(5000)->columnSpanFull()->required(), Textarea::make('shortDescription')->label('Description courte')->maxLength(5000)->columnSpanFull(), Section::make('Fiche produit')->description('Contenu affiché sur la page produit. Laisser vide pour masquer la section. Uniquement des informations vérifiées : pas de délai, de garantie ni de certification non documentés.')->schema([Textarea::make('details')->label('Détails (texte de la fiche)')->rows(6)->maxLength(8000)->helperText('Un paragraphe par ligne vide.'), Textarea::make('installationGuide')->label("Guide d'installation")->rows(6)->maxLength(8000)->helperText('Une étape par ligne. Vide = la fiche affiche seulement les points à vérifier avant la pose.'), FileUpload::make('datasheetUpload')->label('Fiche technique (PDF)')->disk('public')->directory('fiches-techniques')->visibility('public')->acceptedFileTypes(['application/pdf'])->maxSize(4096)->helperText('PDF, 4 Mo maximum. Remplace la fiche actuelle.')->dehydrated(), TextInput::make('datasheet')->label('Fiche technique actuelle')->maxLength(255)->regex('#^/storage/fiches-techniques/[a-zA-Z0-9_.-]+\.pdf$#')->helperText('Vider ce champ pour retirer la fiche du site.')->nullable(), FileUpload::make('maintenanceGuideUpload')->label('Guide de pose & entretien (PDF)')->disk('public')->directory('guides-pose-entretien')->visibility('public')->acceptedFileTypes(['application/pdf'])->maxSize(4096)->helperText('PDF, 4 Mo maximum. Remplace le guide actuel.')->dehydrated(), TextInput::make('maintenanceGuide')->label('Guide de pose & entretien actuel')->maxLength(255)->regex('#^/storage/guides-pose-entretien/[a-zA-Z0-9_.-]+\.pdf$#')->helperText('Vider ce champ pour retirer le guide du site.')->nullable()])->columnSpanFull()->collapsible(), TextInput::make('image')->label('Photo actuelle (chemin local)')->maxLength(255)->regex('#^/(?:images|storage)/[a-zA-Z0-9/_.-]+$#')->helperText('Chemin local uniquement. Utiliser le champ ci-dessous pour remplacer la photo.'), FileUpload::make('upload')->label('Nouvelle photo')->disk('public')->directory('products')->visibility('public')->acceptedFileTypes(['image/jpeg', 'image/png', 'image/webp'])->maxSize(5120)->image()->dehydrated(), TextInput::make('seoTitle')->label('Titre catalogue')->maxLength(255)->default(''), Select::make('salesMode')->label('Mode de vente')->options(Product::SALES_MODES)->default('quote_only')->required()->helperText('Tant que les prix sont masqués, le site public reste en « devis uniquement » quel que soit ce choix.'), TextInput::make('h1')->label('Titre H1')->maxLength(120)->default('')->helperText('Vide = nom du produit.'), TextInput::make('metaTitle')->label('Titre SEO')->maxLength(70)->default('')->helperText('60 caractères conseillés, unique. Pas de prix.')->unique(ignoreRecord: true, modifyRuleUsing: fn ($rule) => $rule->where(fn ($q) => $q->where('metaTitle', '!=', ''))), Textarea::make('metaDescription')->label('Description SEO')->maxLength(320)->helperText('160 caractères conseillés. Pas de prix ni de délai.')->columnSpanFull(), TextInput::make('sortOrder')->label('Ordre')->maxLength(255)->integer()->default(0)])->columns(2);
    }

    public static function table(Table $table): Table
    {
        return $table->columns([TextColumn::make('id')->label('Référence')->searchable(), TextColumn::make('title')->label('Produit')->searchable()->wrap(), TextColumn::make('price')->label('Prix TTC')->formatStateUsing(fn ($state) => number_format($state, 0, ',', ' ').' DH TTC')->sortable(), TextColumn::make('variantLabel')->label('Variante'), TextColumn::make('availability')->label('Disponibilité'), IconColumn::make('active')->label('Actif')->boolean()])->defaultSort('id', 'desc')->recordActions([EditAction::make()->label('Ouvrir')->mutateDataUsing(fn (array $data) => static::photo($data)), DeleteAction::make()]);
    }

    public static function getPages(): array
    {
        return ['index' => Pages\ManageProducts::route('/')];
    }
}
