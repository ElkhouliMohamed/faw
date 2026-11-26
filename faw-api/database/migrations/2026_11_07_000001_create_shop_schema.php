<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Query\Expression;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Shop tables inherited from the former Prisma schema (database/legacy-schema.sql, kept for reference only).
 * Portable Schema builder version (PostgreSQL in every environment, SQLite still works).
 * Table and column names keep their historical camelCase spelling (quoted by the query builder).
 * Every former Prisma DATETIME column is stored as BIGINT epoch milliseconds: that is what the
 * App\Casts\ShopTimestamp cast and the API write, and what Prisma stored in SQLite.
 * Tables are created parents first so that foreign keys are valid on PostgreSQL.
 */
return new class extends Migration
{
    public function up(): void
    {
        $now = $this->nowMs();
        $ms = function (Blueprint $t, string $column, bool $nullable = false, bool $current = false) use ($now) {
            $c = $t->bigInteger($column);
            $nullable ? $c->nullable() : null;
            $current ? $c->default($now) : null;
        };
        $stamps = function (Blueprint $t) use ($ms) {
            $ms($t, 'createdAt', current: true);
            $ms($t, 'updatedAt', current: true);
        };

        Schema::create('Contact', function (Blueprint $t) use ($ms) {
            $t->increments('id');
            $t->text('phone')->unique('Contact_phone_key');
            $t->text('name');
            $t->text('email')->nullable();
            $t->text('city')->nullable();
            $t->text('type')->default('particulier');
            $t->text('company')->nullable();
            $t->text('ice')->nullable();
            $t->text('tags')->default('');
            foreach (['source', 'utmSource', 'utmMedium', 'utmCampaign', 'gclid', 'fbclid', 'landing', 'referrer'] as $c) {
                $t->text($c)->nullable();
            }
            $ms($t, 'createdAt', current: true);
            $ms($t, 'lastActivityAt', current: true);
        });

        Schema::create('Order', function (Blueprint $t) use ($ms) {
            $t->increments('id');
            $t->text('number')->unique('Order_number_key');
            $ms($t, 'createdAt', current: true);
            $t->text('status')->default('nouveau');
            $t->text('origin')->default('site');
            $t->text('locale')->default('fr');
            $t->integer('contactId')->nullable();
            $t->text('customerName');
            $t->text('phone');
            $t->text('email')->nullable();
            $t->text('city');
            $t->text('address');
            $t->text('company')->nullable();
            $t->text('ice')->nullable();
            $t->text('deliveryMode');
            $t->integer('deliveryFee');
            $t->text('deliveryNote')->nullable();
            $t->text('paymentMethod');
            $t->text('notes')->nullable();
            $t->integer('subtotal');
            $t->integer('total');
            foreach (['utmSource', 'utmMedium', 'utmCampaign', 'gclid', 'fbclid', 'quoteRefusal', 'couponCode'] as $c) {
                $t->text($c)->nullable();
            }
            $t->integer('couponDiscount')->default(0);
            $t->text('cartId')->nullable();
            $t->foreign('contactId', 'Order_contactId_fkey')->references('id')->on('Contact')->nullOnDelete()->cascadeOnUpdate();
        });

        Schema::create('OrderItem', function (Blueprint $t) {
            $t->increments('id');
            $t->integer('orderId');
            $t->text('productId');
            $t->text('title');
            $t->text('category');
            $t->integer('unitPrice');
            $t->integer('quantity');
            $t->integer('lineTotal');
            $t->foreign('orderId', 'OrderItem_orderId_fkey')->references('id')->on('Order')->cascadeOnDelete()->cascadeOnUpdate();
        });

        Schema::create('LeadEvent', function (Blueprint $t) use ($ms) {
            $t->increments('id');
            $t->integer('orderId');
            $t->text('fromStatus')->nullable();
            $t->text('toStatus');
            $ms($t, 'createdAt', current: true);
            $t->foreign('orderId', 'LeadEvent_orderId_fkey')->references('id')->on('Order')->cascadeOnDelete()->cascadeOnUpdate();
        });

        Schema::create('Interaction', function (Blueprint $t) use ($ms) {
            $t->increments('id');
            $t->integer('contactId');
            $t->text('type');
            $t->text('note')->nullable();
            $ms($t, 'createdAt', current: true);
            $t->foreign('contactId', 'Interaction_contactId_fkey')->references('id')->on('Contact')->cascadeOnDelete()->cascadeOnUpdate();
        });

        Schema::create('Task', function (Blueprint $t) use ($ms) {
            $t->increments('id');
            $t->integer('contactId');
            $t->text('title');
            $ms($t, 'dueDate');
            $t->boolean('done')->default(false);
            $ms($t, 'doneAt', nullable: true);
            $ms($t, 'createdAt', current: true);
            $t->foreign('contactId', 'Task_contactId_fkey')->references('id')->on('Contact')->cascadeOnDelete()->cascadeOnUpdate();
        });

        Schema::create('Quote', function (Blueprint $t) use ($ms) {
            $t->increments('id');
            $t->text('number')->nullable()->index('Quote_number_idx');
            $t->text('status')->default('à valider')->index('Quote_status_idx');
            $ms($t, 'createdAt', current: true);
            $t->integer('orderId')->nullable();
            $t->integer('contactId')->nullable();
            $t->text('clientName');
            $t->text('clientType')->default('particulier');
            $t->text('phone')->default('');
            $t->text('city');
            $t->double('totalHt');
            $t->integer('totalTtc');
            $t->text('transport');
            $t->text('lines');
            $t->text('genInput')->default('{}');
            $t->text('journalInput')->default('{}');
            $t->text('note')->nullable();
            $t->text('pdfFile')->nullable();
            $t->text('token')->unique('Quote_token_key');
            $t->boolean('journaled')->default(false);
            $ms($t, 'validatedAt', nullable: true);
            $ms($t, 'sentAt', nullable: true);
            $ms($t, 'cancelledAt', nullable: true);
            $t->text('cancelReason')->nullable();
            $t->text('email')->nullable();
            $t->text('emailStatus')->nullable();
            $ms($t, 'emailSentAt', nullable: true);
            $t->text('emailMessageId')->nullable();
            $t->text('emailError')->nullable();
            $t->integer('emailAttempts')->default(0);
            $ms($t, 'emailLastAttemptAt', nullable: true);
            $t->text('deliveredVia')->nullable();
            // Former follow-up columns (previously a separate ALTER).
            $t->text('reviewReasons')->nullable();
            $t->boolean('custom')->default(false);
            $t->double('kitLeaf')->nullable();
            $t->foreign('orderId', 'Quote_orderId_fkey')->references('id')->on('Order')->nullOnDelete()->cascadeOnUpdate();
            $t->foreign('contactId', 'Quote_contactId_fkey')->references('id')->on('Contact')->nullOnDelete()->cascadeOnUpdate();
        });

        Schema::create('AdminUser', function (Blueprint $t) use ($ms) {
            $t->increments('id');
            $t->text('email')->unique('AdminUser_email_key');
            $t->text('name');
            $t->text('role')->default('viewer');
            $t->text('passwordHash');
            $t->boolean('active')->default(true);
            $t->integer('failedCount')->default(0);
            $ms($t, 'lockedUntil', nullable: true);
            $ms($t, 'lastLoginAt', nullable: true);
            $ms($t, 'createdAt', current: true);
            $ms($t, 'updatedAt', current: true);
        });

        Schema::create('AuditLog', function (Blueprint $t) use ($ms) {
            $t->increments('id');
            $ms($t, 'at', current: true);
            $t->text('actor');
            $t->text('action');
            $t->text('entity');
            $t->text('entityId')->nullable();
            $t->text('summary')->nullable();
            $t->index('at', 'AuditLog_at_idx');
        });

        Schema::create('Setting', function (Blueprint $t) use ($ms) {
            $t->text('key')->primary();
            $t->text('value');
            $ms($t, 'updatedAt', current: true);
            $t->text('updatedBy')->nullable();
        });

        Schema::create('Media', function (Blueprint $t) use ($ms) {
            $t->increments('id');
            $t->text('file')->unique('Media_file_key');
            $t->text('url');
            $t->text('alt')->default('');
            $t->integer('width')->nullable();
            $t->integer('height')->nullable();
            $t->integer('size');
            $t->text('originalName')->nullable();
            $ms($t, 'createdAt', current: true);
        });

        Schema::create('Category', function (Blueprint $t) use ($stamps) {
            $t->increments('id');
            $t->text('slug')->unique('Category_slug_key');
            $t->text('label')->unique('Category_label_key');
            $t->text('short')->default('');
            $t->text('family');
            $t->text('description')->default('');
            $t->text('seoTitle')->default('');
            $t->text('seoDescription')->default('');
            $t->text('image')->nullable();
            $t->integer('sortOrder')->default(0);
            $t->boolean('active')->default(true);
            $t->integer('warrantyId')->nullable();
            $stamps($t);
        });

        Schema::create('Attribute', function (Blueprint $t) use ($stamps) {
            $t->increments('id');
            $t->text('key')->unique('Attribute_key_key');
            $t->text('label');
            $t->text('unit')->default('');
            $t->text('kind')->default('text');
            $t->text('options')->default('');
            $t->integer('sortOrder')->default(0);
            $t->boolean('showInSpecs')->default(true);
            $t->boolean('active')->default(true);
            $stamps($t);
        });

        Schema::create('Badge', function (Blueprint $t) use ($stamps) {
            $t->increments('id');
            $t->text('label')->unique('Badge_label_key');
            $t->text('tone')->default('neutral');
            $t->integer('sortOrder')->default(0);
            $t->boolean('active')->default(true);
            $stamps($t);
        });

        Schema::create('Warranty', function (Blueprint $t) use ($stamps) {
            $t->increments('id');
            $t->text('name')->unique('Warranty_name_key');
            $t->text('text');
            $t->boolean('active')->default(true);
            $stamps($t);
        });

        Schema::create('Bundle', function (Blueprint $t) use ($stamps) {
            $t->increments('id');
            $t->text('slug')->unique('Bundle_slug_key');
            $t->text('title');
            $t->text('description')->default('');
            $t->text('image')->nullable();
            $t->text('items');
            $t->integer('price');
            $t->boolean('active')->default(false);
            $t->integer('sortOrder')->default(0);
            $t->text('seoTitle')->default('');
            $t->text('seoDescription')->default('');
            $stamps($t);
        });

        Schema::create('Promotion', function (Blueprint $t) use ($ms, $stamps) {
            $t->increments('id');
            $t->text('name');
            $t->text('kind');
            $t->integer('value');
            $t->text('scope');
            $t->text('targets')->default('');
            $ms($t, 'startsAt', nullable: true);
            $ms($t, 'endsAt', nullable: true);
            $t->boolean('active')->default(false);
            $stamps($t);
        });

        Schema::create('Coupon', function (Blueprint $t) use ($ms, $stamps) {
            $t->increments('id');
            $t->text('code')->unique('Coupon_code_key');
            $t->text('kind');
            $t->integer('value');
            $t->integer('minOrder')->default(0);
            $ms($t, 'startsAt', nullable: true);
            $ms($t, 'endsAt', nullable: true);
            $t->integer('usageLimit')->nullable();
            $t->integer('usedCount')->default(0);
            $t->boolean('active')->default(false);
            $t->text('note')->default('');
            $stamps($t);
        });

        Schema::create('Popup', function (Blueprint $t) use ($ms, $stamps) {
            $t->increments('id');
            $t->text('name');
            $t->text('kind');
            $t->text('title');
            $t->text('body')->default('');
            $t->text('ctaLabel')->default('');
            $t->text('ctaUrl')->default('');
            $t->text('trigger')->default('delay');
            $t->integer('delaySeconds')->default(8);
            $t->integer('scrollPercent')->default(50);
            $t->text('paths')->default('');
            $t->text('frequency')->default('session');
            $t->integer('frequencyDays')->default(7);
            $ms($t, 'startsAt', nullable: true);
            $ms($t, 'endsAt', nullable: true);
            $t->boolean('active')->default(false);
            $stamps($t);
        });

        Schema::create('NewsletterSubscriber', function (Blueprint $t) use ($ms) {
            $t->increments('id');
            $t->text('email')->unique('NewsletterSubscriber_email_key');
            $t->boolean('consent');
            $t->text('source')->nullable();
            $ms($t, 'createdAt', current: true);
        });

        Schema::create('LandingPage', function (Blueprint $t) use ($stamps) {
            $t->increments('id');
            $t->text('slug')->unique('LandingPage_slug_key');
            $t->text('title');
            $t->text('seoTitle')->default('');
            $t->text('seoDescription')->default('');
            $t->text('blocks')->default('[]');
            $t->boolean('published')->default(false);
            $stamps($t);
        });

        Schema::create('Redirect', function (Blueprint $t) use ($stamps) {
            $t->increments('id');
            $t->text('from')->unique('Redirect_from_key');
            $t->text('to');
            $t->integer('code')->default(301);
            $t->boolean('active')->default(true);
            $t->text('note')->default('');
            $stamps($t);
        });

        Schema::create('ShippingCity', function (Blueprint $t) use ($stamps) {
            $t->increments('id');
            $t->text('name')->unique('ShippingCity_name_key');
            $t->text('slug')->unique('ShippingCity_slug_key');
            $t->integer('fee')->nullable();
            $t->boolean('available')->default(true);
            $t->text('delayText')->default('');
            $t->integer('sortOrder')->default(0);
            $t->boolean('active')->default(true);
            $stamps($t);
        });

        Schema::create('FeeRule', function (Blueprint $t) use ($stamps) {
            $t->increments('id');
            $t->text('scope');
            $t->text('target');
            $t->text('citySlug')->default('');
            $t->text('mode')->default('fixed');
            $t->integer('fee')->default(0);
            $t->text('note')->default('');
            $t->boolean('active')->default(true);
            $stamps($t);
        });

        Schema::create('Cart', function (Blueprint $t) use ($ms, $stamps) {
            $t->text('id')->primary();
            $t->text('items');
            $t->integer('itemCount')->default(0);
            $t->integer('subtotal')->default(0);
            $t->text('name')->nullable();
            $t->text('phone')->nullable();
            $t->text('email')->nullable();
            $t->text('status')->default('ouvert');
            $t->text('orderNumber')->nullable();
            $t->text('utmSource')->nullable();
            $t->text('utmCampaign')->nullable();
            $ms($t, 'remindedAt', nullable: true);
            $stamps($t);
            $t->index('updatedAt', 'Cart_updatedAt_idx');
        });

        Schema::create('Event', function (Blueprint $t) use ($ms) {
            $t->increments('id');
            $ms($t, 'at', current: true);
            $t->text('type');
            foreach (['path', 'productId', 'source', 'medium', 'campaign', 'sid'] as $c) {
                $t->text($c)->nullable();
            }
            $t->integer('value')->nullable();
            $t->index('at', 'Event_at_idx');
            $t->index(['type', 'at'], 'Event_type_at_idx');
        });

        Schema::create('Product', function (Blueprint $t) use ($stamps) {
            $t->text('id')->primary();
            $t->text('slug')->unique('Product_slug_key');
            $t->text('title');
            $t->text('seoTitle');
            $t->text('description');
            $t->text('shortDescription')->nullable();
            $t->integer('price');
            $t->text('category');
            $t->text('brand')->default('FAW Aluminium');
            $t->text('image')->nullable();
            $t->text('availability')->default('en stock');
            $t->integer('stockQty')->nullable();
            $t->boolean('priceToConfirm')->default(false);
            $t->boolean('stockToConfirm')->default(false);
            $t->text('stockNote')->nullable();
            $t->text('variantGroup')->nullable();
            $t->text('variantLabel')->nullable();
            $t->integer('sortOrder')->default(0);
            $t->boolean('active')->default(true);
            $t->text('metaTitle')->default('');
            $t->text('metaDescription')->default('');
            $t->text('badges')->default('');
            $t->integer('warrantyId')->nullable();
            $t->text('attributes')->default('{}');
            $stamps($t);
        });

        Schema::table('users', function (Blueprint $t) {
            $t->string('role')->default('admin');
        });
    }

    /** Current time as epoch milliseconds, evaluated by the database for rows inserted without a value. */
    private function nowMs(): ?Expression
    {
        return match (DB::getDriverName()) {
            'pgsql' => new Expression('(floor(extract(epoch from clock_timestamp()) * 1000))::bigint'),
            'sqlite' => new Expression("(CAST(strftime('%s', 'now') AS INTEGER) * 1000)"),
            'mysql', 'mariadb' => new Expression('(CAST(UNIX_TIMESTAMP(NOW(3)) * 1000 AS UNSIGNED))'),
            default => null,
        };
    }

    public function down(): void
    {
        Schema::disableForeignKeyConstraints();
        foreach (['Product', 'Event', 'Cart', 'FeeRule', 'ShippingCity', 'Redirect', 'LandingPage', 'NewsletterSubscriber', 'Popup', 'Coupon', 'Promotion', 'Bundle', 'Warranty', 'Badge', 'Attribute', 'Category', 'Media', 'Setting', 'AuditLog', 'AdminUser', 'Quote', 'Task', 'Interaction', 'LeadEvent', 'OrderItem', 'Order', 'Contact'] as $table) {
            Schema::dropIfExists($table);
        }
        Schema::enableForeignKeyConstraints();
        Schema::table('users', function (Blueprint $table) {
            $table->dropColumn('role');
        });
    }
};
