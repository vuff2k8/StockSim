import React, { useState, useEffect, useRef, useCallback, useMemo, Suspense } from 'react';
import { WorldState } from './types/world';
import { Instrument } from './types/market';
import { OrderSide, OrderTier, FeeConfig } from './types/order';
import { SimulationSpeed } from './types/simulation';
import { UiPreset } from './types/ui';
import { THEMES } from './styles/theme';
import { createDefaultUiSettings } from './styles/presets';
import { WorldManager } from './game/world/WorldManager';
import { OrderEngine, SubmitOrderParams } from './game/orders/OrderEngine';
import { SaveManager } from './game/world/SaveManager';
import { simulationScheduler } from './game/simulation/SimulationScheduler';
import { simulationStore } from './store/simulationStore';
import { SUPPORTED_MARKETS } from './data/markets';
import { MarginLiquidationEngine } from './game/portfolio/MarginLiquidationEngine';

// Components
import { Header } from './components/Header';
import { MarketStatusBanner } from './components/MarketStatusBanner';
import { BottomNav, NavTab } from './components/BottomNav';
import { Sidebar } from './components/Sidebar';
import { TradingTerminalOrderPanel } from './components/TradingTerminalOrderPanel';

// Lazy Loaded Pages and Modals for Bundle Splitting
const CreateWorldPage = React.lazy(() =>
  import('./pages/CreateWorldPage').then((m) => ({ default: m.CreateWorldPage }))
);
const PerformanceDebugPanel = React.lazy(() =>
  import('./components/PerformanceDebugPanel').then((m) => ({ default: m.PerformanceDebugPanel }))
);
const SettingsPage = React.lazy(() =>
  import('./pages/SettingsPage').then((m) => ({ default: m.SettingsPage }))
);

// Standard Pages
import { DashboardPage } from './pages/DashboardPage';
import { MarketsPage } from './pages/MarketsPage';
import { StockDetailPage } from './pages/StockDetailPage';
import { PortfolioPage } from './pages/PortfolioPage';
import { HistoryPage } from './pages/HistoryPage';

export default function App() {
  const [worldState, setWorldState] = useState<WorldState | null>(() => simulationStore.getState());
  const [isInitializing, setIsInitializing] = useState(true);
  const [showCreateWorldModal, setShowCreateWorldModal] = useState(false);
  const [activeTab, setActiveTab] = useState<NavTab>('home');
  const [selectedStockSymbol, setSelectedStockSymbol] = useState<string | null>(null);

  // Quick Order Modal
  const [quickOrderState, setQuickOrderState] = useState<{
    isOpen: boolean;
    instrument: Instrument | null;
    side: OrderSide;
    tier: OrderTier;
  }>({
    isOpen: false,
    instrument: null,
    side: 'BUY',
    tier: 'BASIC',
  });

  const worldStateRef = useRef<WorldState | null>(null);
  worldStateRef.current = worldState;

  // 1. Initial World Load / Bootstrap from IndexedDB with sync fallback
  useEffect(() => {
    async function init() {
      try {
        const saved = (await SaveManager.loadGameAsync()) || SaveManager.loadGame();
        let activeWorld: WorldState;

        if (saved) {
          activeWorld = saved;
          if (!activeWorld.openOrders) activeWorld.openOrders = [];
          if (!activeWorld.orderHistory) activeWorld.orderHistory = [];
          if (!activeWorld.uiSettings) activeWorld.uiSettings = createDefaultUiSettings('trader');
          if (!activeWorld.marketConfig.rules) {
            activeWorld.marketConfig.rules = SUPPORTED_MARKETS[activeWorld.marketConfig.id]?.rules || SUPPORTED_MARKETS.vietnam.rules;
          }
          activeWorld.portfolio = MarginLiquidationEngine.calculatePortfolioMetrics(
            activeWorld.portfolio,
            activeWorld.instruments,
            activeWorld.marketConfig.rules
          );
        } else {
          activeWorld = await WorldManager.createNewWorld({
            marketId: 'vietnam',
            difficulty: 'normal',
          });
        }

        simulationStore.setState(activeWorld);
        setWorldState(activeWorld);

        // Initialize authoritative SimulationScheduler
        simulationScheduler.init(
          () => simulationStore.getState() || worldStateRef.current,
          (updater) => {
            const current = simulationStore.getState() || worldStateRef.current;
            if (!current) return;
            const next = updater(current);
            simulationStore.setState(next);
            setWorldState(next);
            worldStateRef.current = next;
          },
          activeWorld.snapshot.seed
        );

        if (!activeWorld.clock.isPaused && activeWorld.clock.speed > 0) {
          simulationScheduler.start();
        }
      } catch (err) {
        console.error('Failed to initialize world', err);
      } finally {
        setIsInitializing(false);
      }
    }

    init();

    return () => {
      simulationScheduler.destroy();
    };
  }, []);

  // 2. Play / Pause Handlers via SimulationScheduler
  const handleTogglePlay = useCallback(() => {
    setWorldState((prev) => {
      if (!prev) return prev;
      const nextPaused = !prev.clock.isPaused;
      if (nextPaused) {
        simulationScheduler.pause();
      } else {
        simulationScheduler.resume();
      }
      const updated: WorldState = {
        ...prev,
        clock: { ...prev.clock, isPaused: nextPaused },
      };
      simulationStore.setState(updated);
      SaveManager.saveGame(updated);
      return updated;
    });
  }, []);

  const handleChangeSpeed = useCallback((speed: SimulationSpeed) => {
    simulationScheduler.setSpeed(speed);
    setWorldState((prev) => {
      if (!prev) return prev;
      const updated: WorldState = {
        ...prev,
        clock: { ...prev.clock, speed, isPaused: speed === 0 },
      };
      simulationStore.setState(updated);
      SaveManager.saveGame(updated);
      return updated;
    });
  }, []);

  // 3. Fast Batch Time Jump Handlers (1H, 1D, 1W, 1M)
  const handleAdvanceTime = useCallback((jump: '1h' | '1d' | '1w' | '1m') => {
    simulationScheduler.advanceTimeJump(jump);
  }, []);

  // 4. Submit Order Handler
  const handleSubmitOrder = useCallback(
    (params: SubmitOrderParams) => {
      if (!worldState) return { success: false, errorMessage: 'Thế giới chưa sẵn sàng.' };

      const activeRules = worldState.marketConfig.rules || SUPPORTED_MARKETS[worldState.marketConfig.id]?.rules || SUPPORTED_MARKETS.vietnam.rules;
      const activeFee: FeeConfig = {
        rate: worldState.settings.marketFeeRate,
        minFee: 0,
      };

      const result = OrderEngine.submitOrder(
        params,
        worldState.portfolio,
        activeFee,
        worldState.marketConfig,
        worldState.clock.displayDate + 'T' + worldState.clock.displayTime + '.000Z'
      );

      if (result.success) {
        let updatedPortfolio = result.updatedPortfolio || worldState.portfolio;
        let updatedTransactions = result.transaction
          ? [result.transaction, ...(worldState.transactions || [])]
          : worldState.transactions || [];
        let updatedOpenOrders = result.newOpenOrders
          ? [...result.newOpenOrders, ...(worldState.openOrders || [])]
          : worldState.openOrders || [];

        // Run immediate portfolio risk update
        updatedPortfolio = MarginLiquidationEngine.calculatePortfolioMetrics(
          updatedPortfolio,
          worldState.instruments,
          activeRules
        );

        const nextState: WorldState = {
          ...worldState,
          portfolio: updatedPortfolio,
          transactions: updatedTransactions,
          openOrders: updatedOpenOrders,
          version: worldState.version + 1,
        };

        simulationStore.setState(nextState);
        setWorldState(nextState);
        SaveManager.saveGame(nextState);
        return { success: true };
      }

      return {
        success: false,
        errorMessage: result.errorMessage || 'Không thể thực hiện lệnh.',
      };
    },
    [worldState]
  );

  // 5. Cancel Order Handler
  const handleCancelOrder = useCallback((orderId: string) => {
    setWorldState((prev) => {
      if (!prev) return prev;
      const open = prev.openOrders || [];
      const target = open.find((o) => o.id === orderId);
      if (!target) return prev;

      const remaining = open.filter((o) => o.id !== orderId);
      const cancelled = {
        ...target,
        status: 'CANCELLED' as const,
        updatedAt: new Date().toISOString(),
        cancellationReason: 'Người dùng chủ động hủy lệnh',
      };

      const updated: WorldState = {
        ...prev,
        openOrders: remaining,
        orderHistory: [cancelled, ...(prev.orderHistory || [])],
        version: prev.version + 1,
      };

      simulationStore.setState(updated);
      SaveManager.saveGame(updated);
      return updated;
    });
  }, []);

  // 6. Watchlist Toggle
  const handleToggleWatchlist = useCallback((symbol: string) => {
    setWorldState((prev) => {
      if (!prev) return prev;
      const exists = prev.watchlist.includes(symbol);
      const nextWatchlist = exists
        ? prev.watchlist.filter((s) => s !== symbol)
        : [...prev.watchlist, symbol];
      const updated: WorldState = {
        ...prev,
        watchlist: nextWatchlist,
      };
      simulationStore.setState(updated);
      SaveManager.saveGame(updated);
      return updated;
    });
  }, []);

  // 7. UI Preset Switcher
  const handleUpdatePreset = useCallback((preset: UiPreset) => {
    setWorldState((prev) => {
      if (!prev) return prev;
      const defaultSettings = createDefaultUiSettings(preset);
      const updated: WorldState = {
        ...prev,
        uiSettings: {
          ...prev.uiSettings,
          preset,
          density: defaultSettings.density,
          activeOrderTier: defaultSettings.activeOrderTier,
          widgets: defaultSettings.widgets,
        },
      };
      simulationStore.setState(updated);
      SaveManager.saveGame(updated);
      return updated;
    });
  }, []);

  // 8. World Creation Handler
  const handleWorldCreated = useCallback((newWorld: WorldState) => {
    simulationStore.setState(newWorld);
    setWorldState(newWorld);
    setShowCreateWorldModal(false);
    setSelectedStockSymbol(null);
    setActiveTab('home');

    simulationScheduler.init(
      () => simulationStore.getState(),
      (updater) => {
        const cur = simulationStore.getState();
        if (!cur) return;
        const next = updater(cur);
        simulationStore.setState(next);
        setWorldState(next);
      },
      newWorld.snapshot.seed
    );

    if (!newWorld.clock.isPaused && newWorld.clock.speed > 0) {
      simulationScheduler.start();
    }
  }, []);

  // 9. Reset World Handler
  const handleResetWorld = useCallback(() => {
    SaveManager.resetGame();
    simulationScheduler.destroy();
    setWorldState(null);
    setShowCreateWorldModal(true);
  }, []);

  const selectedInstrument = useMemo(() => {
    if (!selectedStockSymbol || !worldState) return null;
    return worldState.instruments[selectedStockSymbol] || null;
  }, [worldState, selectedStockSymbol]);

  if (isInitializing) {
    return (
      <div className="min-h-screen bg-neutral-950 flex flex-col items-center justify-center text-neutral-400 gap-3">
        <div className="w-8 h-8 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin"></div>
        <p className="font-mono text-xs">Đang tải thế giới mô phỏng StockSim...</p>
      </div>
    );
  }

  if (!worldState || showCreateWorldModal) {
    return (
      <Suspense fallback={<div className="min-h-screen bg-neutral-950 flex items-center justify-center text-xs font-mono text-neutral-400">Đang mở trình tạo thế giới...</div>}>
        <CreateWorldPage
          onWorldCreated={handleWorldCreated}
          onCancel={worldState ? () => setShowCreateWorldModal(false) : undefined}
          hasExistingWorld={!!worldState}
        />
      </Suspense>
    );
  }

  const openPositionsCount = Object.keys(worldState.portfolio.positions).length;
  const openOrdersCount = worldState.openOrders?.length || 0;
  const activeFeeConfig: FeeConfig = {
    rate: worldState.settings.marketFeeRate,
    minFee: 0,
  };

  const themeTokens = THEMES[worldState.uiSettings?.theme || 'dark'] || THEMES.dark;

  return (
    <div
      id="app-scroll-container"
      className="w-full h-[100dvh] min-h-0 overflow-y-auto overflow-x-hidden flex flex-col font-sans transition-colors"
      style={{
        WebkitOverflowScrolling: 'touch',
        backgroundColor: themeTokens.background,
      }}
    >
      {/* 1. Header with Clock and Speed controls */}
      <Header
        clock={worldState.clock}
        marketConfig={worldState.marketConfig}
        worldId={worldState.snapshot.id}
        onTogglePlay={handleTogglePlay}
        onChangeSpeed={handleChangeSpeed}
        onAdvanceTime={handleAdvanceTime}
        onOpenNewWorldModal={() => setShowCreateWorldModal(true)}
      />

      {/* 2. Market Status Banner with Real Data and Simulation indicators */}
      <MarketStatusBanner
        sourceTimestamp={worldState.snapshot.sourceTimestamp}
        marketName={worldState.marketConfig.name}
        isPaused={worldState.clock.isPaused}
        speed={worldState.clock.speed}
      />

      {/* 3. Main Body: Sidebar (Desktop) + Viewport Content */}
      <div className="flex-1 flex max-w-7xl w-full mx-auto">
        <Sidebar
          currentTab={activeTab}
          onSelectTab={(tab) => {
            setSelectedStockSymbol(null);
            setActiveTab(tab);
          }}
          marketIndex={worldState.marketIndex}
          portfolio={worldState.portfolio}
          openPositionsCount={openPositionsCount}
          openOrdersCount={openOrdersCount}
        />

        {/* Viewport Content */}
        <main className="flex-1 p-3 md:p-6 min-h-0 h-auto overflow-visible pb-24 md:pb-8">
          {selectedInstrument ? (
            <StockDetailPage
              instrument={selectedInstrument}
              portfolio={worldState.portfolio}
              marketConfig={worldState.marketConfig}
              feeConfig={activeFeeConfig}
              isWatchlisted={worldState.watchlist.includes(selectedInstrument.symbol)}
              onToggleWatchlist={handleToggleWatchlist}
              onBack={() => setSelectedStockSymbol(null)}
              onSubmitOrder={handleSubmitOrder}
            />
          ) : activeTab === 'home' ? (
            <DashboardPage
              worldState={worldState}
              onSelectInstrument={(symbol) => setSelectedStockSymbol(symbol)}
              onCancelOrder={handleCancelOrder}
              onNavigateTab={(tab) => setActiveTab(tab)}
              onUpdatePreset={handleUpdatePreset}
            />
          ) : activeTab === 'markets' ? (
            <MarketsPage
              instruments={worldState.instruments}
              onSelectInstrument={(symbol) => setSelectedStockSymbol(symbol)}
              onOpenOrderModal={(inst) =>
                setQuickOrderState({
                  isOpen: true,
                  instrument: inst,
                  side: 'BUY',
                  tier: 'BASIC',
                })
              }
            />
          ) : activeTab === 'portfolio' ? (
            <PortfolioPage
              portfolio={worldState.portfolio}
              instruments={worldState.instruments}
              marketConfig={worldState.marketConfig}
              onSelectInstrument={(symbol) => setSelectedStockSymbol(symbol)}
              onOpenOrderModal={(inst, side, tier = 'BASIC') =>
                setQuickOrderState({
                  isOpen: true,
                  instrument: inst,
                  side,
                  tier,
                })
              }
              onSubmitOrder={handleSubmitOrder}
              onNavigateTab={(tab) => setActiveTab(tab)}
            />
          ) : activeTab === 'history' ? (
            <HistoryPage
              transactions={worldState.transactions}
              orderHistory={worldState.orderHistory || []}
              onSelectInstrument={(symbol) => setSelectedStockSymbol(symbol)}
            />
          ) : (
            <Suspense fallback={<div className="p-4 text-xs font-mono text-neutral-400">Đang tải Cài đặt...</div>}>
              <SettingsPage
                worldState={worldState}
                onWorldUpdated={(updated) => {
                  simulationStore.setState(updated);
                  setWorldState(updated);
                }}
                onOpenCreateWorld={() => setShowCreateWorldModal(true)}
                onResetWorld={handleResetWorld}
              />
            </Suspense>
          )}
        </main>
      </div>

      {/* 4. Bottom Navigation for Mobile */}
      <BottomNav
        currentTab={activeTab}
        onSelectTab={(tab) => {
          setSelectedStockSymbol(null);
          setActiveTab(tab);
        }}
        openPositionsCount={openPositionsCount}
        openOrdersCount={openOrdersCount}
      />

      {/* Quick Order Modal with 3-tier Trading Terminal Panel */}
      {quickOrderState.isOpen && quickOrderState.instrument && (
        <div
          className="fixed inset-0 z-50 overflow-y-auto overflow-x-hidden bg-black/80 backdrop-blur-xs p-3 pb-24 md:pb-8 flex justify-center items-start"
          style={{ WebkitOverflowScrolling: 'touch' }}
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setQuickOrderState((prev) => ({ ...prev, isOpen: false }));
            }
          }}
        >
          <div className="w-full max-w-md my-auto sm:my-8 h-auto min-h-max overflow-visible">
            <TradingTerminalOrderPanel
              instrument={quickOrderState.instrument}
              portfolio={worldState.portfolio}
              marketConfig={worldState.marketConfig}
              feeConfig={activeFeeConfig}
              activeTier={quickOrderState.tier}
              onTierChange={(t) => {
                setQuickOrderState((prev) => ({ ...prev, tier: t }));
                requestAnimationFrame(() => {
                  const container = document.getElementById('app-scroll-container');
                  if (container) {
                    container.scrollTo({ top: 0, behavior: 'smooth' });
                  }
                });
              }}
              onSubmitOrder={handleSubmitOrder}
              onClose={() => setQuickOrderState((prev) => ({ ...prev, isOpen: false }))}
            />
          </div>
        </div>
      )}

      {/* 5. Performance Debug Panel (Developer Mode) */}
      {worldState.uiSettings?.showPerformancePanel && (
        <Suspense fallback={null}>
          <PerformanceDebugPanel
            worldState={worldState}
            onClose={() =>
              setWorldState((prev) => {
                if (!prev) return prev;
                const next = {
                  ...prev,
                  uiSettings: { ...prev.uiSettings, showPerformancePanel: false },
                };
                simulationStore.setState(next);
                return next;
              })
            }
          />
        </Suspense>
      )}
    </div>
  );
}
