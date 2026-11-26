<?php

namespace App\Filament\Resources\ShopOrders;

use App\Filament\Resources\OwnerResource;
use App\Models\ShopOrder;
use Filament\Actions\EditAction;
use Filament\Forms\Components\Select;
use Filament\Forms\Components\Textarea;
use Filament\Forms\Components\TextInput;
use Filament\Schemas\Schema;
use Filament\Tables\Columns\TextColumn;
use Filament\Tables\Table;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Facades\DB;

class ShopOrderResource extends OwnerResource
{
    protected static ?string $model = ShopOrder::class;

    protected static ?string $navigationLabel = 'Commandes / demandes';

    protected static ?string $modelLabel = 'Commandes / demandes';

    protected static ?string $pluralModelLabel = 'Commandes / demandes';

    protected static string|\UnitEnum|null $navigationGroup = 'Ventes';

    public static function canCreate(): bool
    {
        return false;
    }

    public static function canDelete(Model $record): bool
    {
        return false;
    }

    public static function form(Schema $schema): Schema
    {
        return $schema->components([TextInput::make('number')->label('Référence')->maxLength(255)->disabled(), TextInput::make('customerName')->label('Client')->maxLength(255)->disabled(), TextInput::make('phone')->label('Téléphone')->maxLength(255)->disabled(), TextInput::make('email')->label('Email')->maxLength(255)->disabled(), TextInput::make('city')->label('Ville')->maxLength(255)->disabled(), Textarea::make('address')->label('Adresse')->maxLength(5000)->columnSpanFull()->disabled(), Select::make('status')->label('Statut')->options(['nouveau' => 'Nouveau', 'à contacter' => 'À contacter', 'en cours' => 'En cours', 'devis envoyé' => 'Devis envoyé', 'confirmé' => 'Confirmé', 'livré' => 'Livré', 'annulé' => 'Annulé'])->required(), TextInput::make('total')->label('Total TTC (DH)')->maxLength(255)->disabled(), TextInput::make('paymentMethod')->label('Paiement')->maxLength(255)->disabled(), Textarea::make('deliveryNote')->label('Transport')->maxLength(5000)->columnSpanFull()->disabled(), Textarea::make('quoteRefusal')->label('Contrôles équipe')->maxLength(5000)->columnSpanFull()->disabled(), Textarea::make('notes')->label('Notes équipe')->maxLength(5000)->columnSpanFull(), Textarea::make('line_details')->label('Articles')->formatStateUsing(fn ($record) => $record ? DB::table('OrderItem')->where('orderId', $record->id)->get()->map(fn ($l) => $l->quantity.' × '.$l->title.' — '.$l->lineTotal.' DH TTC')->implode("\n") : '')->disabled()->dehydrated(false)->columnSpanFull()])->columns(2);
    }

    public static function table(Table $table): Table
    {
        return $table->columns([TextColumn::make('number')->label('Référence')->searchable(), TextColumn::make('customerName')->label('Client')->searchable(), TextColumn::make('status')->label('Statut')->badge(), TextColumn::make('total')->label('Total')->suffix(' DH TTC')->sortable(), TextColumn::make('createdAt')->label('Date')->dateTime('d/m/Y H:i')->sortable()])->defaultSort('createdAt', 'desc')->recordActions([EditAction::make()->label('Ouvrir')]);
    }

    public static function getPages(): array
    {
        return ['index' => Pages\ManageShopOrders::route('/')];
    }
}
