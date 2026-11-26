"use client";

import { useState } from "react";

export function CopyLink({ text }: { text: string }) {
  const [done, setDone] = useState(false);
  return (
    <button
      type="button"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
          setDone(true);
          setTimeout(() => setDone(false), 2000);
        } catch {
          window.prompt("Copier le lien :", text);
        }
      }}
      className="btn btn-ghost shrink-0"
      data-testid="quote-copy-link"
    >
      {done ? "Lien copié ✓" : "Copier le lien"}
    </button>
  );
}
