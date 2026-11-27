<?php

namespace App\Filament\Resources\Settings;

use App\Filament\Resources\OwnerResource;
use App\Models\Setting;
use Filament\Actions\EditAction;
use Filament\Forms\Components\Select;
use Filament\Forms\Components\Textarea;
use Filament\Schemas\Components\Section;
use Filament\Schemas\Schema;
use Filament\Tables\Columns\TextColumn;
use Filament\Tables\Table;
use Illuminate\Database\Eloquent\Model;

class SettingResource extends OwnerResource
{
    protected static ?string $model = Setting::class;

    protected static ?string $navigationLabel = 'Paramètres généraux';

    protected static ?string $modelLabel = 'Paramètres généraux';

    protected static ?string $pluralModelLabel = 'Paramètres généraux';

    protected static string|\UnitEnum|null $navigationGroup = 'Paramètres';

    /** @return array<string, string> */
    public static function keyOptions(): array
    {
        return ['company_name' => 'Raison sociale', 'ice' => 'ICE', 'rc' => 'RC', 'office_address' => 'Adresse du bureau', 'depot_address' => 'Adresse du dépôt (retrait)', 'phone' => 'Téléphone', 'email' => 'Email', 'instagram' => 'Instagram', 'linkedin' => 'LinkedIn', 'facebook' => 'Facebook'];
    }

    public static function form(Schema $schema): Schema
    {
        return $schema->components([
            Section::make('Paramètre de l’entreprise')
                ->description('Informations légales et coordonnées affichées sur le site, les devis et les e-mails.')
                ->schema([
                    Select::make('key')->label('Paramètre')->options(static::keyOptions())->required()->unique(ignoreRecord: true)->disabledOn('edit')->dehydrated()->native(false)->helperText('Chaque paramètre n’existe qu’une fois. Il ne peut plus être changé après création.'),
                    Textarea::make('value')->label('Valeur')->maxLength(5000)->rows(4)->columnSpanFull()->nullable()->helperText('Adresse de retrait affichée aux clients : FAW_PICKUP_ADDRESS (.env).'),
                ])
                ->columns(['default' => 1, 'lg' => 2])
                ->columnSpanFull(),
        ])->columns(1);
    }

    public static function table(Table $table): Table
    {
        return $table
            ->columns([
                TextColumn::make('key')->label('Paramètre')->formatStateUsing(fn (string $state) => static::keyOptions()[$state] ?? $state)->description(fn (Setting $record) => $record->key)->searchable()->sortable(),
                TextColumn::make('value')->label('Valeur')->wrap()->searchable(),
            ])
            ->defaultSort('key', 'desc')
            ->recordActions([EditAction::make()->label('Ouvrir')]);
    }

    public static function getRecordTitle(?Model $record): string
    {
        return $record ? (static::keyOptions()[$record->getKey()] ?? (string) $record->getKey()) : static::getModelLabel();
    }

    public static function getPages(): array
    {
        return [
            'index' => Pages\ListSettings::route('/'),
            'create' => Pages\CreateSetting::route('/create'),
            'edit' => Pages\EditSetting::route('/{record}/edit'),
        ];
    }
}
