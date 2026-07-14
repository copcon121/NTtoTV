export type RootRoute = "live" | "footprint" | "marketProfile";

export function routeForPathname(pathname: string): RootRoute {
  const normalized = pathname.replace(/\/+$/, "") || "/";
  if (normalized === "/fp" || normalized === "/footprint") return "footprint";
  if (normalized === "/mp") return "marketProfile";
  return "live";
}
