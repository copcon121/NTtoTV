export type RootRoute =
  | "live"
  | "footprint"
  | "marketProfile"
  | "liquidity"
  | "admin";

export function routeForPathname(pathname: string): RootRoute {
  const normalized = pathname.replace(/\/+$/, "") || "/";
  if (normalized === "/fp" || normalized === "/footprint") return "footprint";
  if (normalized === "/mp") return "marketProfile";
  if (normalized === "/lq") return "liquidity";
  if (normalized === "/admin") return "admin";
  return "live";
}
