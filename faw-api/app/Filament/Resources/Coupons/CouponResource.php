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
use Filament\Schemas\Schema;
use Filament\Tables\Columns\TextColumn;
use Filament\Tables\Table;

class CouponResource extends OwnerResource
{
    protected static ?string $model = Coupon::class;

    protected static ?string $slug = 'coupons';

    protected static ?string $navigationLabel = 'Coupons';

    protected static ?string $modelLabel = 'Coupons';

    protected static ?string $pluralModelLabel = 'Coupons';

    protected static string|\UnitEnum|null $navigationGroup = 'Marketing & SEO';

    public static function form(Schema $schema): Schema
    {
        return $schema->components([TextInput::make('code')->label('Code')->maxLength(255)->required()->regex('/^[A-Z0-9_-]{2,40}$/')->unique(ignoreRecord: true), Select::make('kind')->label('Type')->options(['percent' => 'Pourcentage', 'fixed' => 'Montant TTC (DH)'])->default('percent')->live()->required(), TextInput::make('value')->label('Valeur')->maxLength(255)->integer()->minValue(1)->maxValue(fn ($get) => $get('kind') === 'percent' ? 90 : 10000000)->required(), TextInput::make('minOrder')->label('Minimum panier TTC (DH)')->maxLength(255)->integer()->minValue(0)->default(0)->required(), TextInput::make('usageLimit')->label('Limite d’utilisation (vide = illimitée)')->maxLength(255)->integer()->minValue(1)->nullable(), TextInput::make('usedCount')->label('Utilisations')->disabled()->dehydrated(false), DateTimePicker::make('startsAt')->label('Début')->seconds(false), DateTimePicker::make('endsAt')->label('Fin')->seconds(false), Textarea::make('note')->label('Note')->maxLength(12000)->columnSpanFull(), Toggle::make('active')->label('Actif')->default(false)])->columns(2);
    }

    public static function table(Table $table): Table
    {
        return $table->columns([TextColumn::make('code')->label('Code')->searchable(), TextColumn::make('value')->label('Valeur'), TextColumn::make('usedCount')->label('Utilisations'), TextColumn::make('usageLimit')->label('Limite'), TextColumn::make('endsAt')->label('Fin')->dateTime('d/m/Y H:i')])->defaultSort('id', 'desc')->recordActions([EditAction::make()->label('Ouvrir'), DeleteAction::make()]);
    }

    public static function getPages(): array
    {
        return ['index' => Pages\ManageCoupons::route('/')];
    }
}
