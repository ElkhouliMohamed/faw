<?php

namespace App\Support;

enum Role: string
{
    case SuperAdmin = 'super_admin';
    case TechnicalAdmin = 'technical_admin';
    case SalesManager = 'sales_manager';
    case SalesRep = 'sales_rep';
    case CatalogueManager = 'catalogue_manager';
    case SeoContentManager = 'seo_content_manager';
    case StockManager = 'stock_manager';
    case FinanceManager = 'finance_manager';
    case Viewer = 'viewer';

    public function label(): string
    {
        return match ($this) {
            self::SuperAdmin => 'Super administrateur',
            self::TechnicalAdmin => 'Administrateur technique',
            self::SalesManager => 'Responsable commercial',
            self::SalesRep => 'Commercial',
            self::CatalogueManager => 'Responsable produits et catalogue',
            self::SeoContentManager => 'Responsable SEO et contenu',
            self::StockManager => 'Responsable stock et logistique',
            self::FinanceManager => 'Responsable finance',
            self::Viewer => 'Lecteur',
        };
    }

    /** @return array<string, string> */
    public static function options(): array
    {
        $options = [];
        foreach (self::cases() as $role) {
            $options[$role->value] = $role->label();
        }

        return $options;
    }

    public static function resolve(?string $value): ?self
    {
        if ($value === 'admin') {
            return self::SuperAdmin;
        }

        return self::tryFrom((string) $value);
    }

    public function can(string $ability): bool
    {
        if ($this === self::SuperAdmin) {
            return true;
        }

        return in_array($ability, $this->abilities(), true);
    }

    /** @return list<string> */
    public function abilities(): array
    {
        return match ($this) {
            self::SuperAdmin => ['*'],
            self::TechnicalAdmin => [
                'view.system', 'write.system',
                'view.settings', 'write.settings',
                'view.finance',
                'view.analytics',
            ],
            self::SalesManager => [
                'view.quotes', 'write.quotes', 'validate.quotes', 'manage.customer_orders',
                'view.customers', 'write.customers',
                'view.orders', 'write.orders',
                'view.carts', 'write.carts',
                'view.inbox', 'write.inbox',
                'view.marketing',
                'view.shipping',
                'view.analytics',
            ],
            self::SalesRep => [
                'view.quotes', 'write.quotes',
                'view.customers', 'write.customers',
                'view.orders', 'write.orders',
                'view.carts', 'write.carts',
                'view.inbox', 'write.inbox',
                'view.shipping',
                'view.analytics',
            ],
            self::CatalogueManager => [
                'view.catalogue', 'write.catalogue',
                'view.media', 'write.media',
                'view.marketing', 'write.marketing',
                'view.content',
                'view.catalogue_pdf',
            ],
            self::SeoContentManager => [
                'view.content', 'write.content',
                'view.media', 'write.media',
                'view.analytics',
                'view.catalogue_pdf',
            ],
            self::StockManager => [
                'view.catalogue', 'write.stock',
                'view.orders', 'write.orders',
                'view.shipping', 'write.shipping',
                'view.customers',
            ],
            self::FinanceManager => [
                'view.orders', 'write.finance',
                'view.finance',
                'view.analytics',
                'view.settings',
            ],
            self::Viewer => [
                'view.quotes', 'view.customers', 'view.orders', 'view.carts',
                'view.inbox', 'view.catalogue', 'view.media', 'view.content',
                'view.marketing', 'view.shipping', 'view.analytics',
                'view.catalogue_pdf', 'view.settings',
            ],
        };
    }
}
