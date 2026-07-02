/** Resolve same-origin backend base URLs for REST and chart WebSocket traffic. */
export function resolveEndpoints(
  location: Pick<Location, "protocol" | "host"> = window.location,
): { api: string; ws: string } {
  const wsProto = location.protocol === "https:" ? "wss" : "ws";
  const ws = `${wsProto}://${location.host}/ws/chart`;
  return { api: "/api", ws };
}
