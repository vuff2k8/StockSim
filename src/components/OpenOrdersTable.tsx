import React from 'react';
import { Clock, XCircle, ArrowUpRight, ArrowDownLeft } from 'lucide-react';
import { Order } from '../types/order';
import { formatStockPrice, formatDateTime } from '../utils/formatters';

interface OpenOrdersTableProps {
  orders: Order[];
  onCancelOrder: (orderId: string) => void;
  onSelectInstrument?: (symbol: string) => void;
}

export const OpenOrdersTable: React.FC<OpenOrdersTableProps> = ({
  orders,
  onCancelOrder,
  onSelectInstrument,
}) => {
  if (orders.length === 0) {
    return (
      <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-8 text-center text-xs text-neutral-500">
        Không có lệnh chờ khớp nào trong sổ lệnh.
      </div>
    );
  }

  return (
    <div className="bg-neutral-900 border border-neutral-800 rounded-xl overflow-hidden">
      <div className="p-3.5 border-b border-neutral-800 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Clock className="w-4 h-4 text-emerald-400" />
          <h3 className="text-xs font-bold uppercase tracking-wider text-neutral-200">
            LỆNH CHỜ KHỚP (OPEN ORDERS - {orders.length})
          </h3>
        </div>
      </div>

      {/* Desktop Table */}
      <div className="hidden md:block overflow-x-auto">
        <table className="w-full text-left text-xs">
          <thead className="bg-neutral-950 text-neutral-400 uppercase tracking-wider text-[10px] font-mono border-b border-neutral-800">
            <tr>
              <th className="py-2.5 px-3">Mã CP</th>
              <th className="py-2.5 px-3">Loại / Phía</th>
              <th className="py-2.5 px-3 text-right">Khối lượng</th>
              <th className="py-2.5 px-3 text-right">Giá đặt</th>
              <th className="py-2.5 px-3 text-right">Kích hoạt (Trigger)</th>
              <th className="py-2.5 px-3 text-right">Thời hạn</th>
              <th className="py-2.5 px-3 text-center">Thao tác</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-800/80 font-mono">
            {orders.map((ord) => {
              const isBuy = ord.side === 'BUY';
              return (
                <tr key={ord.id} className="hover:bg-neutral-800/40 transition-colors">
                  <td
                    className="py-2.5 px-3 cursor-pointer"
                    onClick={() => onSelectInstrument && onSelectInstrument(ord.symbol)}
                  >
                    <span className="font-bold text-white hover:text-emerald-400">{ord.symbol}</span>
                  </td>
                  <td className="py-2.5 px-3">
                    <span
                      className={`inline-flex items-center gap-1 px-1.5 py-0.2 rounded text-[10px] font-bold ${
                        isBuy ? 'text-emerald-400 bg-emerald-950' : 'text-rose-400 bg-rose-950'
                      }`}
                    >
                      {ord.orderType} {ord.side}
                      {ord.leverage > 1 && ` ${ord.leverage}x`}
                    </span>
                  </td>
                  <td className="py-2.5 px-3 text-right font-bold text-neutral-200">
                    {ord.remainingQuantity.toLocaleString()}
                  </td>
                  <td className="py-2.5 px-3 text-right text-neutral-300">
                    {ord.limitPrice ? formatStockPrice(ord.limitPrice, ord.currency) : '—'}
                  </td>
                  <td className="py-2.5 px-3 text-right text-neutral-400">
                    {ord.stopPrice
                      ? formatStockPrice(ord.stopPrice, ord.currency)
                      : ord.tpPrice
                      ? `TP: ${formatStockPrice(ord.tpPrice, ord.currency)}`
                      : ord.slPrice
                      ? `SL: ${formatStockPrice(ord.slPrice, ord.currency)}`
                      : ord.trailingPercent
                      ? `Trail: ${(ord.trailingPercent * 100).toFixed(1)}%`
                      : '—'}
                  </td>
                  <td className="py-2.5 px-3 text-right text-neutral-500 text-[11px]">
                    {ord.timeInForce}
                  </td>
                  <td className="py-2.5 px-3 text-center">
                    <button
                      onClick={() => onCancelOrder(ord.id)}
                      className="inline-flex items-center gap-1 px-2.5 py-1 bg-rose-950/60 hover:bg-rose-900 border border-rose-800/80 text-rose-300 rounded text-[11px] font-bold transition-colors cursor-pointer"
                      title="Hủy lệnh"
                    >
                      <XCircle className="w-3 h-3" />
                      <span>Hủy</span>
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Mobile Stacked Card View */}
      <div className="md:hidden divide-y divide-neutral-800/80">
        {orders.map((ord) => {
          const isBuy = ord.side === 'BUY';
          return (
            <div key={ord.id} className="p-3 space-y-2 text-xs font-mono">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="font-bold text-white">{ord.symbol}</span>
                  <span
                    className={`px-1.5 py-0.2 rounded text-[10px] font-bold ${
                      isBuy ? 'text-emerald-400 bg-emerald-950' : 'text-rose-400 bg-rose-950'
                    }`}
                  >
                    {ord.orderType} {ord.side}
                  </span>
                </div>
                <button
                  onClick={() => onCancelOrder(ord.id)}
                  className="px-2 py-1 bg-rose-950 hover:bg-rose-900 border border-rose-800 text-rose-300 rounded text-[10px] font-bold cursor-pointer"
                >
                  Hủy lệnh
                </button>
              </div>

              <div className="grid grid-cols-2 gap-2 text-[11px] text-neutral-400">
                <div>
                  <span className="text-neutral-500">Khối lượng:</span>{' '}
                  <span className="text-white font-bold">{ord.remainingQuantity.toLocaleString()} CP</span>
                </div>
                <div className="text-right">
                  <span className="text-neutral-500">Giá:</span>{' '}
                  <span className="text-neutral-200">
                    {ord.limitPrice ? formatStockPrice(ord.limitPrice, ord.currency) : ord.stopPrice ? formatStockPrice(ord.stopPrice, ord.currency) : 'Market'}
                  </span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
