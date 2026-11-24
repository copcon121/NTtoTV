# Exness execution on Oracle

The Oracle build places and manages orders directly through Exness API.
Rithmic supplies GC market data; it does not execute these orders.
MT5 terminal execution and Windows relay fallback are disabled.

## Connection and account currency

Each signed-in profile connects its own Exness API key, API secret and
platform account ID. Account/instrument snapshots supply currency, contract
size, pip/tick value, minimum lot and lot step. Credentials are encrypted in
the execution store; the master key stays outside releases.

The connected account's metadata determines USD or USC automatically.
Balance, PnL and Amount Risk share that account currency. On a USC account,
Risk 10 means 10 USC. Do not multiply it by 100 in the frontend.

The verified USC sizing fixture has contractSize=1, pipValue=0.1,
tickSize=0.001 and minLot=lotStep=0.01. Risk 10 USC with a stop distance of 5
produces 0.02 lot. The former currency multiplier produced 2 lots and could
trigger TRADING_RULE_INSUFFICIENT_MARGIN.

Sizing uses Exness executable prices and instrument metadata, with broker
lot-step rounding and margin checks. GC futures sizing is not applicable to
the Exness gold instrument. A margin rejection remains a broker rejection;
do not bypass it or automatically resubmit an order.

## Execution gates and isolation

- NTTOTV_EXECUTION_MODE defaults to exness; disabled stops execution.
- The old windows value resolves to disabled; other unsupported values fail.
- Live order mutations require NTTOTV_TRADING_ENABLED=1 and
  NTTOTV_LIVE_TRADING_ENABLED=1.
- Orders, credentials, snapshots and events are isolated by signed-in user.
- Legacy mt5 type/module names retained for internal compatibility do not
  enable MT5. Oracle does not mount /api/mt5/* or /api/auto-trade.

## Prices and order lifecycle

GC chart prices and Exness executable quotes belong to different instruments.
Preserve quote freshness and the existing basis conversion for chart entry,
SL and TP levels. A stale basis must block entry.

An HTTP 202 response or broker ACK is not a confirmed fill. Reconcile broker
REST snapshots and events before advancing state. Never automatically retry
an uncertain order mutation: it may already have reached the broker.

At 1R, wait for confirmation of the partial close before starting trailing.
Preserve account ownership, broker rule validation and error reporting for
entries, modifications and closes.

## Verification and operations

Use fake gateways and sanitized account/instrument fixtures for tests.
Do not place, change or close live orders just to verify code.

Focused tests cover execution mode, Oracle isolation, Exness sizing and
REST/event reconciliation. Run frontend typecheck/tests/build for ticket or
currency changes. Read AGENTS.md before accessing Oracle. Never print or copy
API secrets, credential databases, master keys or protected Admin settings.
