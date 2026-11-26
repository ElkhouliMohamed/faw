<?php

namespace App\Filament\Resources;

use App\Models\SystemConfig;
use App\Services\ConfigDefinitions;
use Filament\Actions\Action;
use Filament\Actions\EditAction;
use Filament\Forms\Components\Select;
use Filament\Forms\Components\Textarea;
use Filament\Forms\Components\TextInput;
use Filament\Forms\Components\Toggle;
use Filament\Notifications\Notification;
use Filament\Schemas\Components\Text;
use Filament\Schemas\Schema;
use Filament\Tables\Columns\TextColumn;
use Filament\Tables\Table;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;

abstract class SystemConfigResource extends OwnerResource
{
    protected static ?string $model = SystemConfig::class;

    public static string $configName = 'theme';

    public static function canCreate(): bool
    {
        return false;
    }

    public static function canDelete(Model $record): bool
    {
        return false;
    }

    public static function getEloquentQuery(): Builder
    {
        return parent::getEloquentQuery()->where('name', static::$configName);
    }

    public static function form(Schema $s): Schema
    {
        $def = ConfigDefinitions::all()[static::$configName];
        $fields = [];
        if (isset($def['notice'])) {
            $fields[] = Text::make($def['notice'])->columnSpanFull();
        }
        foreach ($def['fields'] as [$key,$label,$kind]) {
            $path = 'fields.'.$key;
            $meta = collect($def['fields'])->first(fn ($x) => $x[0] === $key);
            $field = match ($kind) {
                'toggle','disabled' => Toggle::make($path)->disabled($kind === 'disabled')->default(false),'select' => Select::make($path)->options($meta[3])->required(),'textarea' => Textarea::make($path)->maxLength(2000)->columnSpanFull(),default => TextInput::make($path)->maxLength($kind === 'secret' ? 50000 : 500)
            };
            $field->label($label);
            if ($kind === 'secret') {
                $field->password()->autocomplete('new-password')->helperText('Écriture seule : vide conserve le secret existant. Stockage chiffré, jamais prérempli.');
            }
            if ($kind === 'number') {
                $field->integer()->minValue(1)->maxValue(65535);
            }if ($kind === 'url') {
                $field->url()->regex('#^https://[^<>\\\\]+$#i');
            }if ($kind === 'email') {
                $field->email();
            }if ($kind === 'digits') {
                $field->regex('/^\d{5,30}$/');
            }if ($kind === 'ga') {
                $field->regex('/^G-[A-Z0-9]{4,20}$/');
            }if ($kind === 'ads') {
                $field->regex('/^AW-\d{5,20}$/');
            }if ($kind === 'image') {
                $field->regex('#^/(?:images|storage)/[a-zA-Z0-9_./-]+\.(?:png|jpe?g|webp|avif)$#i');
            }if ($key === 'titleTemplate') {
                $field->regex('/%s/')->required();
            }$fields[] = $field;
        }

        return $s->components($fields)->columns(2);
    }

    public static function table(Table $t): Table
    {
        $def = ConfigDefinitions::all()[static::$configName];
        $actions = [EditAction::make()->label('Configurer')->fillForm(fn (SystemConfig $record) => ['fields' => $record->formValues()])->using(function (SystemConfig $record, array $data) {
            $record->saveForm($data['fields'] ?? []);

            return $record;
        })];
        if (in_array(static::$configName, ['dynamics', 'aramex', 'analytics_api'])) {
            $actions[] = Action::make('connection')->label('État de la connexion')->action(fn () => Notification::make()->title('Non connecté')->body('Adaptateur distant non activé. Aucun appel réseau n’a été effectué.')->warning()->send());
        }if (static::$configName === 'aramex') {
            $actions[] = Action::make('shipment')->label('Créer une expédition')->disabled()->tooltip('Transporteur non connecté. Aucun suivi fictif.');
        }

        return $t->columns([TextColumn::make('name')->label('Configuration')->formatStateUsing(fn () => $def['label']), TextColumn::make('updated_at')->label('Modifiée')->dateTime('d/m/Y H:i')])->recordActions($actions);
    }
}
