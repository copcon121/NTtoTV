export type RootRoute = "live" | "footprint";

export function routeForPathname(pathname: string): RootRoute {
  const normalized = pathname.replace(/\/+$/, "") || "/";
  return normalized === "/footprint" ? "footprint" : "live";
}
