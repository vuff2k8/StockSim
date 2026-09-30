import React, { useState, useMemo, useEffect } from 'react';
import { Search, ArrowUpDown, Filter, TrendingUp, TrendingDown } from 'lucide-react';
import { Instrument } from '../types/market';
import { formatPercent, formatStockPrice, formatVolume } from '../utils/formatters';

interface MarketsPageProps {
  instruments: Record<string, Instrument>;
  onSelectInstrument: (symbol: string) => void;
  onOpenOrderModal: (instrument: Instrument) => void;
}

type SortField = 'symbol' | 'price' | 'changePercent' | 'volume';
type SortOrder = 'asc' | 'desc';

// Memoized table row for desktop
const MarketTableRow = React.memo<{
  inst: Instrument;
  onSelect: (sym: string) => void;
  onTrade: (inst: Instrument) => void;
}>(({ inst, onSelect, onTrade }) => {
  const change = inst.currentPrice - inst.previousClose;
  const changePct = inst.previousClose > 0 ? (change / inst.previousClose) * 100 : 0;
  const isUp = change >= 0;

  return (
    <tr
      className="hover:bg-neutral-800/40 transition-colors group cursor-pointer"
      onClick={() => onSelect(inst.symbol)}
    >
      <td className="py-2.5 px-4">
        <div className="flex items-center gap-2">
          <span className="font-mono font-bold text-sm text-white group-hover:text-emerald-400 transition-colors">
            {inst.symbol}
          </span>
          <span className="text-[11px] text-neutral-400 truncate max-w-[200px]">
            {inst.name}
          </span>
        </div>
      </td>
      <td className="py-2.5 px-4 text-neutral-400">
        <div>{inst.sector || '—'}</div>
        <div className="text-[10px] text-neutral-500 font-mono">{inst.exchange}</div>
      </td>
      <td className="py-2.5 px-4 text-right font-mono font-semibold text-neutral-200">
        {formatStockPrice(inst.currentPrice, inst.currency)}
      </td>
      <td className="py-2.5 px-4 text-right">
        <div className={`font-mono font-bold ${isUp ? 'text-emerald-400' : 'text-rose-400'}`}>
          {isUp ? '▲ ' : '▼ '}{formatPercent(changePct)}
        </div>
        <div className={`font-mono text-[10px] ${isUp ? 'text-emerald-500' : 'text-rose-500'}`}>
          {isUp ? '+' : ''}{formatStockPrice(change, inst.currency)}
        </div>
      </td>
      <td className="py-2.5 px-4 text-right font-mono text-neutral-300">
        {formatVolume(inst.volume)}
      </td>
      <td className="py-2.5 px-4 text-center" onClick={(e) => e.stopPropagation()}>
        <button
          onClick={() => onTrade(inst)}
          className="px-3 py-1 bg-emerald-500/10 hover:bg-emerald-500 text-emerald-400 hover:text-neutral-950 font-semibold border border-emerald-500/30 rounded-lg text-xs transition-all cursor-pointer"
        >
          Đặt lệnh
        </button>
      </td>
    </tr>
  );
});

// Memoized mobile card
const MarketMobileCard = React.memo<{
  inst: Instrument;
  onSelect: (sym: string) => void;
  onTrade: (inst: Instrument) => void;
}>(({ inst, onSelect, onTrade }) => {
  const change = inst.currentPrice - inst.previousClose;
  const changePct = inst.previousClose > 0 ? (change / inst.previousClose) * 100 : 0;
  const isUp = change >= 0;

  return (
    <div
      onClick={() => onSelect(inst.symbol)}
      className="p-3 bg-neutral-900 border border-neutral-800 rounded-xl hover:border-neutral-700 transition-colors cursor-pointer space-y-2"
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="font-mono font-bold text-base text-white">{inst.symbol}</span>
          <span className="text-[10px] px-1.5 py-0.5 rounded bg-neutral-800 text-neutral-300 font-mono">
            {inst.exchange}
          </span>
        </div>
        <div className="font-mono text-base font-bold text-white">
          {formatStockPrice(inst.currentPrice, inst.currency)}
        </div>
      </div>

      <div className="flex items-center justify-between text-xs text-neutral-400">
        <span className="truncate max-w-[180px]">{inst.name}</span>
        <span className={`font-mono font-bold ${isUp ? 'text-emerald-400' : 'text-rose-400'}`}>
          {isUp ? '▲ ' : '▼ '}{formatPercent(changePct)}
        </span>
      </div>

      <div className="pt-2 border-t border-neutral-800/80 flex items-center justify-between text-[11px] text-neutral-400">
        <span>KL: <span className="font-mono text-neutral-200">{formatVolume(inst.volume)}</span></span>
        <button
          onClick={(e) => {
            e.stopPropagation();
            onTrade(inst);
          }}
          className="px-3 py-1 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-lg text-xs transition-colors cursor-pointer"
        >
          Giao dịch
        </button>
      </div>
    </div>
  );
});

export const MarketsPage: React.FC<MarketsPageProps> = ({
  instruments,
  onSelectInstrument,
  onOpenOrderModal,
}) => {
  const [searchInput, setSearchInput] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [selectedSector, setSelectedSector] = useState<string>('all');
  const [selectedType, setSelectedType] = useState<'all' | 'Stock' | 'ETF'>('all');
  const [sortField, setSortField] = useState<SortField>('volume');
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc');

  // 300ms Debounce search input for silky smooth 100+ instrument filtering
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(searchInput.trim().toLowerCase());
    }, 200);
    return () => clearTimeout(timer);
  }, [searchInput]);

  const instrumentList = useMemo(() => Object.values(instruments), [instruments]);

  const sectors = useMemo(() => {
    const s = new Set<string>();
    for (const inst of instrumentList) {
      if (inst.sector) s.add(inst.sector);
    }
    return Array.from(s);
  }, [instrumentList]);

  const filteredInstruments = useMemo(() => {
    return instrumentList
      .filter((inst) => {
        if (debouncedQuery) {
          const matchSym = inst.symbol.toLowerCase().includes(debouncedQuery);
          const matchName = inst.name.toLowerCase().includes(debouncedQuery);
          const matchSec = inst.sector && inst.sector.toLowerCase().includes(debouncedQuery);
          if (!matchSym && !matchName && !matchSec) return false;
        }

        if (selectedType !== 'all' && inst.assetType !== selectedType) return false;
        if (selectedSector !== 'all' && inst.sector !== selectedSector) return false;
        return true;
      })
      .sort((a, b) => {
        let diff = 0;
        if (sortField === 'symbol') {
          diff = a.symbol.localeCompare(b.symbol);
        } else if (sortField === 'price') {
          diff = a.currentPrice - b.currentPrice;
        } else if (sortField === 'changePercent') {
          const aPct = a.previousClose > 0 ? (a.currentPrice - a.previousClose) / a.previousClose : 0;
          const bPct = b.previousClose > 0 ? (b.currentPrice - b.previousClose) / b.previousClose : 0;
          diff = aPct - bPct;
        } else if (sortField === 'volume') {
          diff = a.volume - b.volume;
        }
        return sortOrder === 'asc' ? diff : -diff;
      });
  }, [instrumentList, debouncedQuery, selectedType, selectedSector, sortField, sortOrder]);

  const toggleSort = (field: SortField) => {
    if (sortField === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortOrder('desc');
    }
  };

  return (
    <div className="space-y-4 pb-20 md:pb-8">
      {/* Search & Filter Header */}
      <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-4 space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3 top-3 text-neutral-500" />
            <input
              type="text"
              placeholder="Tìm theo mã CP, tên doanh nghiệp hoặc nhóm ngành..."
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              className="w-full bg-neutral-950 border border-neutral-800 rounded-xl pl-9 pr-4 py-2 text-xs md:text-sm text-white placeholder-neutral-500 focus:outline-none focus:border-emerald-500"
            />
          </div>

          <div className="flex items-center p-1 bg-neutral-950 rounded-xl border border-neutral-800 shrink-0">
            {(['all', 'Stock', 'ETF'] as const).map((type) => (
              <button
                key={type}
                onClick={() => setSelectedType(type)}
                className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors cursor-pointer ${
                  selectedType === type
                    ? 'bg-neutral-800 text-emerald-400 shadow-sm'
                    : 'text-neutral-400 hover:text-white'
                }`}
              >
                {type === 'all' ? 'Tất cả' : type === 'Stock' ? 'Cổ phiếu' : 'ETF'}
              </button>
            ))}
          </div>
        </div>

        {/* Sector Chips */}
        {sectors.length > 0 && (
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 pt-1 no-scrollbar text-xs">
            <span className="text-neutral-500 shrink-0 mr-1 flex items-center gap-1">
              <Filter className="w-3.5 h-3.5" /> Ngành:
            </span>
            <button
              onClick={() => setSelectedSector('all')}
              className={`px-2.5 py-1 rounded-lg shrink-0 font-medium transition-colors cursor-pointer ${
                selectedSector === 'all'
                  ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                  : 'bg-neutral-950 text-neutral-400 hover:text-neutral-200 border border-neutral-800'
              }`}
            >
              Tất cả ({instrumentList.length})
            </button>
            {sectors.map((sec) => (
              <button
                key={sec}
                onClick={() => setSelectedSector(sec)}
                className={`px-2.5 py-1 rounded-lg shrink-0 font-medium transition-colors cursor-pointer ${
                  selectedSector === sec
                    ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                    : 'bg-neutral-950 text-neutral-400 hover:text-neutral-200 border border-neutral-800'
                }`}
              >
                {sec}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Desktop Table View */}
      <div className="hidden md:block bg-neutral-900 border border-neutral-800 rounded-xl overflow-hidden">
        <table className="w-full text-left text-xs">
          <thead className="bg-neutral-950 text-neutral-400 uppercase tracking-wider text-[11px] border-b border-neutral-800">
            <tr>
              <th
                onClick={() => toggleSort('symbol')}
                className="py-3 px-4 cursor-pointer hover:text-white select-none"
              >
                <div className="flex items-center gap-1.5">
                  <span>Mã / Tên công ty</span>
                  <ArrowUpDown className="w-3 h-3" />
                </div>
              </th>
              <th className="py-3 px-4">Ngành / Sàn</th>
              <th
                onClick={() => toggleSort('price')}
                className="py-3 px-4 text-right cursor-pointer hover:text-white select-none"
              >
                <div className="flex items-center justify-end gap-1.5">
                  <span>Giá khớp</span>
                  <ArrowUpDown className="w-3 h-3" />
                </div>
              </th>
              <th
                onClick={() => toggleSort('changePercent')}
                className="py-3 px-4 text-right cursor-pointer hover:text-white select-none"
              >
                <div className="flex items-center justify-end gap-1.5">
                  <span>Biến động</span>
                  <ArrowUpDown className="w-3 h-3" />
                </div>
              </th>
              <th
                onClick={() => toggleSort('volume')}
                className="py-3 px-4 text-right cursor-pointer hover:text-white select-none"
              >
                <div className="flex items-center justify-end gap-1.5">
                  <span>Khối lượng</span>
                  <ArrowUpDown className="w-3 h-3" />
                </div>
              </th>
              <th className="py-3 px-4 text-center">Giao dịch</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-800/80">
            {filteredInstruments.map((inst) => (
              <MarketTableRow
                key={inst.symbol}
                inst={inst}
                onSelect={onSelectInstrument}
                onTrade={onOpenOrderModal}
              />
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile Stacked Cards View */}
      <div className="md:hidden space-y-2.5">
        {filteredInstruments.map((inst) => (
          <MarketMobileCard
            key={inst.symbol}
            inst={inst}
            onSelect={onSelectInstrument}
            onTrade={onOpenOrderModal}
          />
        ))}
      </div>
    </div>
  );
};
