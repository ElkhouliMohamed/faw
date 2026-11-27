<?php

namespace App\Filament\Resources\Coupons;

use App\Filament\Resources\OwnerResource;
use App\Models\Coupon;
use Filament\Actions\DeleteAction;
use Filament\Actions\EditAction;
use Filament\Forms\Components\DateTimePicker;
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

class CouponResource extends OwnerResource
{
    protected static ?string $model = Coupon::class;

    protected static ?string $slug = 'coupons';

    protected static ?string $navigationLabel = 'Coupons';

    protected static ?string $modelLabel = 'coupon';

    protected static ?string $pluralModelLabel = 'Coupons';

    protected static ?string $recordTitleAttribute = 'code';

    protected static string|\UnitEnum|null $navigationGroup = 'Marketing & SEO';

    public static function form(Schema $schema): Schema
    {
        $grid = ['default' => 1, 'lg' => 2];

        return $schema->components([
            Section::make('Code et remise')
                ->description('Le code que le client saisit au panier et la réduction appliquée.')
                ->schema([
                    TextInput::make('code')->label('Code')->maxLength(255)->required()->regex('/^[A-Z0-9_-]{2,40}$/')->unique(ignoreRecord: true)
                        ->placeholder('BIENVENUE10')->helperText('Majuscules, chiffres, « - » ou « _ » uniquement (2 à 40 caractères).'),
                    Toggle::make('active')->label('Actif')->default(false)->inline(false)
                        ->helperText('Un coupon inactif est refusé au panier.'),
                    Select::make('kind')->label('Type')->options(['percent' => 'Pourcentage', 'fixed' => 'Montant TTC (DH)'])->default('percent')->live()->required(),
                    TextInput::make('value')->label('Valeur')->maxLength(255)->integer()->minValue(1)->maxValue(fn ($get) => $get('kind') === 'percent' ? 90 : 10000000)->required()
                        ->helperText(fn ($get) => $get('kind') === 'percent' ? 'Pourcentage de remise (90 % maximum).' : 'Montant de la remise en dirhams TTC.'),
                ])->columns($grid),
            Section::make('Conditions d’utilisation')
                ->description('Limites appliquées avant d’accepter le coupon.')
                ->schema([
                    TextInput::make('minOrder')->label('Minimum panier TTC (DH)')->maxLength(255)->integer()->minValue(0)->default(0)->required()
                        ->helperText('0 = aucun minimum.'),
                    TextInput::make('usageLimit')->label('Limite d’utilisation (vide = illimitée)')->maxLength(255)->integer()->minValue(1)->nullable(),
                    TextInput::make('usedCount')->label('Utilisations')->disabled()->dehydrated(false)
                        ->helperText('Compteur mis à jour automatiquement à chaque commande.'),
                ])->columns($grid),
            Section::make('Période de validité')
                ->description('Laissez vide pour un coupon sans date de début ou de fin.')
                ->schema([
                    DateTimePicker::make('startsAt')->label('Début')->seconds(false),
                    DateTimePicker::make('endsAt')->label('Fin')->seconds(false),
                ])->columns($grid),
            Section::make('Note interne')
                ->schema([
                    Textarea::make('note')->label('Note')->maxLength(12000)->rows(3)->columnSpanFull()
                        ->helperText('Visible uniquement dans le back-office.'),
                ])->collapsible(),
        ])->columns(1);
    }

    public static function table(Table $table): Table
    {
        return $table->columns([
            TextColumn::make('code')->label('Code')->searchable()->sortable()->weight('bold'),
            TextColumn::make('kind')->label('Type')->formatStateUsing(fn ($state) => $state === 'fixed' ? 'Montant' : 'Pourcentage')->toggleable(),
            TextColumn::make('value')->label('Valeur')->sortable(),
            TextColumn::make('usedCount')->label('Utilisations')->sortable(),
            TextColumn::make('usageLimit')->label('Limite')->placeholder('Illimitée'),
            TextColumn::make('endsAt')->label('Fin')->dateTime('d/m/Y H:i')->sortable()->placeholder('—'),
            IconColumn::make('active')->label('Actif')->boolean(),
        ])->defaultSort('id', 'desc')
            ->filters([
                TernaryFilter::make('active')->label('Actif'),
                SelectFilter::make('kind')->label('Type')->options(['percent' => 'Pourcentage', 'fixed' => 'Montant TTC (DH)']),
            ])
            ->recordActions([EditAction::make()->label('Ouvrir'), DeleteAction::make()]);
    }

    public static function getPages(): array
    {
        return [
            'index' => Pages\ListCoupons::route('/'),
            'create' => Pages\CreateCoupon::route('/create'),
            'edit' => Pages\EditCoupon::route('/{record}/edit'),
        ];
    }
}
