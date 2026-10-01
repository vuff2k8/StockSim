# StockSim — Phase 1.75 Core Reconciliation: Checkpoint 1 (Architecture Audit & Migration Blueprint)

A deep-dive architectural audit, authority matrix, critical bug census, and incremental execution blueprint for Phase 1.75 of StockSim.

***

## Executive Summary

StockSim has substantial domain modeling (dense typed arrays in `NumericMarketState`, order tiering, binary codec, multi-market configs). However, the system currently suffers from **split authority**, **main-thread blocking**, **state divergence during fast-forwards**, and **critical accounting flaws in margin, short selling, and conditional orders**.

In accordance with Phase 1.75 rules, **no source code has been modified**. This document establishes the exact current state, target single-authority architecture, line-by-line bug census, and safe migration sequence for Checkpoints 2 through 7.

***

## 1. Current Architecture (As Implemented)

### Data Flow & Component Execution Map

```
[Static Snapshots / Embedded Datasets]
       │ (initialSnapshots.ts: Math.random() & new Date() in history)
       ▼
[WorldManager.createNewWorld] ──> Math.random() for seed; Date.now() for worldId
       │
       ▼
[App.tsx (Root Component)]
       ├── Holds root state: const [worldState, setWorldState] = useState(...)
       ├── Instantiates: simulationScheduler.init(getter, setter, seed)
       │
       ▼  (Synchronous timer: setTimeout 120ms - 600ms)
[SimulationScheduler.ts] ──> executeTickBatch(batchSteps)
       │
       ▼  (Runs ON MAIN THREAD inside setWorldState updater)
[WorldManager.stepSimulation]
       ├── [SimulationClock.tick]
       │       └── Concatenates displayDate + displayTime strings (mixes UTC & local)
       ├── [MarketEngine.step]
       │       └── [NumericMarketState.stepPrices] (Vectorized SoA prices; Date.now() on ring push)
       ├── [ConditionalOrderEngine.evaluateOrders]
       │       └── Evaluates TP/SL/Limit (Fails on TP/SL because remainingQuantity is 0!)
       ├── [Portfolio Mutations in WorldManager.ts (Lines 177-251)]
       │       └── Partial close deletes entire position; short opens without allowShort validation!
       └── [MarginLiquidationEngine.checkAndExecuteLiquidations]
               └── Long liquidation credits gross proceeds without deducting borrowed margin!
       │
       ▼  (Calls setWorldState(next) on every single tick)
[App.tsx Re-render] ──> Entire DOM tree and all pages re-render on every tick!
```

### Disconnected Subsystems

1. **`simulationWorker.ts` & `WorkerSimulationBridge.ts`**: A Web Worker bridge was implemented with message handling (`INIT`, `STEP_BATCH`, `TIME_JUMP`), but `SimulationScheduler` executes synchronously on the main thread and completely ignores the worker.
2. **`PriceEngine.ts`**: Completely superseded by `NumericMarketState` inside `MarketEngine`, yet remains in the repository as dead, duplicate code.
3. **`simulationStore.ts` Granular Subscriptions**: `useSimulationClock`, `usePortfolio`, `useInstrument`, etc., are defined with `useSyncExternalStore`, but `App.tsx` retains a root `worldState` hook that forces full application tree re-renders on every tick.
4. **`server.ts` Market Data Routes**: `/api/market/universe`, `/api/market/quote`, and `/api/market/status` return hardcoded static data from `initialSnapshots.ts`.

***

## 2. Target Architecture (Single Authoritative Source of Truth)

```
┌───────────────────────────────────────────────────────────────────────────────────┐
│                      BACKGROUND SIMULATION WORKER (Authoritative)                 │
├───────────────────────────────────────────────────────────────────────────────────┤
│                                                                                   │
│   [Simulation Clock]                                                              │
│       • Single numeric timestamp (int64 epoch ms)                                 │
│       • Monotonic deterministic tick stepping                                     │
│          │                                                                        │
│          ▼                                                                        │
│   [Market Session Engine]                                                         │
│       • Timezone-aware (Vietnam ICT, US ET, Japan JST, etc.)                      │
│       • Calendar schedule: Pre-market, ATO, Continuous, Lunch, ATC, Closed        │
│       • Controls price fluctuation & order acceptance windows                     │
│          │                                                                        │
│          ├───────────────────────┬───────────────────────┐                        │
│          ▼                       ▼                       ▼                        │
│   [NumericMarketState]    [OrderLifecycleEngine]  [Narrative Engine (Phase 2)]    │
│   • Vectorized Prices     • Strict FSM            • Fictional news / rumors       │
│   • Price Bands (HOSE 7%) • Bracket / OCO         • Social media feed             │
│   • Microstructure Depth  • Partial Fills         • Character dialogue            │
│          │                       │                       │                        │
│          └───────────────────────┼───────────────────────┘                        │
│                                  ▼                                                │
│                   [PortfolioLedgerEngine]                                         │
│                   • Immutable Double-Entry Ledger                                 │
│                   • FIFO/LIFO Position Lots                                       │
│                   • Symmetric Long & Short Margin Accounting                      │
│                   • Non-predatory Maintenance Liquidation                         │
│                                  │                                                │
│                                  ▼                                                │
│                    [Transferable State Snapshot]                                  │
└──────────────────────────────────┬────────────────────────────────────────────────┘
                                   │ (Throttled postMessage at 30-60 FPS)
                                   ▼
┌───────────────────────────────────────────────────────────────────────────────────┐
│                         MAIN THREAD UI LAYER (Presentation Only)                  │
├───────────────────────────────────────────────────────────────────────────────────┤
│                                                                                   │
│   [Worker Bridge] ──> [simulationStore (useSyncExternalStore)]                    │
│                               │                                                   │
│          ┌────────────────────┼────────────────────┐                              │
│          ▼                    ▼                    ▼                              │
│   [Header Clock HUD]  [Trading Terminal]    [Portfolio / Charts]                  │
│   (Subscribes Clock)  (Subscribes Symbol)   (Subscribes Portfolio)                │
│                               │                                                   │
│   [StorageCoordinator] <──────┘ (Lossless IndexedDB Binary Save + CRC32)          │
└───────────────────────────────────────────────────────────────────────────────────┘
```

***

## 3. Authority Conflicts Matrix

| Domain | Current Competing Authorities | Conflict Consequence | Target Authoritative Owner |
| :--- | :--- | :--- | :--- |
| **Simulation Time** | `SimulationClock.ts`, `RealMarketDataProvider.ts` (`new Date()`), `App.tsx`, `Date.now()` in components | Mixed UTC and browser local timezone; date string parsing drifts; market status uses player's wall clock instead of game clock. | **Worker Simulation Clock** (`int64` epoch ms). |
| **Market Session Status** | `RealMarketDataProvider.getMarketStatus`, `server.ts` `/api/market/status`, `SimulationClock.ts` | Server returns hardcoded `"isOpen: true"`, while provider checks `new Date().getHours()` in user's browser, closing the market on Sunday night even if simulation is at 10 AM Monday! | **`MarketSessionEngine`** inside Worker. |
| **Price Calculations** | `NumericMarketState.ts` vs `PriceEngine.ts` | Two pricing engines exist with divergent formula implementations. `PriceEngine.ts` is abandoned. | **`NumericMarketState`** inside Worker. |
| **Simulation Loop** | `SimulationScheduler.ts` (main thread) vs `simulationWorker.ts` (worker thread) | Synchronous simulation runs on UI thread, blocking React rendering, while Web Worker sits idle. | **`simulationWorker.ts`** exclusively. |
| **Order Execution & Positions** | `OrderEngine.submitOrder`, `ConditionalOrderEngine.evaluateOrders`, and `WorldManager.stepSimulation` (lines 171-253) | `WorldManager` and `OrderEngine` have separate, duplicate order execution code with different bugs (e.g. `WorldManager` deletes positions on partial close). | **`OrderLifecycleEngine`** & **`PortfolioLedgerEngine`** in Worker. |
| **Portfolio Valuation** | `PortfolioEngine.ts` vs `MarginLiquidationEngine.calculatePortfolioMetrics` | `PortfolioEngine` delegates to `MarginLiquidationEngine`, but `WorldManager` applies manual cash/PnL deltas that bypass risk recalculations. | **`PortfolioLedgerEngine`** in Worker. |
| **Data Persistence** | `SaveManager.saveGame` (returns synchronous `true`), `StorageService.ts`, `IndexedDBStorageService.ts` | Save reports success before async IndexedDB write finishes; `BinaryCodec` discards transactions, order history, and events upon decode. | **`StorageCoordinator`** on Main Thread. |

***

## 4. Critical Bugs Census (Code Evidence)

### Bug 1: Take Profit & Stop Loss Orders Created with Quantity = 0
- **Location**: `src/game/orders/OrderEngine.ts`, lines 436, 462, 489, 515:
  ```typescript
  quantity,
  filledQuantity: 0,
  remainingQuantity: 0, // <--- CRITICAL BUG: Must be quantity!
  ```
- **Consequence**: Child bracket TP/SL orders have `remainingQuantity: 0`. When evaluated in `ConditionalOrderEngine.ts` (line 70: `let fillQty = order.remainingQuantity;`), the trade executes with quantity 0, leaving the position open and logging empty transactions.

### Bug 2: Partial Close Completely Erases Positions
- **Location**: `src/game/world/WorldManager.ts`, lines 202 and 230:
  ```typescript
  // When closing long:
  delete newPositions[tx.symbol]; // <--- CRITICAL BUG! Ignores tx.quantity vs pos.quantity
  ```
- **Consequence**: If a player holds 500 shares and sells 100 shares, the entire 500-share position is deleted. The remaining 400 shares vanish.

### Bug 3: Fast-Forward Time Jumps Desynchronize Portfolio & Cash
- **Location**: `src/game/world/WorldManager.ts`, lines 348–354:
  ```typescript
  if (orderEval.transactions.length > 0) {
    transactions = [...orderEval.transactions, ...transactions];
    // <--- CRITICAL BUG: Portfolio cash and positions are NEVER updated for these fills!
  }
  ```
- **Consequence**: During `1h`, `1d`, `1w`, or `1m` time jumps, orders trigger and transactions are logged, but cash is not debited/credited and positions are never adjusted.

### Bug 4: Leveraged Liquidation Credits Unborrowed Capital
- **Location**: `src/game/portfolio/MarginLiquidationEngine.ts`, lines 249–250:
  ```typescript
  const proceeds = orderValue - liquidationFee;
  newCash += proceeds; // <--- CRITICAL BUG!
  ```
- **Consequence**: On a 5x leveraged long position (100M total value, 20M player margin, 80M borrowed), if liquidated at 90M, the player's cash is credited with 90M minus fee. The 80M loan is never repaid, multiplying player cash on liquidation.

### Bug 5: Short Positions Falsely Inflate Total Assets
- **Location**: `src/game/portfolio/MarginLiquidationEngine.ts`, lines 61, 98, 157:
  ```typescript
  marketVal = pos.quantity * currentPrice;
  portfolioValue += marketVal; // Adds short liability as positive asset!
  const totalAssets = portfolio.cash + portfolioValue; // Total assets increase!
  ```
- **Consequence**: Short selling increases `portfolioValue` and `totalAssets`, falsely reporting massive wealth gain when taking on a short liability.

### Bug 6: Market Status Checks Player Device Clock Instead of Simulation Time
- **Location**: `src/services/market-data/RealMarketDataProvider.ts`, lines 92–103:
  ```typescript
  const now = new Date(); // <--- CRITICAL BUG: Player's real-world clock!
  const currentHour = now.getHours();
  const dayOfWeek = now.getDay();
  ```
- **Consequence**: If a user plays on a weekend or late evening, all markets show "Closed", blocking trading regardless of simulated morning trading hours.

### Bug 7: Save/Load Binary Codec Discards All History
- **Location**: `src/services/storage/BinaryCodec.ts`, lines 792–796:
  ```typescript
  transactions: [],
  orderHistory: [],
  events: [],
  activeEvents: [],
  ```
- **Consequence**: Decoding a binary save resets transaction history, order history, and active market events to empty arrays.

### Bug 8: Pervasive Nondeterminism Violating Seeded Replay
- **Locations**:
  - `src/data/initialSnapshots.ts` (lines 10, 16, 19–21): `Math.random()` in `generateHistoricalCandles`.
  - `src/game/world/WorldManager.ts` (line 34): `Math.random()` for world seed generation.
  - `src/game/orders/OrderEngine.ts` (lines 246, 261, 417): `Date.now()` and `Math.random()` for IDs.
  - `src/game/numeric/NumericMarketState.ts` (line 124): `Date.now()` on ring buffer pushes.

***

## 5. Safe Migration Order (Phase 1.75 Checkpoints)

```
Checkpoint 1: Architecture Audit & Migration Blueprint (CURRENT - STOP HERE)
     │
     ▼
Checkpoint 2: Market Session Engine & Timezone-Aware Calendar
     • Implement MarketSessionEngine (int64 epoch ms, timezone rules, sessions)
     • Replace new Date() in RealMarketDataProvider with simulated time
     • Backward-compatible: existing clock state converted to numeric ms
     │
     ▼
Checkpoint 3: Order State Machine & Bracket/OCO Lifecycle Fixes
     • Fix remainingQuantity = quantity bug in OrderEngine.ts
     • Unify Order State Machine (CREATED -> PENDING -> TRIGGERED -> PARTIALLY_FILLED -> FILLED)
     • Enforce OCO cancellation and parent-child lifecycle
     │
     ▼
Checkpoint 4: Position Lots & Execution Ledger Accounting
     • Replace flat Record<string, Position> with Position Lots Ledger (FIFO)
     • Fix partial close deletion bug
     • Fix short asset inflation and leveraged liquidation loan settlement
     • Auto-migrate existing flat positions to Lot #1 on load
     │
     ▼
Checkpoint 5: Deterministic Fast-Forward & Unified Jump Logic
     • Unify stepSimulation and advanceTimeJump to share execution paths
     • Enable trigger-aware time skipping without missing order executions
     • Full state update (orders, positions, cash, margin) during time jumps
     │
     ▼
Checkpoint 6: Worker Authority & Main-Thread UI Decoupling
     • Route simulation loop authoritatively to simulationWorker.ts
     • SimulationScheduler becomes a bridge subscriber
     • App.tsx removes root setWorldState on tick; pages consume useSyncExternalStore
     │
     ▼
Checkpoint 7: Lossless Binary Codec & 100% Deterministic Seed Replay
     • Encode transactions, order history, events, and lots in BinaryCodec
     • Eliminate all Math.random() and Date.now() in game engines
     • Verified roundtrip test suite
```

***

## 6. Change Boundaries

### Files That MUST Change in Phase 1.75
1. `src/types/simulation.ts` (numeric timestamp epoch, session phase types)
2. `src/types/order.ts` (order state machine, lot linkage)
3. `src/types/portfolio.ts` (position lots, borrowed funds, debt liabilities)
4. `src/game/simulation/SimulationClock.ts` (numeric math, zero string concatenation)
5. `src/game/simulation/MarketSessionEngine.ts` (NEW: authoritative calendar & sessions)
6. `src/game/orders/OrderEngine.ts` (fix quantity=0 bug, lot creation)
7. `src/game/orders/ConditionalOrderEngine.ts` (partial fill support, OCO links)
8. `src/game/portfolio/PortfolioEngine.ts` (delegate to ledger engine)
9. `src/game/portfolio/MarginLiquidationEngine.ts` (fix liquidation math & short liabilities)
10. `src/game/world/WorldManager.ts` (unify stepSimulation & advanceTimeJump)
11. `src/workers/simulationWorker.ts` (authoritative execution loop)
12. `src/game/simulation/WorkerSimulationBridge.ts` (stream snapshots to store)
13. `src/store/simulationStore.ts` (consume worker snapshots)
14. `src/App.tsx` (remove root tick re-render)
15. `src/services/storage/BinaryCodec.ts` (lossless serialization of history & lots)
16. `src/services/storage/StorageService.ts` (await async IndexedDB completion)

### Files That MUST NOT Change Yet
1. `src/pages/DashboardPage.tsx` (UI layout preserved)
2. `src/pages/StockDetailPage.tsx` (UI layout preserved)
3. `src/pages/MarketsPage.tsx` (UI layout preserved)
4. `src/pages/PortfolioPage.tsx` (UI layout preserved)
5. `src/pages/HistoryPage.tsx` (UI layout preserved)
6. `src/components/TradingTerminalOrderPanel.tsx` (presentation controls preserved; props wired in later checkpoint)
7. `src/components/Header.tsx`, `Sidebar.tsx`, `BottomNav.tsx` (presentation preserved)
8. `src/styles/*` (themes and presets preserved)
9. Phase 2 Narrative files (NPCs, media feeds, dialogue systems must not be created until core engine is verified)

***

## 7. Tests Required Before Checkpoint 2

Before executing Checkpoint 2, the following automated verification tests must be authored and passing:

1. **`test_session_engine.ts`**:
   - Verify HOSE calendar sessions: ATO (09:00–09:15), Continuous (09:15–11:30), Lunch (11:30–13:00), Continuous (13:00–14:30), ATC (14:30–14:45), Closed (15:00+).
   - Verify US NYSE/NASDAQ calendar sessions: Pre-market (04:00–09:30 ET), Regular (09:30–16:00 ET), Post-market (16:00–20:00 ET).
   - Verify weekend rejection: Saturday and Sunday timestamps return `CLOSED_WEEKEND`.
   - Verify timezone isolation: Evaluates correct local session regardless of host device timezone.

2. **`test_order_accounting.ts`**:
   - Verify TP/SL child order creation has `remainingQuantity > 0` matching parent order.
   - Verify partial sell (e.g. sell 100 out of 500 shares) preserves 400 shares with original entry price.
   - Verify short selling does not increase `portfolioValue` or `totalAssets`.
   - Verify leveraged long liquidation repays borrowed principal from gross sale value.

3. **`test_fast_forward_parity.ts`**:
   - Running 100 sequential 1-tick steps vs 1 fast-forward jump of 100 ticks with identical seed produces identical final prices and portfolio values.

***

*Checkpoint 1 Complete. Stopping here per instructions. Awaiting confirmation to proceed to Checkpoint 2.*
