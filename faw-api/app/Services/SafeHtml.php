<?php

namespace App\Services;

class SafeHtml
{
    public static function clean(?string $html): string
    {
        if (! $html) {
            return '';
        }libxml_use_internal_errors(true);
        $doc = new \DOMDocument;
        $doc->loadHTML('<?xml encoding="UTF-8"><html><body>'.$html.'</body></html>', LIBXML_NONET | LIBXML_NOERROR | LIBXML_NOWARNING);
        $allowed = ['p', 'br', 'h2', 'h3', 'h4', 'strong', 'em', 'ul', 'ol', 'li', 'blockquote', 'a', 'table', 'thead', 'tbody', 'tr', 'th', 'td'];
        $walk = function ($node) use (&$walk, $allowed) {
            foreach (iterator_to_array($node->childNodes) as $child) {
                if ($child instanceof \DOMElement) {
                    $tag = strtolower($child->tagName);
                    if (! in_array($tag, $allowed)) {
                        if (in_array($tag, ['script', 'style', 'iframe', 'object', 'embed', 'svg', 'math', 'form', 'input', 'textarea', 'button', 'link', 'meta', 'base'])) {
                            $node->removeChild($child);

                            continue;
                        }$walk($child);
                        while ($child->firstChild) {
                            $node->insertBefore($child->firstChild, $child);
                        }$node->removeChild($child);

                        continue;
                    }foreach (iterator_to_array($child->attributes) as $attr) {
                        if (! ($tag === 'a' && $attr->name === 'href')) {
                            $child->removeAttribute($attr->name);
                        }
                    }if ($tag === 'a' && ! preg_match('#^(?:/(?!/)[^<>\\\\]*|https://[^<>\\\\]+)$#i', $child->getAttribute('href'))) {
                        $child->removeAttribute('href');
                    }$walk($child);
                } elseif ($child instanceof \DOMComment) {
                    $node->removeChild($child);
                }
            }
        };
        $body = $doc->getElementsByTagName('body')->item(0);
        if (! $body) {
            return '';
        }$walk($body);
        $out = '';
        foreach ($body->childNodes as $child) {
            $out .= $doc->saveHTML($child);
        }libxml_clear_errors();

        return $out;
    }
}
