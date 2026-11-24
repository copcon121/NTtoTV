import { useSyncExternalStore } from "react";

import { getWorkspaceTheme, subscribeWorkspaceTheme } from "./themes";

export function useWorkspaceTheme() {
  return useSyncExternalStore(subscribeWorkspaceTheme, getWorkspaceTheme);
}
