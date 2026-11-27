<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Hybrid pricing + online checkout (additive).
 *  - Product.salesMode becomes the real « Achat en ligne / Sur devis » switch. It had no effect until now, so existing
 *    products keep today's behaviour (« direct »: buyable whenever prices are shown on the site). The global
 *    « prices hidden » setting stays the master switch.
 *  - Product.maxOnlineQty: optional quantity above which the cart proposes a quote.
 *  - Order (site orders): payment status, client type, city slug and the CGV acceptance.
 *  - payments / payment_transactions can belong to a site order (shop_order_id) as well as a customer order.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('Product', function (Blueprint $t) {
            if (! Schema::hasColumn('Product', 'maxOnlineQty')) {
                $t->integer('maxOnlineQty')->nullable();
            }
        });
        DB::table('Product')->whereIn('salesMode', ['quote_only', 'both'])->update(['salesMode' => 'direct']);
        Schema::table('Product', fn (Blueprint $t) => $t->string('salesMode', 16)->default('direct')->change());

        Schema::table('Order', function (Blueprint $t) {
            foreach (['paymentStatus', 'clientType', 'citySlug'] as $c) {
                if (! Schema::hasColumn('Order', $c)) {
                    $t->text($c)->nullable();
                }
            }
            if (! Schema::hasColumn('Order', 'cgvAccepted')) {
                $t->boolean('cgvAccepted')->default(false);
            }
        });

        Schema::table('payments', function (Blueprint $t) {
            $t->unsignedBigInteger('customer_order_id')->nullable()->change();
            $t->unsignedInteger('shop_order_id')->nullable()->index();
        });
        Schema::table('payment_transactions', function (Blueprint $t) {
            $t->unsignedBigInteger('customer_order_id')->nullable()->change();
            $t->unsignedInteger('shop_order_id')->nullable()->index();
        });
    }

    public function down(): void
    {
        Schema::table('payment_transactions', fn (Blueprint $t) => $t->dropColumn('shop_order_id'));
        Schema::table('payments', fn (Blueprint $t) => $t->dropColumn('shop_order_id'));
        Schema::table('Order', fn (Blueprint $t) => $t->dropColumn(['paymentStatus', 'clientType', 'citySlug', 'cgvAccepted']));
        Schema::table('Product', function (Blueprint $t) {
            $t->dropColumn('maxOnlineQty');
            $t->string('salesMode', 16)->default('quote_only')->change();
        });
    }
};
