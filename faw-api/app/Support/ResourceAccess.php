<?php

namespace App\Support;

use App\Filament\Resources\AnalyticsConnections\AnalyticsConnectionsResource;
use App\Filament\Resources\Aramex\AramexResource;
use App\Filament\Resources\Attributes\AttributeResource;
use App\Filament\Resources\AuditLogs\AuditLogResource;
use App\Filament\Resources\Badges\BadgeResource;
use App\Filament\Resources\BlogCategories\BlogCategoriesResource;
use App\Filament\Resources\BlogPosts\BlogPostsResource;
use App\Filament\Resources\BlogTags\BlogTagsResource;
use App\Filament\Resources\Bundles\BundleResource;
use App\Filament\Resources\Carts\CartResource;
use App\Filament\Resources\Categorys\CategoryResource;
use App\Filament\Resources\Cmi\CmiResource;
use App\Filament\Resources\Contacts\ContactsResource;
use App\Filament\Resources\ContentPages\ContentPagesResource;
use App\Filament\Resources\Coupons\CouponResource;
use App\Filament\Resources\CustomerOrders\OrderResource;
use App\Filament\Resources\Customers\CustomerResource;
use App\Filament\Resources\Dynamics\DynamicsResource;
use App\Filament\Resources\FeeRules\FeeRuleResource;
use App\Filament\Resources\Homepages\HomepagesResource;
use App\Filament\Resources\Integrations\IntegrationsResource;
use App\Filament\Resources\LandingPages\LandingPageResource;
use App\Filament\Resources\Medias\MediaResource;
use App\Filament\Resources\Menus\MenuResource;
use App\Filament\Resources\Notifications\NotificationsResource;
use App\Filament\Resources\Popups\PopupResource;
use App\Filament\Resources\Products\ProductResource;
use App\Filament\Resources\Promotions\PromotionResource;
use App\Filament\Resources\Quotes\QuoteResource;
use App\Filament\Resources\Redirects\RedirectResource;
use App\Filament\Resources\SavRequests\SavRequestsResource;
use App\Filament\Resources\SeoSettings\SeoSettingsResource;
use App\Filament\Resources\Settings\SettingResource;
use App\Filament\Resources\ShippingCitys\ShippingCityResource;
use App\Filament\Resources\ShopOrders\ShopOrderResource;
use App\Filament\Resources\ShopSettings\ShopSettingsResource;
use App\Filament\Resources\SiteLayouts\SiteLayoutResource;
use App\Filament\Resources\Socials\SocialsResource;
use App\Filament\Resources\TeamInbox\TeamInboxResource;
use App\Filament\Resources\Technologies\TechnologiesResource;
use App\Filament\Resources\Themes\ThemesResource;
use App\Filament\Resources\Tickets\TicketsResource;
use App\Filament\Resources\Users\UserResource;
use App\Filament\Resources\Warrantys\WarrantyResource;

final class ResourceAccess
{
    /**
     * @return array{view: list<string>, write: list<string>, create: list<string>}
     */
    public static function abilities(string $resource): array
    {
        return match ($resource) {
            UserResource::class => self::box(['view.users'], ['manage.users']),
            AuditLogResource::class => self::box(['view.audit'], []),
            QuoteResource::class => self::box(['view.quotes'], ['write.quotes']),
            CustomerResource::class => self::box(['view.customers'], ['write.customers']),
            OrderResource::class => self::box(['view.orders'], ['manage.customer_orders', 'write.shipping', 'write.finance']),
            ShopOrderResource::class => self::box(['view.orders'], ['write.orders', 'write.finance']),
            CartResource::class => self::box(['view.carts'], ['write.carts']),
            ContactsResource::class, TicketsResource::class, TeamInboxResource::class, SavRequestsResource::class => self::box(['view.inbox'], ['write.inbox']),
            ProductResource::class => [
                'view' => ['view.catalogue'],
                'write' => ['write.catalogue', 'write.stock'],
                'create' => ['write.catalogue'],
            ],
            CategoryResource::class, AttributeResource::class, BadgeResource::class, BundleResource::class, WarrantyResource::class => self::box(['view.catalogue'], ['write.catalogue']),
            MediaResource::class => self::box(['view.media'], ['write.media']),
            PromotionResource::class, CouponResource::class => self::box(['view.marketing'], ['write.marketing']),
            ShippingCityResource::class, FeeRuleResource::class => self::box(['view.shipping'], ['write.shipping']),
            RedirectResource::class, LandingPageResource::class, PopupResource::class, BlogCategoriesResource::class, BlogTagsResource::class, BlogPostsResource::class, HomepagesResource::class, MenuResource::class, ContentPagesResource::class, SeoSettingsResource::class, SocialsResource::class, SiteLayoutResource::class => self::box(['view.content'], ['write.content']),
            TechnologiesResource::class => self::box(['view.content', 'view.catalogue'], ['write.content', 'write.catalogue']),
            SettingResource::class => self::box(['view.settings'], ['write.settings']),
            CmiResource::class => self::box(['view.finance', 'view.system'], ['write.system']),
            IntegrationsResource::class, NotificationsResource::class, DynamicsResource::class, AramexResource::class, AnalyticsConnectionsResource::class, ThemesResource::class, ShopSettingsResource::class => self::box(['view.system'], ['write.system']),
            default => self::box([], []),
        };
    }

    /**
     * @param  list<string>  $view
     * @param  list<string>  $write
     * @param  list<string>|null  $create
     * @return array{view: list<string>, write: list<string>, create: list<string>}
     */
    private static function box(array $view, array $write, ?array $create = null): array
    {
        return ['view' => $view, 'write' => $write, 'create' => $create ?? $write];
    }
}
