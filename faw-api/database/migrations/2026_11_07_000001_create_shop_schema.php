<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        DB::unprepared(file_get_contents(database_path('legacy-schema.sql')));
        Schema::table('Quote', function (Blueprint $t) {
            $t->text('reviewReasons')->nullable();
            $t->boolean('custom')->default(false);
            $t->float('kitLeaf')->nullable();
        });
        Schema::table('users', function (Blueprint $t) {
            $t->string('role')->default('admin');
        });
    }

    public function down(): void
    {
        Schema::disableForeignKeyConstraints();
        foreach (['Product', 'Order', 'Event', 'Cart', 'FeeRule', 'ShippingCity', 'Redirect', 'LandingPage', 'NewsletterSubscriber', 'Popup', 'Coupon', 'Promotion', 'Bundle', 'Warranty', 'Badge', 'Attribute', 'Category', 'Media', 'Setting', 'AuditLog', 'AdminUser', 'Quote', 'Task', 'Interaction', 'LeadEvent', 'Contact', 'OrderItem'] as $table) {
            Schema::dropIfExists($table);
        }
        Schema::enableForeignKeyConstraints();
        Schema::table('users', function (Blueprint $table) {
            $table->dropColumn('role');
        });
    }
};
