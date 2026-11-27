<?php

namespace App\Filament\Pages\Concerns;

use App\Models\User;
use Carbon\CarbonImmutable;
use Filament\Notifications\Notification;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Validation\ValidationException;
use Livewire\Attributes\Url;

/**
 * Shared state and helpers for the Kanban pages (filters, card formatting, notifications).
 * Each page provides board(): the columns with their cards, and moveCard(): the validated status change.
 */
trait HasKanbanBoard
{
    /** Cards rendered per column (the list page shows the rest). */
    public const CARDS_PER_COLUMN = 50;

    #[Url(except: '')]
    public string $search = '';

    #[Url(except: '')]
    public string $city = '';

    #[Url(except: '')]
    public string $payment = '';

    #[Url(except: '')]
    public string $from = '';

    #[Url(except: '')]
    public string $to = '';

    public function resetFilters(): void
    {
        $this->reset(['search', 'city', 'payment', 'from', 'to']);
    }

    protected function currentUser(): ?User
    {
        $u = auth()->user();

        return $u instanceof User ? $u : null;
    }

    /** Case-insensitive "contains" search over several columns (PostgreSQL-safe quoting of camelCase columns). */
    protected function applySearch(Builder $query, array $columns): void
    {
        $term = trim($this->search);
        if ($term === '') {
            return;
        }
        $like = '%'.str_replace(['\\', '%', '_'], ['\\\\', '\\%', '\\_'], mb_strtolower(mb_substr($term, 0, 100))).'%';
        $grammar = $query->getQuery()->getGrammar();
        $query->where(function (Builder $w) use ($columns, $like, $grammar) {
            foreach ($columns as $col) {
                $w->orWhereRaw('LOWER(CAST('.$grammar->wrap($col).' AS TEXT)) LIKE ?', [$like]);
            }
        });
    }

    /** Date range on the business day in Casablanca. $ms: column stores epoch milliseconds (legacy shop tables). */
    protected function applyDateRange(Builder $query, string $column, bool $ms): void
    {
        foreach (['from' => '>=', 'to' => '<='] as $prop => $op) {
            $value = trim($this->{$prop});
            if ($value === '' || ! preg_match('/^\d{4}-\d{2}-\d{2}$/', $value)) {
                continue;
            }
            try {
                $day = CarbonImmutable::createFromFormat('Y-m-d', $value, 'Africa/Casablanca');
            } catch (\Throwable) {
                continue;
            }
            $bound = $prop === 'from' ? $day->startOfDay() : $day->endOfDay();
            $query->where($column, $op, $ms ? $bound->getTimestampMs() : $bound->utc());
        }
    }

    protected static function money(int|float|string|null $amount): string
    {
        return number_format((float) $amount, 0, ',', ' ').' MAD';
    }

    protected static function age(?\DateTimeInterface $at): string
    {
        return $at ? CarbonImmutable::instance($at)->locale('fr')->diffForHumans(short: true) : '—';
    }

    protected function notifyRefused(ValidationException|string $e): void
    {
        $body = is_string($e) ? $e : collect($e->errors())->flatten()->implode(' ; ');
        Notification::make()->title('Déplacement refusé')->body($body)->danger()->send();
    }
}
