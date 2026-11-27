<?php

namespace App\Filament\Resources\ContentPages;

use Filament\Schemas\Components\Section;
use Filament\Schemas\Components\Tabs;
use Filament\Schemas\Components\Tabs\Tab;
use Filament\Schemas\Schema;
use Filament\Tables\Filters\TernaryFilter;
use Filament\Tables\Table;

/**
 * Full-page layout for the CMS resources (home, pages, technologies, blog).
 *
 * The fields, rules and defaults stay defined once in ContentResource::form();
 * this class only places them into tabs and sections. Any field it does not
 * know about lands in an "Autres réglages" section, so nothing is ever dropped.
 */
final class ContentLayout
{
    /** @param  list<mixed>  $components  the visible components of ContentResource::form() */
    public static function arrange(Schema $schema, array $components, string $kind): Schema
    {
        // ContentResource may already return a tabbed full-page layout: keep it as is
        // instead of nesting those tabs inside an "Autres réglages" section.
        foreach ($components as $component) {
            if ($component instanceof Tabs) {
                return $schema->components($components)->columns(1);
            }
        }

        $home = $kind === 'home';
        $byName = [];
        $unnamed = [];
        foreach ($components as $component) {
            $name = method_exists($component, 'getName') ? $component->getName() : null;
            if (is_string($name) && $name !== '') {
                $byName[$name] = $component;
            } else {
                $unnamed[] = $component;
            }
        }
        $take = function (array $names) use (&$byName): array {
            $out = [];
            foreach ($names as $name) {
                if (isset($byName[$name])) {
                    $out[] = $byName[$name];
                    unset($byName[$name]);
                }
            }

            return $out;
        };

        $main = $take(['title', 'slug', 'excerpt', 'image', 'featuredProductId', 'ctaLabel', 'ctaUrl', 'defaultSections']);
        $body = $take(['bodyHtml']);
        $blocks = $take(['blocks']);
        $classification = $take(['categoryId', 'tags']);
        $seo = $take(['seoTitle', 'seoDescription']);
        $publication = $take(['published', 'publishedAt']);
        $other = [...array_values($byName), ...$unnamed];

        $contentTab = [];
        if ($main !== []) {
            $contentTab[] = Section::make($home ? 'Bannière d’accueil' : 'Informations principales')
                ->description($home
                    ? 'Haut de la page d’accueil : titre, sous-titre, image, produit vedette et bouton.'
                    : 'Titre, adresse et résumé affichés dans les listes et en haut de la page.')
                ->schema($main)
                ->columns(2);
        }
        if ($body !== []) {
            $contentTab[] = Section::make('Texte de la page')
                ->description('Contenu principal. Le HTML est nettoyé automatiquement à l’enregistrement.')
                ->schema($body);
        }
        if ($other !== []) {
            $contentTab[] = Section::make('Autres réglages')->schema($other)->columns(2);
        }

        $tabs = [];
        if ($contentTab !== []) {
            $tabs[] = Tab::make('Contenu')->icon('heroicon-o-document-text')->schema($contentTab);
        }
        if ($blocks !== []) {
            $tabs[] = Tab::make('Sections')->icon('heroicon-o-queue-list')->schema([
                Section::make('Sections de la page')
                    ->description($home
                        ? 'Sections affichées sous la bannière (bannière, texte, produits, FAQ, appel à action).'
                        : 'Blocs facultatifs ajoutés à la page : bannière, texte, produits, FAQ, appel à action.')
                    ->schema($blocks),
            ]);
        }
        if ($classification !== []) {
            $tabs[] = Tab::make('Classement')->icon('heroicon-o-tag')->schema([
                Section::make('Catégorie et étiquettes')
                    ->description('Aide les lecteurs à trouver des articles sur le même sujet.')
                    ->schema($classification)
                    ->columns(2),
            ]);
        }
        $seoTab = [];
        if ($seo !== []) {
            $seoTab[] = Section::make('Référencement (SEO)')
                ->description('Titre et description proposés à Google. Vides = titre et résumé de la page.')
                ->schema($seo);
        }
        if ($publication !== []) {
            $seoTab[] = Section::make('Publication')
                ->description('Une page non publiée n’est pas visible sur le site. La date permet de programmer une mise en ligne.')
                ->schema($publication)
                ->columns(2);
        }
        if ($seoTab !== []) {
            $tabs[] = Tab::make('SEO & publication')->icon('heroicon-o-globe-alt')->schema($seoTab);
        }

        return $schema->components([
            Tabs::make('Onglets')->tabs($tabs)->persistTabInQueryString()->columnSpanFull(),
        ]);
    }

    public static function table(Table $table): Table
    {
        if ($table->getFilter('published', withHidden: true) === null) {
            $table->filters([TernaryFilter::make('published')->label('Publié')]);
        }

        return $table->defaultSort('updated_at', 'desc');
    }
}
