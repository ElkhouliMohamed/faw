<?php

namespace App\Filament\Resources\AuditLogs;

use App\Filament\Resources\OwnerResource;
use App\Models\AuditEntry;
use Filament\Actions\ViewAction;
use Filament\Infolists\Components\TextEntry;
use Filament\Schemas\Components\Section;
use Filament\Schemas\Schema;
use Filament\Tables\Columns\TextColumn;
use Filament\Tables\Filters\SelectFilter;
use Filament\Tables\Table;
use Illuminate\Database\Eloquent\Model;

class AuditLogResource extends OwnerResource
{
    protected static ?string $model = AuditEntry::class;

    protected static ?string $navigationLabel = 'Journal d’activité';

    protected static ?string $modelLabel = 'Événement';

    protected static ?string $pluralModelLabel = 'Journal d’activité';

    protected static ?string $slug = 'audit-log';

    protected static string|\UnitEnum|null $navigationGroup = 'Système';

    protected static ?int $navigationSort = 90;

    public static function canCreate(): bool
    {
        return false;
    }

    public static function canEdit(Model $record): bool
    {
        return false;
    }

    public static function canDelete(Model $record): bool
    {
        return false;
    }

    /** Integer ids only: a URL such as /audit-log/create answers 404 instead of a PostgreSQL cast error (500). */
    public static function resolveRecordRouteBinding(int|string $key, ?\Closure $modifyQuery = null): ?Model
    {
        return ctype_digit((string) $key) ? parent::resolveRecordRouteBinding($key, $modifyQuery) : null;
    }

    /** Read-only detail page: the journal can never be edited or deleted from the back office. */
    public static function infolist(Schema $schema): Schema
    {
        $grid = ['default' => 1, 'lg' => 2];

        return $schema->components([
            Section::make('Événement')
                ->description('Qui a fait quoi, et quand.')
                ->schema([
                    TextEntry::make('at')->label('Quand')->dateTime('d/m/Y H:i:s'),
                    TextEntry::make('actor')->label('Qui')->placeholder('Système'),
                    TextEntry::make('action')->label('Action')->badge(),
                    TextEntry::make('entity')->label('Modèle'),
                    TextEntry::make('entityId')->label('Identifiant')->placeholder('—')->copyable(),
                    TextEntry::make('summary')->label('Résumé')->placeholder('—')->columnSpanFull(),
                ])->columns($grid),
            Section::make('Modifications')
                ->description('Valeurs enregistrées. Les secrets (mots de passe, clés) sont masqués.')
                ->schema([
                    TextEntry::make('changes')->label('Détail')->hiddenLabel()->placeholder('Aucune modification enregistrée.')
                        ->formatStateUsing(function ($state) {
                            $decoded = is_string($state) ? json_decode($state, true) : null;

                            return is_array($decoded) ? json_encode($decoded, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES) : $state;
                        })
                        ->fontFamily('mono')->extraAttributes(['class' => 'whitespace-pre-wrap break-all'])->columnSpanFull(),
                ]),
        ])->columns(1);
    }

    public static function table(Table $table): Table
    {
        return $table
            ->columns([
                TextColumn::make('at')->label('Quand')->dateTime('d/m/Y H:i:s')->sortable(),
                TextColumn::make('actor')->label('Qui')->searchable(),
                TextColumn::make('action')->label('Action')->badge(),
                TextColumn::make('entity')->label('Modèle')->searchable(),
                TextColumn::make('entityId')->label('Identifiant')->toggleable(),
                TextColumn::make('summary')->label('Résumé')->wrap()->limit(80)->toggleable(),
                TextColumn::make('changes')->label('Modifications')->wrap()->limit(200)->toggleable(),
            ])
            ->defaultSort('id', 'desc')
            ->filters([
                SelectFilter::make('action')->label('Action')->options(['created' => 'Création', 'updated' => 'Modification', 'deleted' => 'Suppression']),
                SelectFilter::make('entity')->label('Modèle')->options(fn () => AuditEntry::query()->distinct()->orderBy('entity')->pluck('entity', 'entity')->filter()->all())->searchable(),
            ])
            ->recordActions([ViewAction::make()->label('Détail')])
            ->toolbarActions([])
            ->paginated([25, 50]);
    }

    public static function getPages(): array
    {
        return [
            'index' => Pages\ListAuditLogs::route('/'),
            'view' => Pages\ViewAuditLog::route('/{record}'),
        ];
    }
}
