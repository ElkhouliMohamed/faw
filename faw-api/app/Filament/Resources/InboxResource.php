<?php

namespace App\Filament\Resources;

use App\Models\Customer;
use App\Models\InboxMessage;
use App\Models\Product;
use App\Models\User;
use Filament\Actions\DeleteAction;
use Filament\Actions\EditAction;
use Filament\Actions\ViewAction;
use Filament\Forms\Components\Select;
use Filament\Forms\Components\Textarea;
use Filament\Forms\Components\TextInput;
use Filament\Schemas\Components\Grid;
use Filament\Schemas\Components\Group;
use Filament\Schemas\Components\Section;
use Filament\Schemas\Components\View;
use Filament\Schemas\Schema;
use Filament\Tables\Columns\TextColumn;
use Filament\Tables\Filters\SelectFilter;
use Filament\Tables\Table;
use Illuminate\Database\Eloquent\Builder;

/**
 * Shared inbox resource (team inbox, contacts, tickets, SAV), scoped by InboxMessage.kind.
 *
 * Row click opens the read-only view page when the subclass registers one,
 * otherwise the edit page; legacy Manage pages keep working with modals.
 */
abstract class InboxResource extends OwnerResource
{
    protected static ?string $model = InboxMessage::class;

    protected static string|\UnitEnum|null $navigationGroup = 'Communication';

    public static ?string $messageKind = null;

    /** @return array<string, string> */
    public static function kindOptions(): array
    {
        return ['contact' => 'Contact', 'bot' => 'Assistant', 'quote' => 'Demande de devis', 'whatsapp' => 'Clic WhatsApp (envoi non confirmé)', 'ticket' => 'Ticket support', 'sav' => 'Demande SAV'];
    }

    /** @return array<string, string> */
    public static function statusOptions(): array
    {
        return ['nouveau' => 'Nouveau', 'en cours' => 'En cours', 'attente client' => 'En attente client', 'résolu' => 'Résolu', 'classé' => 'Classé'];
    }

    /** @return array<string, string> */
    public static function priorityOptions(): array
    {
        return ['basse' => 'Basse', 'normale' => 'Normale', 'haute' => 'Haute', 'urgente' => 'Urgente'];
    }

    public static function getEloquentQuery(): Builder
    {
        $q = parent::getEloquentQuery();

        return static::$messageKind ? $q->where('kind', static::$messageKind) : $q;
    }

    public static function form(Schema $s): Schema
    {
        $grid = ['default' => 1, 'lg' => 2];

        return $s->components([
            Grid::make(['default' => 1, 'lg' => 3])->schema([
                Group::make([
                    Section::make('Demande')
                        ->description('Ce que le client a envoyé.')
                        ->schema([
                            Select::make('kind')->label('Origine')->options(static::kindOptions())->default(static::$messageKind ?? 'ticket')->required()->disabledOn('edit')->dehydrated()->native(false)->helperText('Canal par lequel la demande est arrivée. Non modifiable après création.'),
                            TextInput::make('subject')->label('Sujet')->required()->maxLength(200),
                            Textarea::make('message')->label('Message reçu')->required()->maxLength(8000)->rows(6)->columnSpanFull(),
                            Select::make('productId')->label('Produit')->options(fn () => Product::pluck('title', 'id')->all())->searchable()->helperText('Produit concerné, si la demande en cite un.'),
                            View::make('filament.forms.private-photos')->visible(fn ($record) => $record && count($record->photos ?? []) > 0)->columnSpanFull(),
                        ])->columns($grid),
                    Section::make('Client')
                        ->description('Coordonnées pour recontacter le client.')
                        ->schema([
                            TextInput::make('name')->label('Nom')->maxLength(120)->required(),
                            Select::make('contactId')->label('Client lié')->options(fn () => Customer::pluck('name', 'id')->all())->searchable()->helperText('Rattache la demande à une fiche client existante.'),
                            TextInput::make('phone')->label('Téléphone')->maxLength(40),
                            TextInput::make('email')->label('Email')->email()->maxLength(160),
                            TextInput::make('city')->label('Ville')->maxLength(80),
                        ])->columns($grid),
                ])->columnSpan(['default' => 1, 'lg' => 2]),
                Section::make('Traitement')
                    ->description('Suivi interne, invisible pour le client.')
                    ->schema([
                        Select::make('status')->label('Statut')->options(static::statusOptions())->default('nouveau')->required()->native(false),
                        Select::make('priority')->label('Priorité')->options(static::priorityOptions())->default('normale')->required()->native(false),
                        Select::make('assignedTo')->label('Attribué à')->options(fn () => User::pluck('name', 'id')->all())->searchable()->helperText('Membre de l’équipe en charge de la réponse.'),
                        Textarea::make('notes')->label('Notes internes')->maxLength(12000)->rows(6),
                    ])->columnSpan(['default' => 1, 'lg' => 1]),
            ])->columnSpanFull(),
        ])->columns(1);
    }

    public static function table(Table $t): Table
    {
        $filters = [
            SelectFilter::make('status')->label('Statut')->options(static::statusOptions()),
            SelectFilter::make('priority')->label('Priorité')->options(static::priorityOptions()),
        ];
        if (! static::$messageKind) {
            $filters[] = SelectFilter::make('kind')->label('Origine')->options(static::kindOptions());
        }

        return $t->columns([
            TextColumn::make('created_at')->label('Reçu le')->dateTime('d/m/Y H:i')->sortable(),
            TextColumn::make('kind')->label('Origine')->badge()->formatStateUsing(fn (?string $state) => static::kindOptions()[$state] ?? $state),
            TextColumn::make('name')->label('Client')->searchable()->sortable()->description(fn (InboxMessage $record) => $record->phone ?: $record->email),
            TextColumn::make('subject')->label('Sujet')->searchable()->wrap(),
            TextColumn::make('status')->label('Statut')->badge()->sortable(),
            TextColumn::make('priority')->label('Priorité')->sortable(),
            TextColumn::make('assignedTo')->label('Assignation')->formatStateUsing(fn ($state) => User::find($state)?->name ?? '—'),
        ])
            ->defaultSort('created_at', 'desc')
            ->filters($filters)
            ->recordActions([
                ViewAction::make()->label('Consulter'),
                EditAction::make()->label('Traiter'),
                DeleteAction::make(),
            ]);
    }
}
