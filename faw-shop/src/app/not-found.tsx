import Link from "next/link";

export default function NotFound() {
  return (
    <div className="mx-auto max-w-xl px-4 pt-24 text-center">
      <p className="eyebrow text-copper">404</p>
      <h1 className="mt-2 text-3xl font-semibold">Page introuvable</h1>
      <Link href="/produits" className="btn btn-primary mt-8">Voir la boutique</Link>
    </div>
  );
}
