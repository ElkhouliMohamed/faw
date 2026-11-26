import "server-only";
import { publicConfig } from "./public-config";

export async function showPublicPrices(): Promise<boolean> {
  return (await publicConfig())?.shop?.showPrices === true;
}
