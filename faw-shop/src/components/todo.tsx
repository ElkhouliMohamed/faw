/** Marque clairement un contenu manquant, à fournir par la direction FAW avant publication. */
export function Todo({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-start gap-2 rounded-md border border-dashed border-amber-600/60 bg-amber-500/10 px-2.5 py-1.5 text-sm text-amber-800 dark:text-amber-300">
      <span className="label-mono shrink-0 rounded bg-amber-600 px-1.5 py-0.5 text-[0.6rem] text-white">À compléter</span>
      <span>{children}</span>
    </span>
  );
}
