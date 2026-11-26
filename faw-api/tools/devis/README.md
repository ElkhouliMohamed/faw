# Générateur de devis FAW

Copie versionnée du générateur utilisé par le back-office (`generer_devis.py`, `prochain_numero.py`, logo).

- Le compteur (`compteur-devis.txt`) et le journal (`journal-devis.csv`) réels ne sont **jamais** versionnés.
- Le catalogue complet `produits/produits-reference.csv` (prix internes) n'est pas versionné ; les tests utilisent `tests/fixtures/produits/`.
- En local/production, pointer `DEVIS_GENERATOR_SCRIPT`, `DEVIS_COUNTER_SCRIPT` et `DEVIS_JOURNAL_PATH` (voir `.env.example`).
- Dépendance : `pip install reportlab` (et `poppler-utils` pour l'aperçu PNG).
