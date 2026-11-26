"use client";

import { useState } from "react";

export function CopyButton({ text }: { text: string }) {
  const [done, setDone] = useState(false);
  return (
    <button
      type="button"
      title={text}
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
          setDone(true);
          setTimeout(() => setDone(false), 2000);
        } catch {
          window.prompt("Copier le message :", text);
        }
      }}
      className="inline-flex h-10 items-center rounded-full border border-border px-3.5 text-sm font-medium hover:bg-muted"
    >
      {done ? "Copié ✓" : "Copier le message"}
    </button>
  );
}
