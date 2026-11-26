<?php

namespace App\Console\Commands;

use App\Models\InboxMessage;
use App\Models\Quote;
use App\Models\ShopOrder;
use Illuminate\Console\Command;

class SyncInbox extends Command
{
    protected $signature = 'faw:sync-inbox';

    protected $description = 'Rapproche les devis et demandes assistant existants avec la boîte équipe, sans envoi';

    public function handle(): int
    {
        $count = 0;
        foreach (Quote::cursor() as $q) {
            $m = InboxMessage::firstOrCreate(['quoteId' => $q->id], ['kind' => 'quote', 'contactId' => $q->contactId, 'name' => $q->clientName, 'phone' => $q->phone, 'email' => $q->email, 'city' => $q->city, 'subject' => 'Demande de devis', 'message' => $q->note ?: 'Demande existante — voir le module Devis.']);
            $count += (int) $m->wasRecentlyCreated;
        }
        foreach (ShopOrder::where('origin', 'bot')->cursor() as $o) {
            $m = InboxMessage::firstOrCreate(['kind' => 'bot', 'subject' => 'Demande assistant — '.$o->number], ['contactId' => $o->contactId, 'name' => $o->customerName, 'phone' => $o->phone, 'email' => $o->email, 'city' => $o->city, 'message' => $o->notes ?: 'Demande assistant existante.']);
            $count += (int) $m->wasRecentlyCreated;
        }
        $this->info($count.' entrées rapprochées, aucun message envoyé.');

        return 0;
    }
}
