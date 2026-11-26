"use client";
import { useActionState } from "react";
import { usePathname } from "next/navigation";
import { adminLogin } from "@/app/actions/admin";

export function LoginForm() {
  const [state, action, pending] = useActionState(adminLogin, null);
  const path = usePathname();
  return (
    <form action={action} className="mt-6 space-y-3">
      <input type="hidden" name="next" value={path} />
      <label htmlFor="email" className="block text-sm font-medium">E-mail <span className="font-normal text-muted-foreground">(vide = accès propriétaire)</span></label>
      <input id="email" name="email" type="email" autoComplete="username" className="h-11 w-full rounded-[2px] border border-input bg-background px-3 outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/30" />
      <label htmlFor="password" className="block text-sm font-medium">Mot de passe</label>
      <input id="password" name="password" type="password" autoComplete="current-password" required className="h-11 w-full rounded-[2px] border border-input bg-background px-3 outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/30" />
      {state?.error && <p className="text-sm text-destructive" role="alert">{state.error}</p>}
      <button disabled={pending} className="h-11 w-full rounded-full bg-primary font-semibold text-primary-foreground disabled:opacity-60">{pending ? "…" : "Se connecter"}</button>
    </form>
  );
}
