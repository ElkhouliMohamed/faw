<?php

namespace App\Filament\Resources\Popups;

use App\Filament\Resources\OwnerResource;
use App\Models\Popup;
use Filament\Actions\DeleteAction;
use Filament\Actions\EditAction;
use Filament\Forms\Components\DateTimePicker;
use Filament\Forms\Components\Select;
use Filament\Forms\Components\Textarea;
use Filament\Forms\Components\TextInput;
use Filament\Forms\Components\Toggle;
use Filament\Schemas\Components\Section;
use Filament\Schemas\Components\Tabs;
use Filament\Schemas\Components\Tabs\Tab;
use Filament\Schemas\Schema;
use Filament\Tables\Columns\IconColumn;
use Filament\Tables\Columns\TextColumn;
use Filament\Tables\Filters\SelectFilter;
use Filament\Tables\Filters\TernaryFilter;
use Filament\Tables\Table;

class PopupResource extends OwnerResource
{
    protected static ?string $model = Popup::class;

    protected static ?string $slug = 'popups';

    protected static ?string $navigationLabel = 'Popups';

    protected static ?string $modelLabel = 'popup';

    protected static ?string $pluralModelLabel = 'Popups';

    protected static ?string $recordTitleAttribute = 'name';

    protected static string|\UnitEnum|null $navigationGroup = 'Marketing & SEO';

    public static function form(Schema $schema): Schema
    {
        $grid = ['default' => 1, 'lg' => 2];

        return $schema->components([
            Tabs::make('Popup')->tabs([
                Tab::make('Contenu')->icon('heroicon-o-chat-bubble-left-right')->schema([
                    Section::make('Message affiché')
                        ->description('Ce que le visiteur voit dans la fenêtre.')
                        ->schema([
                            TextInput::make('name')->label('Nom interne')->maxLength(255)->required()
                                ->helperText('Visible uniquement dans le back-office.'),
                            Select::make('kind')->label('Type')->options(['promo' => 'Information / promotion', 'newsletter' => 'Newsletter (consentement explicite)', 'whatsapp' => 'WhatsApp'])->default('promo')->required(),
                            TextInput::make('title')->label('Titre')->maxLength(255)->required()->columnSpanFull(),
                            Textarea::make('body')->label('Texte')->maxLength(12000)->rows(4)->columnSpanFull(),
                        ])->columns($grid),
                    Section::make('Bouton')
                        ->description('Facultatif : un bouton d’action sous le texte.')
                        ->schema([
                            TextInput::make('ctaLabel')->label('Libellé du bouton')->maxLength(255)->placeholder('Demander un devis'),
                            TextInput::make('ctaUrl')->label('Lien du bouton')->maxLength(255)->regex('#^(?:/(?!/)[^<>]*|https://(?:wa\.me|www\.instagram\.com|www\.linkedin\.com)/[^<>]*)$#')
                                ->helperText('Chemin interne (ex. : /devis) ou lien wa.me, Instagram ou LinkedIn en https.'),
                        ])->columns($grid),
                ]),
                Tab::make('Affichage')->icon('heroicon-o-cursor-arrow-rays')->schema([
                    Section::make('Déclenchement')
                        ->description('Quand et où la fenêtre s’ouvre.')
                        ->schema([
                            Select::make('trigger')->label('Déclenchement')->options(['delay' => 'Après attente', 'scroll' => 'Après défilement', 'exit' => 'Intention de sortie'])->default('delay')->required(),
                            TextInput::make('paths')->label('Chemins concernés (séparés par virgule)')->maxLength(255)
                                ->placeholder('/produits, /portes-coupe-feu')->helperText('Laissez vide pour afficher sur tout le site.'),
                            TextInput::make('delaySeconds')->label('Attente (secondes)')->maxLength(255)->integer()->minValue(0)->default(8)->required()
                                ->helperText('Utilisé avec « Après attente ».'),
                            TextInput::make('scrollPercent')->label('Défilement (%)')->maxLength(255)->integer()->minValue(1)->maxValue(100)->default(50)->required()
                                ->helperText('Utilisé avec « Après défilement ».'),
                        ])->columns($grid),
                    Section::make('Fréquence')
                        ->description('Évite de montrer la fenêtre trop souvent au même visiteur.')
                        ->schema([
                            Select::make('frequency')->label('Fréquence')->options(['session' => 'Une fois par session', 'days' => 'Une fois sur plusieurs jours'])->default('session')->required(),
                            TextInput::make('frequencyDays')->label('Intervalle (jours)')->maxLength(255)->integer()->minValue(0)->default(7)->required()
                                ->helperText('Utilisé avec « Une fois sur plusieurs jours ».'),
                        ])->columns($grid),
                ]),
                Tab::make('Publication')->icon('heroicon-o-calendar-days')->schema([
                    Section::make('Période et activation')
                        ->description('Laissez les dates vides pour une popup sans limite dans le temps.')
                        ->schema([
                            DateTimePicker::make('startsAt')->label('Début')->seconds(false),
                            DateTimePicker::make('endsAt')->label('Fin')->seconds(false),
                            Toggle::make('active')->label('Actif')->default(false),
                        ])->columns($grid),
                ]),
            ])->persistTabInQueryString()->columnSpanFull(),
        ])->columns(1);
    }

    public static function table(Table $table): Table
    {
        return $table->columns([
            TextColumn::make('name')->label('Nom')->searchable()->sortable()->weight('bold'),
            TextColumn::make('kind')->label('Type')->badge(),
            TextColumn::make('trigger')->label('Déclenchement'),
            TextColumn::make('endsAt')->label('Fin')->dateTime('d/m/Y H:i')->sortable()->placeholder('—')->toggleable(),
            IconColumn::make('active')->label('Actif')->boolean(),
        ])->defaultSort('id', 'desc')
            ->filters([
                TernaryFilter::make('active')->label('Actif'),
                SelectFilter::make('kind')->label('Type')->options(['promo' => 'Information / promotion', 'newsletter' => 'Newsletter', 'whatsapp' => 'WhatsApp']),
            ])
            ->recordActions([EditAction::make()->label('Ouvrir'), DeleteAction::make()]);
    }

    public static function getPages(): array
    {
        return [
            'index' => Pages\ListPopups::route('/'),
            'create' => Pages\CreatePopup::route('/create'),
            'edit' => Pages\EditPopup::route('/{record}/edit'),
        ];
    }
}
