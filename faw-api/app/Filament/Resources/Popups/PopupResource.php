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
use Filament\Schemas\Schema;
use Filament\Tables\Columns\IconColumn;
use Filament\Tables\Columns\TextColumn;
use Filament\Tables\Table;

class PopupResource extends OwnerResource
{
    protected static ?string $model = Popup::class;

    protected static ?string $slug = 'popups';

    protected static ?string $navigationLabel = 'Popups';

    protected static ?string $modelLabel = 'Popups';

    protected static ?string $pluralModelLabel = 'Popups';

    protected static string|\UnitEnum|null $navigationGroup = 'Marketing & SEO';

    public static function form(Schema $schema): Schema
    {
        return $schema->components([TextInput::make('name')->label('Nom interne')->maxLength(255)->required(), Select::make('kind')->label('Type')->options(['promo' => 'Information / promotion', 'newsletter' => 'Newsletter (consentement explicite)', 'whatsapp' => 'WhatsApp'])->default('promo')->required(), TextInput::make('title')->label('Titre')->maxLength(255)->required(), Textarea::make('body')->label('Texte')->maxLength(12000)->columnSpanFull(), TextInput::make('ctaLabel')->label('Libellé du bouton')->maxLength(255), TextInput::make('ctaUrl')->label('Lien du bouton')->maxLength(255)->regex('#^(?:/(?!/)[^<>]*|https://(?:wa\.me|www\.instagram\.com|www\.linkedin\.com)/[^<>]*)$#'), Select::make('trigger')->label('Déclenchement')->options(['delay' => 'Après attente', 'scroll' => 'Après défilement', 'exit' => 'Intention de sortie'])->default('delay')->required(), TextInput::make('delaySeconds')->label('Attente (secondes)')->maxLength(255)->integer()->minValue(0)->default(8)->required(), TextInput::make('scrollPercent')->label('Défilement (%)')->maxLength(255)->integer()->minValue(1)->maxValue(100)->default(50)->required(), TextInput::make('paths')->label('Chemins concernés (séparés par virgule)')->maxLength(255), Select::make('frequency')->label('Fréquence')->options(['session' => 'Une fois par session', 'days' => 'Une fois sur plusieurs jours'])->default('session')->required(), TextInput::make('frequencyDays')->label('Intervalle (jours)')->maxLength(255)->integer()->minValue(0)->default(7)->required(), DateTimePicker::make('startsAt')->label('Début')->seconds(false), DateTimePicker::make('endsAt')->label('Fin')->seconds(false), Toggle::make('active')->label('Actif')->default(false)])->columns(2);
    }

    public static function table(Table $table): Table
    {
        return $table->columns([TextColumn::make('name')->label('Nom')->searchable(), TextColumn::make('kind')->label('Type'), TextColumn::make('trigger')->label('Déclenchement'), IconColumn::make('active')->label('Actif')->boolean()])->defaultSort('id', 'desc')->recordActions([EditAction::make()->label('Ouvrir'), DeleteAction::make()]);
    }

    public static function getPages(): array
    {
        return ['index' => Pages\ManagePopups::route('/')];
    }
}
