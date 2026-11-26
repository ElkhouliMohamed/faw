<?php

namespace App\Filament\Resources;

use App\Models\Customer;
use App\Models\InboxMessage;
use App\Models\Product;
use App\Models\User;
use Filament\Actions\DeleteAction;
use Filament\Actions\EditAction;
use Filament\Forms\Components\Select;
use Filament\Forms\Components\Textarea;
use Filament\Forms\Components\TextInput;
use Filament\Schemas\Components\View;
use Filament\Schemas\Schema;
use Filament\Tables\Columns\TextColumn;
use Filament\Tables\Filters\SelectFilter;
use Filament\Tables\Table;
use Illuminate\Database\Eloquent\Builder;

abstract class InboxResource extends OwnerResource
{
    protected static ?string $model = InboxMessage::class;

    protected static string|\UnitEnum|null $navigationGroup = 'Communication';

    public static ?string $messageKind = null;

    public static function getEloquentQuery(): Builder
    {
        $q = parent::getEloquentQuery();

        return static::$messageKind ? $q->where('kind', static::$messageKind) : $q;
    }

    public static function form(Schema $s): Schema
    {
        return $s->components([
            Select::make('kind')->label('Origine')->options(['contact' => 'Contact', 'bot' => 'Assistant', 'quote' => 'Demande de devis', 'whatsapp' => 'Clic WhatsApp (envoi non confirmé)', 'ticket' => 'Ticket support', 'sav' => 'Demande SAV'])->default(static::$messageKind ?? 'ticket')->required()->disabledOn('edit')->dehydrated(),
            Select::make('contactId')->label('Client lié')->options(Customer::pluck('name', 'id')->all())->searchable(), TextInput::make('name')->label('Nom')->maxLength(120)->required(), TextInput::make('phone')->label('Téléphone')->maxLength(40), TextInput::make('email')->label('Email')->email()->maxLength(160), TextInput::make('city')->label('Ville')->maxLength(80), TextInput::make('subject')->label('Sujet')->required()->maxLength(200), Textarea::make('message')->label('Message reçu')->required()->maxLength(8000)->columnSpanFull(), Select::make('productId')->label('Produit')->options(Product::pluck('title', 'id')->all())->searchable(), Select::make('status')->label('Statut')->options(['nouveau' => 'Nouveau', 'en cours' => 'En cours', 'attente client' => 'En attente client', 'résolu' => 'Résolu', 'classé' => 'Classé'])->default('nouveau')->required(), Select::make('priority')->label('Priorité')->options(['basse' => 'Basse', 'normale' => 'Normale', 'haute' => 'Haute', 'urgente' => 'Urgente'])->default('normale')->required(), Select::make('assignedTo')->label('Attribué à')->options(User::pluck('name', 'id')->all())->searchable(), Textarea::make('notes')->label('Notes internes')->maxLength(12000)->columnSpanFull(), View::make('filament.forms.private-photos')->visible(fn ($record) => $record && count($record->photos ?? []) > 0),
        ])->columns(2);
    }

    public static function table(Table $t): Table
    {
        return $t->columns([TextColumn::make('created_at')->label('Reçu le')->dateTime('d/m/Y H:i')->sortable(), TextColumn::make('kind')->label('Origine')->badge(), TextColumn::make('name')->label('Client')->searchable(), TextColumn::make('subject')->label('Sujet')->searchable()->wrap(), TextColumn::make('status')->label('Statut')->badge(), TextColumn::make('priority')->label('Priorité'), TextColumn::make('assignedTo')->label('Assignation')->formatStateUsing(fn ($state) => User::find($state)?->name ?? '—')])->defaultSort('created_at', 'desc')->filters([SelectFilter::make('status')->label('Statut')->options(['nouveau' => 'Nouveau', 'en cours' => 'En cours', 'attente client' => 'En attente client', 'résolu' => 'Résolu', 'classé' => 'Classé'])])->recordActions([EditAction::make()->label('Ouvrir'), DeleteAction::make()]);
    }
}
