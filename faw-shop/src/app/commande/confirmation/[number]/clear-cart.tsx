"use client";
import { useEffect } from "react";
import { useCart } from "@/components/providers";

export function ClearCart() {
  const { clear, ready } = useCart();
  useEffect(() => {
    if (ready) {
      clear();
      window.history.replaceState(null, "", window.location.pathname);
    }
  }, [ready, clear]);
  return null;
}
