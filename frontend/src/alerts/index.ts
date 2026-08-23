// alerts module — alert panel and notifications.
//
// Design Frontend Modules mapped here (see design.md "Frontend Modules"):
//   - AlertPanel  (Req 16.5, 17.4)
//       Alert lines + enable/disable/delete controls; on alert_event shows a
//       toast and plays a sound.

export { AlertPanel, type AlertPanelProps } from "./AlertPanel";
export {
  type Alert,
  type AlertType,
} from "./types";
