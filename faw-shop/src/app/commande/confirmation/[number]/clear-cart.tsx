"use client";
import { useEffect } from "react";
import { useCart } from "@/components/providers";

export function ClearCart({ orderNumber, total }: { orderNumber?: string; total?: number }) {
  const { clear, ready } = useCart();
  useEffect(() => {
    if (ready) {
      clear();
      if (orderNumber) {
        window.dispatchEvent(new CustomEvent("faw:purchase", { detail: { id: orderNumber, value: total } }));
      }
      window.history.replaceState(null, "", window.location.pathname);
    }
  }, [ready, clear, orderNumber, total]);
  return null;
}
