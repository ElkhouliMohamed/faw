{{-- Thème FAW v6 pour Filament : brun du logo pour le texte, orange pour l'accent, cartes plates à filet fin. --}}
<style>
  :root { --faw-brown: #432a13; --faw-orange: #f38f26; --faw-lin: #f5f1eb; --faw-rule: #ece4da; }
  .fi-body:not(.dark *) { background: #fbf9f6; color: var(--faw-brown); }
  .fi-sidebar:not(.dark *) { background: #fff; border-inline-end: 1px solid var(--faw-rule); }
  .fi-topbar > nav:not(.dark *), .fi-topbar:not(.dark *) { background: #fff; box-shadow: none; border-bottom: 1px solid var(--faw-rule); }
  .fi-section, .fi-wi-stats-overview-stat, .fi-ta-ctn, .fi-wi-chart { border-radius: 0.75rem !important; box-shadow: none !important; }
  .fi-section:not(.dark *), .fi-wi-stats-overview-stat:not(.dark *), .fi-ta-ctn:not(.dark *), .fi-wi-chart:not(.dark *) { --tw-ring-color: var(--faw-rule) !important; }
  .fi-wi-stats-overview-stat { position: relative; overflow: hidden; }
  .fi-wi-stats-overview-stat::before { content: ""; position: absolute; inset-inline-start: 0; top: 0; height: 3px; width: 2.5rem; background: var(--faw-orange); }
  .fi-sidebar-item-active > a:not(.dark *), .fi-sidebar-item.fi-active > a:not(.dark *) { background: #fff1e2; }
  .fi-header-heading { letter-spacing: -0.02em; }
  .fi-simple-layout:not(.dark *) { background: radial-gradient(80% 60% at 80% 0%, #fff1e2 0%, transparent 60%), #fbf9f6; }
</style>
