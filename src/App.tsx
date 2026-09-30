import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
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

// Components
import { Header } from './components/Header';
import { MarketStatusBanner } from './components/MarketStatusBanner';
import { BottomNav, NavTab } from './components/BottomNav';
import { Sidebar } from './components/Sidebar';
import { TradingTerminalOrderPanel } from './components/TradingTerminalOrderPanel';
import { PerformanceDebugPanel } from './components/PerformanceDebugPanel';

// Pages
import { DashboardPage } from './pages/DashboardPage';
import { MarketsPage } from './pages/MarketsPage';
import { StockDetailPage } from './pages/StockDetailPage';
import { PortfolioPage } from './pages/PortfolioPage';
import { HistoryPage } from './pages/HistoryPage';
import { SettingsPage } from './pages/SettingsPage';
import { CreateWorldPage } from './pages/CreateWorldPage';

export default function App() {
  const [worldState, setWorldState] = useState<WorldState | null>(null);
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

  // State ref for simulation scheduler getter
  const worldStateRef = useRef<WorldState | null>(null);
  worldStateRef.current = worldState;

  // 1. Initial World Load / Bootstrap
  useEffect(() => {
    async function init() {
      try {
        const saved = SaveManager.loadGame();
        let activeWorld: WorldState;

        if (saved) {
          activeWorld = saved;
          // Ensure new Phase 1.5 fields exist
          if (!activeWorld.openOrders) activeWorld.openOrders = [];
          if (!activeWorld.orderHistory) activeWorld.orderHistory = [];
          if (!activeWorld.uiSettings) activeWorld.uiSettings = createDefaultUiSettings('trader');
          if (!activeWorld.marketConfig.rules) {
            const { SUPPORTED_MARKETS } = await import('./data/markets');
            activeWorld.marketConfig.rules = SUPPORTED_MARKETS[activeWorld.marketConfig.id]?.rules || SUPPORTED_MARKETS.vietnam.rules;
          }
          // Ensure portfolio has all Phase 1.5 margin metrics and riskMetrics
          const { MarginLiquidationEngine } = await import('./game/portfolio/MarginLiquidationEngine');
          activeWorld.portfolio = MarginLiquidationEngine.calculatePortfolioMetrics(
            activeWorld.portfolio,
            activeWorld.instruments,
            activeWorld.marketConfig.rules
          );
        } else {
          // Default Vietnam market world on first launch
          activeWorld = await WorldManager.createNewWorld({
            marketId: 'vietnam',
            difficulty: 'normal',
          });
        }

        setWorldState(activeWorld);

        // Initialize authoritative SimulationScheduler
        simulationScheduler.init(
          () => worldStateRef.current,
          (updater) => {
            setWorldState((prev) => {
              if (!prev) return prev;
              const next = updater(prev);
              worldStateRef.current = next;
              return next;
            });
          },
          activeWorld.snapshot.seed
        );

        // Start scheduler if not paused
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
      SaveManager.saveGame(updated);
      return updated;
    });
  }, []);

  // 3. Fast Batch Time Jump Handlers (1H, 1D, 1W, 1M)
  const handleAdvanceTime = useCallback((jump: '1h' | '1d' | '1w' | '1m') => {
    simulationScheduler.advanceTimeJump(jump);
  }, []);

  // 4. Order Submission Handler (supports Basic, Advanced, Pro, TP/SL, Bracket, OCO, Short, Margin)
  const handleSubmitOrder = useCallback(
    (params: SubmitOrderParams): { success: boolean; errorMessage?: string } => {
      if (!worldState) {
        return { success: false, errorMessage: 'Thế giới chưa được khởi tạo.' };
      }

      const feeConfig: FeeConfig = {
        rate: worldState.settings.marketFeeRate,
        minFee: 0,
      };

      const result = OrderEngine.submitOrder(
        params,
        worldState.portfolio,
        feeConfig,
        worldState.marketConfig,
        new Date().toISOString()
      );

      if (result.success) {
        let updatedPortfolio = result.updatedPortfolio || worldState.portfolio;
        let updatedTransactions = result.transaction
          ? [result.transaction, ...worldState.transactions]
          : worldState.transactions;
        let updatedOpenOrders = result.newOpenOrders
          ? [...result.newOpenOrders, ...(worldState.openOrders || [])]
          : worldState.openOrders || [];

        const nextState: WorldState = {
          ...worldState,
          portfolio: updatedPortfolio,
          transactions: updatedTransactions,
          openOrders: updatedOpenOrders,
          version: worldState.version + 1,
        };

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
      SaveManager.saveGame(updated);
      return updated;
    });
  }, []);

  // 8. Desktop Keyboard Shortcuts (B = Buy, S = Sell, Space = Pause/Resume, Esc = Cancel)
  useEffect(() => {
    if (!worldState?.uiSettings?.enableKeyboardShortcuts) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      // Do not trigger shortcuts when typing in inputs/textareas
      const activeElement = document.activeElement;
      if (
        activeElement &&
        (activeElement.tagName === 'INPUT' ||
          activeElement.tagName === 'TEXTAREA' ||
          activeElement.tagName === 'SELECT')
      ) {
        return;
      }

      if (e.code === 'Space') {
        e.preventDefault();
        handleTogglePlay();
      } else if (e.code === 'KeyB') {
        e.preventDefault();
        const inst =
          (selectedStockSymbol && worldState.instruments[selectedStockSymbol]) ||
          worldState.instruments[worldState.watchlist[0]] ||
          Object.values(worldState.instruments)[0];
        if (inst) {
          setQuickOrderState({
            isOpen: true,
            instrument: inst,
            side: 'BUY',
            tier: 'BASIC',
          });
        }
      } else if (e.code === 'KeyS') {
        e.preventDefault();
        const inst =
          (selectedStockSymbol && worldState.instruments[selectedStockSymbol]) ||
          worldState.instruments[worldState.watchlist[0]] ||
          Object.values(worldState.instruments)[0];
        if (inst) {
          setQuickOrderState({
            isOpen: true,
            instrument: inst,
            side: 'SELL',
            tier: 'BASIC',
          });
        }
      } else if (e.code === 'Escape') {
        if (quickOrderState.isOpen) {
          setQuickOrderState((prev) => ({ ...prev, isOpen: false }));
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    worldState?.uiSettings?.enableKeyboardShortcuts,
    worldState?.instruments,
    worldState?.watchlist,
    selectedStockSymbol,
    quickOrderState.isOpen,
    handleTogglePlay,
  ]);

  // Handle World Reset
  const handleResetWorld = useCallback(() => {
    SaveManager.resetGame();
    setSelectedStockSymbol(null);
    setShowCreateWorldModal(true);
  }, []);

  // Handle New World Created
  const handleWorldCreated = useCallback((newWorld: WorldState) => {
    setWorldState(newWorld);
    simulationScheduler.init(
      () => worldStateRef.current,
      (updater) => {
        setWorldState((prev) => {
          if (!prev) return prev;
          const next = updater(prev);
          worldStateRef.current = next;
          return next;
        });
      },
      newWorld.snapshot.seed
    );
    setShowCreateWorldModal(false);
    setSelectedStockSymbol(null);
    setActiveTab('home');
  }, []);

  const selectedInstrument = useMemo(() => {
    if (!worldState || !selectedStockSymbol) return null;
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
      <CreateWorldPage
        onWorldCreated={handleWorldCreated}
        onCancel={worldState ? () => setShowCreateWorldModal(false) : undefined}
        hasExistingWorld={!!worldState}
      />
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
      className="min-h-screen text-neutral-100 flex flex-col font-sans transition-colors"
      style={{ backgroundColor: themeTokens.background }}
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
        <main className="flex-1 p-3 md:p-6 overflow-x-hidden min-h-0">
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
            <SettingsPage
              worldState={worldState}
              onWorldUpdated={(updated) => setWorldState(updated)}
              onOpenCreateWorld={() => setShowCreateWorldModal(true)}
              onResetWorld={handleResetWorld}
            />
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-xs p-3">
          <TradingTerminalOrderPanel
            instrument={quickOrderState.instrument}
            portfolio={worldState.portfolio}
            marketConfig={worldState.marketConfig}
            feeConfig={activeFeeConfig}
            activeTier={quickOrderState.tier}
            onTierChange={(t) => setQuickOrderState((prev) => ({ ...prev, tier: t }))}
            onSubmitOrder={handleSubmitOrder}
            onClose={() => setQuickOrderState((prev) => ({ ...prev, isOpen: false }))}
          />
        </div>
      )}

      {/* 5. Performance Debug Panel (Developer Mode) */}
      {worldState.uiSettings?.showPerformancePanel && (
        <PerformanceDebugPanel
          worldState={worldState}
          onClose={() =>
            setWorldState((prev) =>
              prev
                ? {
                    ...prev,
                    uiSettings: { ...prev.uiSettings, showPerformancePanel: false },
                  }
                : prev
            )
          }
        />
      )}
    </div>
  );
}
