import React, { useState, useMemo } from 'react';
import { History as HistoryIcon, ArrowDownLeft, ArrowUpRight, Search, FileText, CheckCircle2, XCircle, AlertTriangle } from 'lucide-react';
import { Transaction, Order, OrderSide, OrderStatus } from '../types/order';
import { formatCurrency, formatStockPrice, formatDateTime } from '../utils/formatters';

interface HistoryPageProps {
  transactions: Transaction[];
  orderHistory: Order[];
  onSelectInstrument: (symbol: string) => void;
}

export const HistoryPage: React.FC<HistoryPageProps> = ({
  transactions,
  orderHistory = [],
  onSelectInstrument,
}) => {
  const [activeSubTab, setActiveSubTab] = useState<'transactions' | 'orders'>('transactions');
  const [filterSide, setFilterSide] = useState<'all' | OrderSide>('all');
  const [searchSymbol, setSearchSymbol] = useState('');

  const filteredTransactions = useMemo(() => {
    return transactions.filter((tx) => {
      if (filterSide !== 'all' && tx.side !== filterSide) return false;
      if (searchSymbol && !tx.symbol.toLowerCase().includes(searchSymbol.toLowerCase().trim())) {
        return false;
      }
      return true;
    });
  }, [transactions, filterSide, searchSymbol]);

  const filteredOrders = useMemo(() => {
    return orderHistory.filter((ord) => {
      if (filterSide !== 'all' && ord.side !== filterSide) return false;
      if (searchSymbol && !ord.symbol.toLowerCase().includes(searchSymbol.toLowerCase().trim())) {
        return false;
      }
      return true;
    });
  }, [orderHistory, filterSide, searchSymbol]);

  return (
    <div className="space-y-4 pb-20 md:pb-8">
      {/* Header and SubTab Switcher */}
      <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-4 space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <HistoryIcon className="w-5 h-5 text-emerald-400" />
            <div className="flex items-center p-0.5 bg-neutral-950 rounded-lg border border-neutral-800 text-xs font-semibold">
              <button
                onClick={() => setActiveSubTab('transactions')}
                className={`px-3 py-1.5 rounded-md transition-colors cursor-pointer ${
                  activeSubTab === 'transactions'
                    ? 'bg-neutral-800 text-white font-bold shadow-xs'
                    : 'text-neutral-400 hover:text-white'
                }`}
              >
                Giao dịch đã khớp ({transactions.length})
              </button>
              <button
                onClick={() => setActiveSubTab('orders')}
                className={`px-3 py-1.5 rounded-md transition-colors cursor-pointer ${
                  activeSubTab === 'orders'
                    ? 'bg-neutral-800 text-white font-bold shadow-xs'
                    : 'text-neutral-400 hover:text-white'
                }`}
              >
                Vòng đời lệnh (Order Lifecycle - {orderHistory.length})
              </button>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <div className="relative">
              <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-neutral-500" />
              <input
                type="text"
                placeholder="Tìm mã..."
                value={searchSymbol}
                onChange={(e) => setSearchSymbol(e.target.value)}
                className="bg-neutral-950 border border-neutral-800 rounded-lg pl-8 pr-3 py-1.5 text-xs text-white placeholder-neutral-500 focus:outline-none focus:border-emerald-500 w-32"
              />
            </div>

            <div className="flex items-center p-0.5 bg-neutral-950 rounded-lg border border-neutral-800 text-xs">
              {(['all', 'BUY', 'SELL'] as const).map((side) => (
                <button
                  key={side}
                  onClick={() => setFilterSide(side)}
                  className={`px-2.5 py-1 text-xs font-semibold rounded-md transition-colors cursor-pointer ${
                    filterSide === side
                      ? 'bg-neutral-800 text-emerald-400 font-bold'
                      : 'text-neutral-400 hover:text-white'
                  }`}
                >
                  {side === 'all' ? 'Tất cả' : side === 'BUY' ? 'Mua' : 'Bán'}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* 1. Transactions View */}
      {activeSubTab === 'transactions' && (
        <>
          {filteredTransactions.length === 0 ? (
            <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-12 text-center text-xs text-neutral-400 space-y-2">
              <FileText className="w-8 h-8 text-neutral-600 mx-auto" />
              <p>Chưa có giao dịch khớp lệnh nào.</p>
            </div>
          ) : (
            <div className="bg-neutral-900 border border-neutral-800 rounded-xl overflow-hidden">
              <table className="w-full text-left text-xs font-mono">
                <thead className="bg-neutral-950 text-neutral-400 uppercase tracking-wider text-[10px] border-b border-neutral-800">
                  <tr>
                    <th className="py-2.5 px-3">Thời gian</th>
                    <th className="py-2.5 px-3">Loại / Phía</th>
                    <th className="py-2.5 px-3">Mã CP</th>
                    <th className="py-2.5 px-3 text-right">Khối lượng</th>
                    <th className="py-2.5 px-3 text-right">Giá khớp</th>
                    <th className="py-2.5 px-3 text-right">Phí</th>
                    <th className="py-2.5 px-3 text-right">Tổng tiền</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-800/80">
                  {filteredTransactions.map((tx) => {
                    const isBuy = tx.side === 'BUY';
                    return (
                      <tr
                        key={tx.id}
                        onClick={() => onSelectInstrument(tx.symbol)}
                        className="hover:bg-neutral-800/40 transition-colors cursor-pointer"
                      >
                        <td className="py-3 px-3 text-neutral-400">{formatDateTime(tx.timestamp)}</td>
                        <td className="py-3 px-3">
                          <span
                            className={`inline-flex items-center gap-1 px-1.5 py-0.2 rounded text-[10px] font-bold ${
                              isBuy
                                ? 'bg-emerald-950 text-emerald-400 border border-emerald-800/60'
                                : 'bg-rose-950 text-rose-400 border border-rose-800/60'
                            }`}
                          >
                            {isBuy ? <ArrowDownLeft className="w-3 h-3" /> : <ArrowUpRight className="w-3 h-3" />}
                            {tx.positionEffect ? tx.positionEffect.replace('_', ' ') : tx.side}
                            {tx.leverage && tx.leverage > 1 && ` ${tx.leverage}x`}
                          </span>
                        </td>
                        <td className="py-3 px-3 font-bold text-white">{tx.symbol}</td>
                        <td className="py-3 px-3 text-right font-bold text-neutral-200">
                          {tx.quantity.toLocaleString()}
                        </td>
                        <td className="py-3 px-3 text-right text-neutral-300">
                          {formatStockPrice(tx.price, tx.currency)}
                        </td>
                        <td className="py-3 px-3 text-right text-neutral-400">
                          {formatCurrency(tx.fee, tx.currency)}
                        </td>
                        <td className="py-3 px-3 text-right font-bold text-white">
                          {formatCurrency(tx.total, tx.currency)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {/* 2. Order Lifecycle View */}
      {activeSubTab === 'orders' && (
        <>
          {filteredOrders.length === 0 ? (
            <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-12 text-center text-xs text-neutral-400 space-y-2">
              <FileText className="w-8 h-8 text-neutral-600 mx-auto" />
              <p>Chưa có dữ liệu vòng đời lệnh nào trong lịch sử.</p>
            </div>
          ) : (
            <div className="bg-neutral-900 border border-neutral-800 rounded-xl overflow-hidden">
              <table className="w-full text-left text-xs font-mono">
                <thead className="bg-neutral-950 text-neutral-400 uppercase tracking-wider text-[10px] border-b border-neutral-800">
                  <tr>
                    <th className="py-2.5 px-3">Thời gian</th>
                    <th className="py-2.5 px-3">Mã CP</th>
                    <th className="py-2.5 px-3">Loại lệnh</th>
                    <th className="py-2.5 px-3 text-right">Khối lượng</th>
                    <th className="py-2.5 px-3 text-right">Giá đặt / Trigger</th>
                    <th className="py-2.5 px-3 text-center">Trạng thái</th>
                    <th className="py-2.5 px-3">Ghi chú</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-800/80">
                  {filteredOrders.map((ord) => {
                    const isFilled = ord.status === 'FILLED';
                    const isCancelled = ord.status === 'CANCELLED';
                    const isLiq = ord.status === 'LIQUIDATED';

                    return (
                      <tr key={ord.id} className="hover:bg-neutral-800/40 transition-colors">
                        <td className="py-3 px-3 text-neutral-400">{formatDateTime(ord.updatedAt || ord.createdAt)}</td>
                        <td
                          className="py-3 px-3 font-bold text-white cursor-pointer hover:text-emerald-400"
                          onClick={() => onSelectInstrument(ord.symbol)}
                        >
                          {ord.symbol}
                        </td>
                        <td className="py-3 px-3">
                          <span className="text-neutral-200">
                            {ord.orderType} {ord.side}
                          </span>
                        </td>
                        <td className="py-3 px-3 text-right font-bold text-neutral-200">
                          {ord.quantity.toLocaleString()}
                        </td>
                        <td className="py-3 px-3 text-right text-neutral-300">
                          {ord.limitPrice
                            ? formatStockPrice(ord.limitPrice, ord.currency)
                            : ord.stopPrice
                            ? formatStockPrice(ord.stopPrice, ord.currency)
                            : 'Thị trường'}
                        </td>
                        <td className="py-3 px-3 text-center">
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                              isFilled
                                ? 'bg-emerald-950 text-emerald-400 border border-emerald-800'
                                : isCancelled
                                ? 'bg-neutral-800 text-neutral-400'
                                : isLiq
                                ? 'bg-rose-950 text-rose-400 border border-rose-800'
                                : 'bg-amber-950 text-amber-400'
                            }`}
                          >
                            {ord.status}
                          </span>
                        </td>
                        <td className="py-3 px-3 text-[11px] text-neutral-400 truncate max-w-[200px]">
                          {ord.cancellationReason || (isFilled ? 'Khớp hoàn toàn' : '—')}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  );
};
