// alerts module — alert panel and notifications.
//
// Design Frontend Modules mapped here (see design.md "Frontend Modules"):
//   - AlertPanel  (Req 16.5, 17.4)
//       Alert lines + enable/disable/delete controls; on alert_event shows a
//       toast, plays a sound, and appends to the event log.

export { AlertPanel, type AlertPanelProps } from "./AlertPanel";
export {
  type Alert,
  type AlertType,
  type AlertLogEntry,
  toLogEntry,
} from "./types";
