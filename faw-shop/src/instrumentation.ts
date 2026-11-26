export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  try {
    const { syncRedirectSnapshot } = await import("@/lib/redirects");
    await syncRedirectSnapshot();
  } catch (e) {
    console.error("[redirects] instantané non écrit :", String((e as Error)?.message ?? e).slice(0, 200));
  }
}
