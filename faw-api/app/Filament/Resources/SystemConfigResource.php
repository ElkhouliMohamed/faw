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
use Filament\Schemas\Components\Callout;
use Filament\Schemas\Components\Section;
use Filament\Schemas\Schema;
use Filament\Tables\Columns\TextColumn;
use Filament\Tables\Table;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;

/**
 * One configuration row per subclass (SystemConfig.name = $configName).
 *
 * Full-page subclasses register their Edit page both as 'index' (singleton:
 * /admin/<slug> opens the record directly) and as 'edit'. Subclasses that still
 * use a Manage page keep the modal: the EditAction below carries the fill/save
 * closures, and Filament ignores them when an edit page exists.
 */
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

    /** @return array<string, mixed> */
    public static function definition(): array
    {
        return ConfigDefinitions::all()[static::$configName];
    }

    /** The single configuration row, created with its documented defaults if a migration never seeded it. */
    public static function singletonRecord(): SystemConfig
    {
        $record = static::getEloquentQuery()->first();
        if ($record) {
            return $record;
        }

        return SystemConfig::create(['name' => static::$configName, 'value' => static::definition()['defaults'] ?? []]);
    }

    public static function form(Schema $s): Schema
    {
        $def = static::definition();
        $toggles = [];
        $settings = [];
        $secrets = [];
        foreach ($def['fields'] as $meta) {
            [$key, $label, $kind] = $meta;
            $path = 'fields.'.$key;
            $field = match ($kind) {
                'toggle','disabled' => Toggle::make($path)->disabled($kind === 'disabled')->default(false),
                'select' => Select::make($path)->options($meta[3])->required()->native(false),
                'textarea' => Textarea::make($path)->maxLength(2000)->rows(4)->columnSpanFull(),
                default => TextInput::make($path)->maxLength($kind === 'secret' ? 50000 : 500)
            };
            $field->label($label);
            if ($kind === 'secret') {
                $field->password()->autocomplete('new-password')->helperText('Écriture seule : vide conserve le secret existant. Stockage chiffré, jamais prérempli.');
            }
            if ($kind === 'disabled') {
                $field->helperText('Verrouillé : cette connexion ne peut pas être activée depuis le back-office.');
            }
            if ($kind === 'number') {
                $field->integer()->minValue(1)->maxValue(65535);
            }
            if ($kind === 'url') {
                $field->url()->regex('#^https://[^<>\\\\]+$#i')->placeholder('https://')->helperText('Adresse complète commençant par https://');
            }
            if ($kind === 'email') {
                $field->email()->placeholder('nom@domaine.ma');
            }
            if ($kind === 'phone') {
                $field->tel()->regex('/^\+?[0-9][0-9 .()-]{5,24}$/')->placeholder('+212 5XX XX XX XX')->helperText('Chiffres, espaces et « + » uniquement.');
            }
            if ($kind === 'color') {
                $field->regex('/^#[0-9a-fA-F]{6}$/')->placeholder('#F38F26')->helperText('Couleur hexadécimale, ex. #F38F26. Vide = accent choisi ci-dessus. Le texte des boutons s’adapte au contraste.');
            }
            if ($kind === 'digits') {
                $field->regex('/^\d{5,30}$/')->helperText('Chiffres uniquement, sans espace ni « + ».');
            }
            if ($kind === 'ga') {
                $field->regex('/^G-[A-Z0-9]{4,20}$/')->placeholder('G-XXXXXXXXXX')->helperText('Format attendu : G- suivi de lettres majuscules et chiffres.');
            }
            if ($kind === 'ads') {
                $field->regex('/^AW-\d{5,20}$/')->placeholder('AW-123456789')->helperText('Format attendu : AW- suivi de chiffres.');
            }
            if ($kind === 'image') {
                $field->regex('#^/(?:images|storage)/[a-zA-Z0-9_./-]+\.(?:png|jpe?g|webp|avif)$#i')->placeholder('/images/partage.jpg')->helperText('Chemin local commençant par /images/ ou /storage/ (png, jpg, webp, avif).');
            }
            if ($key === 'titleTemplate') {
                $field->regex('/%s/')->required()->helperText('« %s » est remplacé par le titre de chaque page.');
            }
            match ($kind) {
                'toggle', 'disabled' => $toggles[] = $field,
                'secret' => $secrets[] = $field,
                default => $settings[] = $field,
            };
        }

        $components = [];
        if (isset($def['notice'])) {
            $components[] = Callout::make('À savoir')->description($def['notice'])->warning()->columnSpanFull();
        }
        $grid = ['default' => 1, 'lg' => 2];
        if ($toggles !== []) {
            $components[] = Section::make('Activation & affichage')->description('Interrupteurs appliqués au site dès l’enregistrement.')->schema($toggles)->columns($grid)->columnSpanFull();
        }
        if ($settings !== []) {
            $components[] = Section::make('Paramètres')->description('Valeurs utilisées par le site et les intégrations. Laissez vide ce qui ne s’applique pas.')->schema($settings)->columns($grid)->columnSpanFull();
        }
        if ($secrets !== []) {
            $components[] = Section::make('Identifiants confidentiels')->description('Secrets chiffrés : ils ne sont jamais réaffichés. Saisissez une nouvelle valeur uniquement pour la remplacer.')->icon('heroicon-o-lock-closed')->schema($secrets)->columns($grid)->columnSpanFull();
        }

        return $s->components($components)->columns(1);
    }

    /** Extra actions shown on the configuration page header (and, for modal pages, on the table row). */
    public static function connectorActions(): array
    {
        $actions = [];
        if (in_array(static::$configName, ['dynamics', 'aramex', 'analytics_api'])) {
            $actions[] = Action::make('connection')->label('État de la connexion')->icon('heroicon-o-signal')->color('gray')->action(fn () => Notification::make()->title('Non connecté')->body('Adaptateur distant non activé. Aucun appel réseau n’a été effectué.')->warning()->send());
        }
        if (static::$configName === 'aramex') {
            $actions[] = Action::make('shipment')->label('Créer une expédition')->icon('heroicon-o-truck')->color('gray')->disabled()->tooltip('Transporteur non connecté. Aucun suivi fictif.');
        }

        return $actions;
    }

    public static function table(Table $t): Table
    {
        $def = static::definition();
        $actions = [EditAction::make()->label('Configurer')->fillForm(fn (SystemConfig $record) => ['fields' => $record->formValues()])->using(function (SystemConfig $record, array $data) {
            $record->saveForm($data['fields'] ?? []);

            return $record;
        }), ...static::connectorActions()];

        return $t->columns([TextColumn::make('name')->label('Configuration')->formatStateUsing(fn () => $def['label']), TextColumn::make('updated_at')->label('Modifiée')->dateTime('d/m/Y H:i')])->recordActions($actions)->paginated(false);
    }
}
