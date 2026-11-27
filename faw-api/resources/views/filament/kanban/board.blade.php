{{-- Kanban board shared by « Commandes — Tableau » and « Devis — Tableau ». Drag & drop: SortableJS (bundled with Filament, CDN fallback). --}}
@php
    $columns = $this->board();
    $canMove = $this->canMove();
    $sources = $this->sources();
    $cities = $this->cityOptions();
    $payments = $this->hasPaymentFilter() ? $this->paymentOptions() : [];
    $hasFilters = $this->search !== '' || $this->city !== '' || $this->payment !== '' || $this->from !== '' || $this->to !== '';
@endphp

<x-filament-panels::page>
    <style>
        .faw-kb-filters { display: grid; gap: .75rem; grid-template-columns: repeat(auto-fit, minmax(10rem, 1fr)); align-items: end; }
        .faw-kb-filters label { display: block; font-size: .75rem; font-weight: 600; margin-bottom: .25rem; opacity: .8; }
        .faw-kb-board { display: flex; gap: 1rem; overflow-x: auto; padding-bottom: 1rem; scroll-snap-type: x proximity; -webkit-overflow-scrolling: touch; }
        .faw-kb-col { flex: 0 0 17.5rem; max-width: 85vw; display: flex; flex-direction: column; border-radius: .75rem; background: #f5f1eb; border: 1px solid #ece4da; scroll-snap-align: start; }
        .dark .faw-kb-col { background: rgba(255,255,255,.04); border-color: rgba(255,255,255,.1); }
        .faw-kb-col.is-locked { opacity: .92; }
        .faw-kb-head { display: flex; align-items: center; justify-content: space-between; gap: .5rem; padding: .75rem .75rem .5rem; font-weight: 600; font-size: .875rem; }
        .faw-kb-list { flex: 1; display: flex; flex-direction: column; gap: .5rem; padding: 0 .5rem .5rem; min-height: 6rem; }
        .faw-kb-card { position: relative; background: #fff; border: 1px solid #ece4da; border-radius: .6rem; padding: .6rem .7rem; font-size: .8125rem; line-height: 1.35; cursor: grab; touch-action: manipulation; }
        .dark .faw-kb-card { background: rgb(24 24 27); border-color: rgba(255,255,255,.1); }
        .faw-kb-card:hover { border-color: #f38f26; }
        .faw-kb-card.faw-locked { cursor: pointer; }
        .faw-kb-card a.faw-kb-title { font-weight: 700; color: inherit; text-decoration: none; }
        .faw-kb-card a.faw-kb-title::after { content: ""; position: absolute; inset: 0; border-radius: .6rem; }
        .faw-kb-card a.faw-kb-title:focus-visible { outline: none; }
        .faw-kb-card a.faw-kb-title:focus-visible::after { outline: 2px solid #f38f26; outline-offset: 2px; }
        .faw-kb-row { display: flex; justify-content: space-between; gap: .5rem; }
        .faw-kb-muted { opacity: .7; }
        .faw-kb-amount { font-weight: 700; white-space: nowrap; }
        .faw-kb-move { position: relative; z-index: 1; margin-top: .4rem; width: 100%; font-size: .75rem; border-radius: .4rem; border: 1px solid #ece4da; background: transparent; padding: .15rem .3rem; }
        .dark .faw-kb-move { border-color: rgba(255,255,255,.15); }
        .faw-kb-empty { font-size: .75rem; opacity: .6; padding: .25rem .75rem .75rem; }
        .faw-kb-more { font-size: .75rem; padding: 0 .75rem .75rem; }
        .faw-kb-ghost { opacity: .4; }
        .faw-kb-list.faw-kb-over { outline: 2px dashed #f38f26; outline-offset: -4px; border-radius: .6rem; }
    </style>

    @if ($sources !== [])
        <x-filament::tabs label="Type de commandes">
            @foreach ($sources as $key => $label)
                <x-filament::tabs.item :active="$this->source === $key" wire:click="$set('source', '{{ $key }}')">
                    {{ $label }}
                </x-filament::tabs.item>
            @endforeach
        </x-filament::tabs>
    @endif

    <x-filament::section compact>
        <div class="faw-kb-filters">
            <div>
                <label for="kb-search">Recherche</label>
                <x-filament::input.wrapper prefix-icon="heroicon-m-magnifying-glass">
                    <x-filament::input id="kb-search" type="search" placeholder="N°, client, téléphone…" wire:model.live.debounce.400ms="search" />
                </x-filament::input.wrapper>
            </div>
            <div>
                <label for="kb-city">Ville</label>
                <x-filament::input.wrapper>
                    <x-filament::input.select id="kb-city" wire:model.live="city">
                        <option value="">Toutes les villes</option>
                        @foreach ($cities as $value => $label)
                            <option value="{{ $value }}">{{ $label }}</option>
                        @endforeach
                    </x-filament::input.select>
                </x-filament::input.wrapper>
            </div>
            @if ($this->hasPaymentFilter())
                <div>
                    <label for="kb-payment">Mode de paiement</label>
                    <x-filament::input.wrapper>
                        <x-filament::input.select id="kb-payment" wire:model.live="payment">
                            <option value="">Tous</option>
                            @foreach ($payments as $value => $label)
                                <option value="{{ $value }}">{{ $label }}</option>
                            @endforeach
                        </x-filament::input.select>
                    </x-filament::input.wrapper>
                </div>
            @endif
            <div>
                <label for="kb-from">Du</label>
                <x-filament::input.wrapper>
                    <x-filament::input id="kb-from" type="date" wire:model.live="from" />
                </x-filament::input.wrapper>
            </div>
            <div>
                <label for="kb-to">Au</label>
                <x-filament::input.wrapper>
                    <x-filament::input id="kb-to" type="date" wire:model.live="to" />
                </x-filament::input.wrapper>
            </div>
            <div style="display:flex;gap:.5rem;flex-wrap:wrap">
                @if ($hasFilters)
                    <x-filament::button color="gray" size="sm" wire:click="resetFilters" icon="heroicon-m-x-mark">Effacer les filtres</x-filament::button>
                @endif
                <x-filament::button color="gray" size="sm" tag="a" :href="$this->listUrl()" icon="heroicon-m-list-bullet">Vue liste</x-filament::button>
            </div>
        </div>
        @unless ($canMove)
            <p style="font-size:.75rem;margin-top:.75rem;opacity:.75">Lecture seule : votre rôle ne permet pas de déplacer les cartes.</p>
        @endunless
    </x-filament::section>

    <div class="faw-kb-board" wire:key="faw-kb-{{ $sources !== [] ? $this->source : 'devis' }}" wire:loading.class="opacity-70" wire:target="search,city,payment,from,to,source,resetFilters">
        @foreach ($columns as $column)
            <section class="faw-kb-col {{ $column['droppable'] ? '' : 'is-locked' }}" wire:key="col-{{ md5($column['key']) }}" aria-label="{{ $column['label'] }}">
                <header class="faw-kb-head">
                    <span>{{ $column['label'] }}</span>
                    <x-filament::badge :color="$column['color']" size="sm">{{ $column['count'] }}</x-filament::badge>
                </header>
                <div class="faw-kb-list" data-kanban-list data-column="{{ $column['key'] }}" data-droppable="{{ $column['droppable'] ? '1' : '0' }}">
                    @foreach ($column['cards'] as $card)
                        <article class="faw-kb-card {{ ! $canMove || $card['locked'] ? 'faw-locked' : '' }}" data-card-id="{{ $card['id'] }}" wire:key="card-{{ md5($column['key']) }}-{{ $card['id'] }}">
                            <div class="faw-kb-row">
                                <a class="faw-kb-title" href="{{ $card['url'] }}" draggable="false">{{ $card['title'] }}</a>
                                <span class="faw-kb-muted" title="Ancienneté">{{ $card['age'] }}</span>
                            </div>
                            <div>{{ $card['subtitle'] }}</div>
                            <div class="faw-kb-row">
                                <span class="faw-kb-muted">{{ $card['city'] ?: '—' }}</span>
                                <span class="faw-kb-amount">{{ $card['amount'] }}</span>
                            </div>
                            <div class="faw-kb-muted">{{ $card['meta'] }}</div>
                            @if ($canMove && ! $card['locked'])
                                <select class="faw-kb-move" aria-label="Déplacer {{ $card['title'] }} vers" x-on:change="if ($event.target.value) { $wire.moveCard(@js($card['id']), $event.target.value); $event.target.value = '' }">
                                    <option value="">Déplacer vers…</option>
                                    @foreach ($columns as $target)
                                        @if ($target['droppable'] && $target['key'] !== $column['key'])
                                            <option value="{{ $target['key'] }}">{{ $target['label'] }}</option>
                                        @endif
                                    @endforeach
                                </select>
                            @endif
                        </article>
                    @endforeach
                </div>
                @if ($column['cards'] === [])
                    <p class="faw-kb-empty">Aucune carte.</p>
                @elseif ($column['count'] > count($column['cards']))
                    <p class="faw-kb-more">+ {{ $column['count'] - count($column['cards']) }} autres — <a href="{{ $this->listUrl() }}" style="text-decoration:underline">voir la liste</a></p>
                @endif
            </section>
        @endforeach
    </div>

    @script
    <script>
        const canMove = @js($canMove);
        const setup = () => {
            if (!canMove || !window.Sortable) return;
            $wire.$el.querySelectorAll('[data-kanban-list]').forEach((list) => {
                if (list._fawSortable) return;
                list._fawSortable = window.Sortable.create(list, {
                    group: { name: 'faw-kanban', pull: true, put: () => list.dataset.droppable === '1' },
                    draggable: '.faw-kb-card',
                    filter: '.faw-locked, select',
                    preventOnFilter: false,
                    animation: 150,
                    delay: 180,
                    delayOnTouchOnly: true,
                    ghostClass: 'faw-kb-ghost',
                    onMove: (evt) => {
                        document.querySelectorAll('.faw-kb-over').forEach((el) => el.classList.remove('faw-kb-over'));
                        evt.to.classList.add('faw-kb-over');
                    },
                    onEnd: (evt) => {
                        document.querySelectorAll('.faw-kb-over').forEach((el) => el.classList.remove('faw-kb-over'));
                        const id = evt.item.dataset.cardId;
                        const from = evt.from.dataset.column;
                        const to = evt.to.dataset.column;
                        // Put the card back: the server decides and re-renders the board.
                        evt.item.remove();
                        evt.from.insertBefore(evt.item, evt.from.children[evt.oldIndex] ?? null);
                        if (to && from !== to) {
                            $wire.moveCard(id, to);
                        }
                    },
                });
            });
        };
        const ready = () => {
            setup();
            Livewire.hook('commit', ({ component, succeed }) => {
                if (component.id === $wire.$id) succeed(() => setTimeout(setup, 0));
            });
        };
        if (window.Sortable) {
            ready();
        } else {
            const s = document.createElement('script');
            s.src = 'https://cdn.jsdelivr.net/npm/sortablejs@1.15.2/Sortable.min.js';
            s.onload = ready;
            document.head.appendChild(s);
        }
    </script>
    @endscript
</x-filament-panels::page>
