/** Empêche la coupure de ligne après un trait d'union (« coupe-feu », « G-BAT ») sans dépendre du glyphe U+2011. */
export function NoBreak({ text }: { text: string }) {
  if (!text.includes("-")) return <>{text}</>;
  return (
    <>
      {text.split(/(\S*-\S*)/).map((part, i) => (part.includes("-") ? <span key={i} className="whitespace-nowrap">{part}</span> : part))}
    </>
  );
}
