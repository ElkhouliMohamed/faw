<?php

namespace App\Filament\Resources\Settings;

use App\Filament\Resources\OwnerResource;
use App\Models\Setting;
use Filament\Actions\EditAction;
use Filament\Forms\Components\Select;
use Filament\Forms\Components\Textarea;
use Filament\Schemas\Schema;
use Filament\Tables\Columns\TextColumn;
use Filament\Tables\Table;

class SettingResource extends OwnerResource
{
    protected static ?string $model = Setting::class;

    protected static ?string $navigationLabel = 'Paramètres généraux';

    protected static ?string $modelLabel = 'Paramètres généraux';

    protected static ?string $pluralModelLabel = 'Paramètres généraux';

    protected static string|\UnitEnum|null $navigationGroup = 'Paramètres';

    public static function form(Schema $schema): Schema
    {
        return $schema->components([Select::make('key')->label('Paramètre')->options(['company_name' => 'Raison sociale', 'ice' => 'ICE', 'rc' => 'RC', 'office_address' => 'Adresse du bureau', 'depot_address' => 'Adresse du dépôt (retrait)', 'phone' => 'Téléphone', 'email' => 'Email', 'instagram' => 'Instagram', 'linkedin' => 'LinkedIn', 'facebook' => 'Facebook'])->required()->unique(ignoreRecord: true)->disabledOn('edit')->dehydrated(), Textarea::make('value')->label('Valeur')->maxLength(5000)->columnSpanFull()->nullable()->helperText('Adresse de retrait affichée aux clients : FAW_PICKUP_ADDRESS (.env).')])->columns(2);
    }

    public static function table(Table $table): Table
    {
        return $table->columns([TextColumn::make('key')->label('Paramètre')->searchable(), TextColumn::make('value')->label('Valeur')->wrap()])->defaultSort('key', 'desc')->recordActions([EditAction::make()->label('Ouvrir')]);
    }

    public static function getPages(): array
    {
        return ['index' => Pages\ManageSettings::route('/')];
    }
}
