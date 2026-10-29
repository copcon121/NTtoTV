# MP, GC options, and daily/session planning

Research date: 2026-10-27 (Asia/Bangkok).

Scope: source inspection of the Windows NTtoTV repository and public primary-source documentation. This memo is a proposed design. It does not establish today's market conditions, options entitlements, live data coverage, or trading profitability.

## Recommended decision

Build an MP session planner around deterministic market facts and conditional playbooks. Add GC options end-of-day context first. Use the existing LLM transport to explain and organize the playbooks in Vietnamese. Add intraday options analytics only after measuring their incremental value.

The initial product should answer four questions:

1. Is the auction currently balancing within prior value or finding acceptance outside it?
2. Which locations are relevant, and what observable confirmation is needed there?
3. What invalidates the active scenario, and which scenario then becomes eligible?
4. Are the data, event calendar, and remaining potential reward adequate to use the plan?

Technical integration is feasible using existing infrastructure. Reliable options acquisition depends on coverage and licensing. An improvement in scalp results is an unproven hypothesis that needs testing.

## What the repository already provides

| Existing component | Finding | Consequence |
| --- | --- | --- |
| `frontend/src/marketProfile/MarketProfilePage.tsx` | `/mp` supports volume, delta, and TPO profiles, VAH/VAL/POC, and recent sessions. | Extend this page with context overlays and a plan panel. |
| MP session constants | The current template uses UTC+7 with a fixed 05:00 open and 04:00 close. | Make the reference session explicit. A fixed local template cannot represent both US daylight and standard time exchange sessions. |
| `backend/app/engines/session_calendar.py` | GC exchange-session helpers already handle US Central DST. | Reuse a shared session definition and add holiday/early-close handling. |
| `backend/app/rest/orderflow.py::_minute_bar_profile_to_dict` | The minute-bar profile allocates each minute's volume across its touched price range. This is an intentional approximation. | Mark it as approximate; do not present it as observed trade volume at each price. |
| MP profile selection | Volume mode defaults to `minute_bars`; delta mode requests `footprint_cache`. | Record the profile method in every snapshot. Missing footprint data must remain missing. |
| MP TPO builder | TPO is built in the browser with 30-minute brackets and a 70% value-area setting. | Provide a canonical server-side calculation for planning, with the same settings as the displayed profile. Keep TPO VA and volume VA distinct. |
| `backend/app/analyst/snapshot_builder.py` | Current snapshots contain SMC/CVD context for H1/M15/M5. They do not contain the proposed MP/options context. | Add a separate planning snapshot and schema. Reusing the client alone will not supply the missing facts. |
| Existing analyst | Manual reports and an event-driven M5 POI scanner already exist. The old 30-minute auto-send interface is a compatibility path. | Add session planning without changing the existing POI scanner's meaning. |
| `backend/app/analyst/llm_client.py` | The current client uses structured output and prohibits automatic trading and M1 analysis. | Reuse transport, validation patterns, and audit infrastructure. Give the planner its own context contract. Leave scalp timing outside the LLM. |
| `backend/app/rithmic/service.py::probe_options` | There is a bounded option-reference probe over the existing Ticker Plant connection. | This is useful groundwork, not proof of quote/OI/IV access. Avoid opening a second competing Rithmic session. |

The source was inspected without reading runtime credentials, querying account settings, invoking options probes, placing orders, or changing runtime services. CodeGraph was attempted first; its CLI was unavailable in this execution environment.

## Define the session before interpreting value

Keep an exchange trading-day profile and separate named Asia, London, and New York analysis windows. Version their definitions and use exchange/local time zones with DST, rather than fixed UTC offsets for London or New York.

An opening price must identify its window: Globex open, London-window open, and New York-window open are different observations. A prior close and official settlement are also different values. The previous session means the previous completed eligible trading session, including weekend and holiday rules.

Before today's session closes, today's closing price cannot be an input. A pre-session snapshot can contain yesterday's completed close, today's observed open, and the last price as of the snapshot. If the intended condition is yesterday's close inside the value area of the day before yesterday, store that relationship explicitly.

Freeze the prior completed session's VAH/VAL/POC. Developing value for today is a separate, time-stamped object. A 70% profile value area is a construction rule; it is not a 70% probability of future price containment.

## Data to include, in priority order

| Priority | Data | Use in planning |
| --- | --- | --- |
| P0 | Prior session open, high, low, close, settlement where available, VAH, VAL, POC, VA width, range, volume | Establish the prior auction and opening location. |
| P0 | The previous 3-5 sessions plus a configurable 5-20-session composite | Measure value overlap, migration, repeated balance, and nearby prior value outside yesterday's range. |
| P0 | Current open, overnight/window highs and lows, gap, developing VA/POC, session VWAP, initial balance | Detect whether the original scenario remains valid as the session develops. Initial balance uses only elapsed, completed data. |
| P0 | Relative volume and realized range/volatility for the same elapsed session time | Distinguish ordinary rotation from unusual expansion without comparing an incomplete session to a full day. |
| P0 | Scheduled macro releases, holidays, early closes, and option expiration timestamps | Mark when conditions may change and when a plan needs reassessment. |
| P1 | Delta/CVD, footprint response, and observed liquidity behavior around a level | Confirm or challenge a level interaction. Preserve feed provenance, coverage, and classification quality. |
| P1 | GC options OI, prior OI, OI change, volume, strike, put/call, expiry, and actual underlying future | Build an options concentration map by expiry. These are candidate context locations, not automatic reversal levels. |
| P1 | Short-dated ATM IV and, when liquid, 7-day/30-day term context | Put the session's movement into a forward-looking volatility context. |
| P2 | 25-delta call/put skew, IV changes, gamma concentration | Add risk asymmetry and sensitivity context only when quote/model quality supports it. |
| P2 | DXY/rates or other cross-market context | Add later if it explains measurable failures of the core plan. |

Use standard GC futures options as the primary options universe. CME lists Gold weekly expirations on weekdays, with exchange exceptions. Actual option-to-futures mapping must come from reference data; expiration month alone is insufficient. See [CME Metals Weekly FAQ](https://www.cmegroup.com/articles/faqs/metals-weekly-options.html) and [Gold Weekly Option rules](https://www.cmegroup.com/rulebook/COMEX/10/1008.pdf).

For the pilot, inspect all relevant expiries but display separate groups for the next 0-2 trading days, the next liquid weekly expiry, and the nearest liquid monthly expiry. Expand when a more distant expiry has material near-price concentration. Do not assume the nearest expiry is the most liquid.

Do not use GLD option strikes as exact GC levels. GLD, a GC delivery month, and a broker's XAUUSD instrument have different price mappings. Any cross-instrument display or execution mapping needs contemporaneous basis data and a visible conversion method.

## What options data can and cannot establish

OI describes outstanding contracts, with both a long and short side. OI alone does not identify dealer inventory, the aggressor, or whether today's trade opened or closed exposure. Therefore a large call strike is an OI concentration, not proven resistance; a large put strike is not proven support. This limitation follows from the definition, rather than from a directional trading rule. See [CME Open Interest](https://www.cmegroup.com/education/lessons/open-interest).

Treat OI as a dated clearing/statistics observation. Its trade date, publication time, preliminary/final status, and receipt time must be retained. EOD data can be corrected after initial publication. See [CME End of Market Summary](https://cmegroupclientsite.atlassian.net/wiki/spaces/EPICSANDBOX/pages/457225547/End%2Bof%2BMarket%2BSummary%2B-%2BStandard).

Prefer an unsigned, clearly labeled gamma-weighted concentration map initially. A signed dealer GEX or gamma-flip estimate requires an explicit inventory/sign model and should show sensitivity to its assumptions. Do not silently assign all calls and puts opposite dealer signs. Defer max pain, directional put/call signals, and inferred options sweeps until they add measured value.

For an approximate volatility scale, the backend may calculate `F * annualized_IV * sqrt(horizon_in_years)`, with the reference future, annualization convention, horizon, IV tenor, and method recorded. This is an approximation to a model-implied price-change scale. It is not an observed high-low range or a guaranteed containment probability. Calibrate session horizons using actual same-window history and event days. An ATM straddle premium is a different measure and should not be relabeled as one standard deviation.

Gold CVOL supplies approximately 30-day volatility context, not a direct prediction of the next scalp. See [CME CVOL methodology FAQ](https://www.cmegroup.com/market-data/cme-group-benchmark-administration/cme-group-volatility-indexes-faq.html).

## Acquisition choices

| Route | Verified public capability or source finding | Role in the proposal |
| --- | --- | --- |
| CME/QuikStrike public tools | Product/expiry, OI, and volatility research tools exist. | Cross-check a pilot manually; do not base production on scraping a chart UI. |
| CME DataMine EOD | EOD products include prices, OI, volume, settlement, delta, and IV, depending on dataset. Purchased data has programmatic delivery. | Preferred reference route for dated daily inputs and reproducible history, subject to an appropriate quote/license. |
| Existing Rithmic connection | Repository code can request option reference metadata. Live field coverage and account entitlements were not tested. | Validate this route first before purchasing a duplicate streaming feed. Test reference, quotes, statistics, and history separately. |
| CME Options Analytics REST | GC is listed; IV/Greeks are available as five-minute snapshots for eligible two-sided markets. | Optional managed intraday analytics, reducing local modeling work. |
| Databento CME data | Native futures options, definitions, and OI statistics are available; IV/Greeks are not precomputed. | Alternative raw-data route if Rithmic is insufficient or independent historical coverage is needed. |

Sources: [CME DataMine](https://www.cmegroup.com/datamine.html), [DataMine API](https://www.cmegroup.com/datamine/datamine-api.html), and [Databento options documentation](https://databento.com/options).

The CME IV/Greeks API explicitly excludes OI, volume, and settlement. Join these from a separate feed. A missing analytics row can mean that no eligible two-sided market existed; it must not become zero IV or gamma. Its REST history is for the current trading week; longer history is a separate acquisition. See [CME analytics FAQ](https://cmegroupclientsite.atlassian.net/wiki/spaces/EPICSANDBOX/pages/871628804/Options%2BAnalytics%2B-%2BGreeks%2Band%2BImplied%2BVolatility%2B-%2BFAQ) and [API documentation](https://cmegroupclientsite.atlassian.net/wiki/spaces/EPICSANDBOX/pages/871366660/CME%2BOptions%2BAnalytics%2B-%2BGreeks%2Band%2BImplied%2BVolatility%2BREST%2BAPI).

If calculating IV/Greeks locally, use the actual contract's exercise style, price units, expiry time, future, and an appropriate model. Do not apply an equity-option model or Black-76 to all GC contracts without checking assumptions. CME's product list identifies its Gold analytics model as Bjerksund Stensland 1993. See [CME analytics product/model list](https://cmegroupclientsite.atlassian.net/wiki/spaces/EPICSANDBOX/pages/871596033/Options%2BAnalytics%2B-%2BGreeks%2Band%2BImplied%2BVolatility%2B-%2BProduct%2BList).

Obtain prices for the actual use case: personal display, backend/non-display analysis, retention, third-party LLM processing, and any multi-user publication. A non-professional display price is not a quote for this whole pipeline. CME publishes separate categories and AI data controls: [2026 analytics fee schedule](https://www.cmegroup.com/market-data/files/analytics-data-fee-list-june-2026.pdf), [policy center](https://www.cmegroup.com/market-data/license-data/market-data-policy-education-center.html), and [AI advisory](https://www.cmegroup.com/files/download/ai-data-services-advisory.pdf). Exact applicable total cost remains unverified.

Use [BLS release calendars](https://www.bls.gov/schedule/news_release/) and the [Federal Reserve FOMC calendar](https://www.federalreserve.gov/monetarypolicy/fomccalendars.htm) as authoritative event references. A production calendar adapter should preserve its retrieval time and explicitly indicate missing coverage.

## Translate the proposed range trade into conditional playbooks

The user's example is a useful initial hypothesis: the current session opens inside the prior completed session's value, with evidence of balance. It does not establish that the whole day will stay inside value.

| Scenario | Required observations | Candidate response | Invalidating evidence |
| --- | --- | --- | --- |
| A: rotation | Open inside prior VA, continuing two-way trade, no sustained acceptance outside it | Watch for rejection at VAL/VAH; first reference is POC/VWAP, then reassess the opposite edge | Acceptance outside value, directional value migration, unusual expansion, or a major event changes conditions |
| B: upside acceptance | Trade holds above VAH, activity builds there, and a retest does not immediately fail | Stop repeatedly fading VAH; evaluate a pullback toward the next verified reference | Re-entry and acceptance back inside prior value |
| C: downside acceptance | Corresponding observations below VAL | Stop repeatedly buying VAL; evaluate downside continuation | Re-entry and acceptance back inside prior value |
| D: stand aside | Missing data, major unresolved conflict, poor reward relative to risk/cost, or unstable event conditions | Await better information | A new qualified snapshot changes the state |

Rejection means an observed test followed by a return/hold inside the prior region, with compatible price/activity evidence. Acceptance needs a configured, testable combination of elapsed time, closes, volume outside the boundary, and/or retest behavior. A wick alone is insufficient. Any example such as two M5 closes is a candidate parameter, not an established edge.

At a VA edge, precompute candidate entry-reference zones, structural invalidation, and target references in code. Calculate reward/risk after the intended instrument's spread, fees, and slippage. Avoid prescribing a universal stop distance for every session.

Options context can change how cautiously the rotation scenario is treated: proximity to a concentrated strike, volatility repricing, or an imminent expiry can justify monitoring or reassessment. It cannot override observed acceptance using an assumed wall. Prefer target zones at the nearest relevant verified reference; do not promise a full VAL-to-VAH traversal.

All examples above are hypothetical playbook definitions, not an assessment or trade recommendation for today's tape.

## LLM implementation

Use the following flow:

```text
Existing chart cache + session calendar + options adapter + event calendar
  -> deterministic session features and quality checks
  -> versioned, immutable planning snapshot
  -> eligible playbooks and numeric levels
  -> LLM structured Vietnamese explanation
  -> semantic validator
  -> /mp planning panel and saved plan revision
```

The LLM should receive a compact summary of the previous 3-5 completed sessions, a longer composite, current session observations, options features, event times, and relevant historical statistics. It does not need raw full-depth frames, an entire option chain, account settings, or a chart screenshot as its primary fact source.

Backend calculations should provide allowed `levelId`, `scenarioId`, `triggerId`, and evidence references. The LLM selects and explains from these objects. Validate factual references and target/stop ordering after generation. Prefer resolving displayed numeric prices from the backend level catalog instead of trusting newly generated numbers.

Structured output controls the response shape, not factual accuracy or trading performance. OpenAI explicitly notes that structured outputs may still contain mistakes. See [official OpenAI Structured Outputs documentation](https://developers.openai.com/api/docs/guides/structured-outputs).

Proposed output contract:

```text
planId, revision, snapshotId, asOf, validUntil, sessionId
regime: balance_candidate | upside_acceptance | downside_acceptance | unknown
dataQuality, missingInputs, evidenceRefs
baseScenario, alternativeScenarios, standAsideConditions
levelIds, triggerIds, invalidationIds, targetIds
nextReviewEvents, explanationVi
```

Keep qualitative evidence strength separate from any historical success probability. A probability should identify its sample definition, count, evaluation window, and uncertainty; otherwise omit it. An LLM's confidence is not a measured win rate.

Generate an initial daily plan and a plan before each enabled session window. Reassess after the initial balance, a confirmed change of acceptance, a material event, or a user request. Use deduplication and a budget cap. Tick-by-tick state checking stays in code; LLM work runs asynchronously outside ingestion. Mark an invalidated plan immediately while a replacement is pending.

Preserve the existing manual-timing approach. The planning LLM supplies context and conditional scenarios; observed scalp triggers and position decisions remain with the trader. Options availability is not a prerequisite for an MP-only plan, but absent options must be visible.

## Suggested repository changes for an implementation phase

Create session/profile feature helpers and an options-provider abstraction, then add a planning snapshot builder and playbook engine beside the existing analyst module. Add a separate plan schema/prompt and routes such as `GET /api/plans/latest` and authenticated `POST /api/plans/run`. These are proposed routes, not currently implemented endpoints.

Keep chart history under logical contract `GC`. Options records also need the real underlying future, immutable instrument identity, and expiry. Never merge options rows into the chart's trade or footprint input streams. Reuse existing storage/worker patterns; introduce new tables through a migration rather than manual live SQLite edits.

Suggested persistent objects: option definitions, dated OI statistics, quote/analytics snapshots, session features, and immutable plan revisions. Store source/event/publication/receipt times, quality, calculation version, and snapshot linkage. Retention and raw-option-history scope should be configurable and priced before enabling broad collection.

On `/mp`, show only a few nearby strike concentrations and optional expected-move shading. Keep option OI units separate from futures volume/TPO. The plan panel should show active scenario, evidence, required confirmation, invalidation, alternatives, timestamp, and missing-data status. Let the user inspect source/expiry details without covering the chart with every strike.

## Validation and rollout

1. Establish the canonical session/profile definitions and build an MP-only rule baseline. Check DST transitions, holidays, prior-session freezing, incomplete initial balance, and footprint gaps.
2. Validate a small options sample through an allowed data route. Compare definitions, underlying mapping, near-expiry coverage, quotes, OI dates, and publication timing with independent official references. The source probe alone is not sufficient.
3. Add EOD options context with deterministic playbooks and LLM explanations. Save the exact facts, rules, prompt/model version, output, and changes.
4. Compare MP-only, MP plus options, and MP plus options plus LLM on the same chronological holdout. Freeze execution/cost rules for comparisons. Test LLM planning separately from its quality as an explanation interface.
5. Run a prospective shadow pilot for roughly 20-30 sessions to test operability and collect cases. This pilot is not enough by itself to establish profitability. Seek a longer sample across balance, trend, event, and expiry regimes before promoting filters.
6. Add limited five-minute options analytics only if EOD/live comparisons identify a useful improvement that justifies the additional data and modeling cost.

Use chronological walk-forward evaluation, separated by sessions, with transaction costs and an explicit ambiguity policy for bars that touch both stop and target. Examine net expectancy, drawdown, adverse/favorable excursion, missed trend days, false fades at VA edges, sample size, and results by regime. Do not choose the best-looking thresholds on the final holdout.

Every historical feature must have been available at the plan time. Do not use today's completed profile in a morning plan, the day's final OI before publication, or later revisions without their original availability timestamp. The current `SnapshotBuilder.build(snapshot_time=...)` stamps a time but reads the latest cache rows without a historical cutoff; it is not a historical-replay implementation.

The immediate deliverable for implementation should be an MP session context and planning panel with dated options inputs, explainable scenario transitions, and a replayable journal. Intraday options analytics, signed dealer GEX, and broader cross-market models should follow evidence from that baseline.
