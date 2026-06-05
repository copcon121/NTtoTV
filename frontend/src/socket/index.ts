// socket module — chart WebSocket client.
//
// Design Frontend Modules mapped here (see design.md "Frontend Modules"):
//   - ChartSocket  (Req 5.4, 5.5, 6.2, 11.2)
//       Connects to `/ws/chart`, sends subscribe/unsubscribe, and responds to
//       ping with pong.
//
// Implemented in task 12.1.

export { ChartSocket, SocketReadyState } from "./ChartSocket";
export type {
  AnyMessageHandler,
  ChartSocketOptions,
  MessageHandler,
  WebSocketFactory,
  WebSocketLike,
} from "./ChartSocket";
export type {
  AlertEventMessage,
  Bar,
  BarUpdateMessage,
  BigTradeMessage,
  ChartEventType,
  FootprintRow,
  FootprintUpdateMessage,
  ImbalanceSide,
  InboundMessage,
  InboundMessageOf,
  InboundMessageType,
  OutboundMessage,
  PingMessage,
  PongMessage,
  QuoteUpdateMessage,
  Side,
  StackedImbalance,
  StatusMessage,
  SubscribeMessage,
  Timeframe,
  UnsubscribeMessage,
  VolumeDeltaUpdateMessage,
} from "./messages";
