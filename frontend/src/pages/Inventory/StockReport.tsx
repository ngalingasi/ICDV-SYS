import { useEffect, useState, useCallback } from 'react';
import { inspectionApi, storesApi } from '../../api';

const TYPE_STYLES: Record<string,string> = {
  STOCK_IN:    'bg-green-100 text-green-700 dark:bg-green-500/20 dark:text-green-400',
  STOCK_OUT:   'bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-400',
  ADJUSTMENT:  'bg-orange-100 text-orange-700 dark:bg-orange-500/20 dark:text-orange-400',
};

function Tab({ active, onClick, children }: { active:boolean; onClick:()=>void; children:React.ReactNode }) {
  return (
    <button onClick={onClick}
      className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
        active ? 'bg-brand-500 text-white' : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800'
      }`}>{children}</button>
  );
}

export default function StockReport() {
  const [tab,       setTab]       = useState<'stock'|'transactions'>('stock');
  const [stores,    setStores]    = useState<any[]>([]);
  const [storeId,   setStoreId]   = useState('');
  const [stock,     setStock]     = useState<any[]>([]);
  const [txns,      setTxns]      = useState<any[]>([]);
  const [loading,   setLoading]   = useState(false);
  const [search,    setSearch]    = useState('');

  useEffect(() => {
    storesApi.list({ limit: 100, status: 'active' })
      .then(r => { setStores(r.data.results); if (r.data.results.length) setStoreId(r.data.results[0].store_id); })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!storeId) return;
    setLoading(true);
    const p = tab === 'stock'
      ? inspectionApi.getStoreStock(Number(storeId)).then(r => { setStock(r.data); })
      : inspectionApi.getStockTransactions({ store_id: storeId, limit: 200 }).then(r => { setTxns(r.data); });
    p.catch(() => {}).finally(() => setLoading(false));
  }, [storeId, tab]);

  const fmtDate = (d?: string) => d ? new Date(d).toLocaleDateString('en-GB', { day:'2-digit', month:'short', year:'numeric' }) : '—';
  const fmtQty  = (n: any) => Number(n || 0).toLocaleString(undefined, { maximumFractionDigits: 4 });

  const filteredStock = stock.filter(s =>
    !search || s.product_name?.toLowerCase().includes(search.toLowerCase()) || s.sku_barcode?.toLowerCase().includes(search.toLowerCase())
  );
  const filteredTxns = txns.filter(t =>
    !search || t.product_name?.toLowerCase().includes(search.toLowerCase())
  );

  const totalItems = filteredStock.length;
  const totalQty   = filteredStock.reduce((s, i) => s + Number(i.quantity), 0);

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-bold text-gray-800 dark:text-white">Stock Report</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">Inventory levels and stock movements</p>
      </div>

      {/* Store selector + tabs */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
        <div className="flex items-center gap-2">
          <label className="text-sm text-gray-500 dark:text-gray-400 flex-shrink-0">Store:</label>
          <select value={storeId} onChange={e => setStoreId(e.target.value)}
            className="rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 text-sm text-gray-800 dark:text-white focus:outline-none focus:border-brand-400 min-w-[200px]">
            {stores.map(s => <option key={s.store_id} value={s.store_id}>{s.store_name}{s.region_name ? ` — ${s.region_name}` : ''}</option>)}
          </select>
        </div>
        <div className="flex gap-1">
          <Tab active={tab==='stock'}        onClick={() => setTab('stock')}>Stock Levels</Tab>
          <Tab active={tab==='transactions'} onClick={() => setTab('transactions')}>Transactions</Tab>
        </div>
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search products..."
          className="flex-1 min-w-[180px] rounded-lg border border-gray-300 dark:border-gray-700 px-3 py-2 text-sm dark:bg-gray-900 dark:text-white focus:outline-none focus:border-brand-400" />
      </div>

      {/* Summary */}
      {tab === 'stock' && !loading && (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
          {[
            { label: 'Products in Store', value: totalItems, color: 'text-gray-800 dark:text-white' },
            { label: 'Total Units',       value: fmtQty(totalQty), color: 'text-brand-600 dark:text-brand-400' },
            { label: 'Store Name',        value: stores.find(s => s.store_id === Number(storeId))?.store_name ?? '—', color: 'text-gray-600 dark:text-gray-400' },
          ].map(m => (
            <div key={m.label} className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-4">
              <p className="text-xs text-gray-400 mb-1">{m.label}</p>
              <p className={`text-lg font-bold ${m.color}`}>{m.value}</p>
            </div>
          ))}
        </div>
      )}

      {/* Stock levels table */}
      {tab === 'stock' && (
        <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
                {['Product','SKU','Type','Category','Quantity','Last Updated'].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
              {loading ? Array.from({length:5}).map((_,i) => (
                <tr key={i} className="animate-pulse">
                  {Array.from({length:6}).map((_,j) => <td key={j} className="px-4 py-3"><div className="h-4 bg-gray-100 dark:bg-gray-800 rounded" /></td>)}
                </tr>
              )) : filteredStock.length === 0 ? (
                <tr><td colSpan={6} className="px-4 py-12 text-center text-gray-400">
                  {stock.length === 0 ? 'No stock in this store yet' : 'No products match your search'}
                </td></tr>
              ) : filteredStock.map((item: any) => (
                <tr key={item.store_inventory_id} className="hover:bg-gray-50 dark:hover:bg-gray-800/40">
                  <td className="px-4 py-3 font-medium text-gray-800 dark:text-white">{item.product_name}</td>
                  <td className="px-4 py-3">
                    {item.sku_barcode
                      ? <span className="font-mono text-xs bg-gray-100 dark:bg-gray-800 px-1.5 py-0.5 rounded">{item.sku_barcode}</span>
                      : <span className="text-gray-400">—</span>}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-0.5 text-xs rounded-full font-medium ${item.product_type === 'hardware' ? 'bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-400' : 'bg-purple-100 text-purple-700 dark:bg-purple-500/20 dark:text-purple-400'}`}>
                      {item.product_type}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-500 dark:text-gray-400">{item.category_name ?? '—'}</td>
                  <td className="px-4 py-3">
                    <span className={`text-base font-bold ${Number(item.quantity) > 0 ? 'text-green-600 dark:text-green-400' : 'text-red-500 dark:text-red-400'}`}>
                      {fmtQty(item.quantity)}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-400">{fmtDate(item.last_updated)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Transactions table */}
      {tab === 'transactions' && (
        <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
                {['Date','Type','Product','Quantity','Source','Recorded By'].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
              {loading ? Array.from({length:5}).map((_,i) => (
                <tr key={i} className="animate-pulse">
                  {Array.from({length:6}).map((_,j) => <td key={j} className="px-4 py-3"><div className="h-4 bg-gray-100 dark:bg-gray-800 rounded" /></td>)}
                </tr>
              )) : filteredTxns.length === 0 ? (
                <tr><td colSpan={6} className="px-4 py-12 text-center text-gray-400">No transactions yet</td></tr>
              ) : filteredTxns.map((t: any) => (
                <tr key={t.stock_transaction_id} className="hover:bg-gray-50 dark:hover:bg-gray-800/40">
                  <td className="px-4 py-3 text-xs text-gray-500">{fmtDate(t.transaction_date)}</td>
                  <td className="px-4 py-3">
                    <span className={`px-2.5 py-0.5 text-xs font-medium rounded-full ${TYPE_STYLES[t.transaction_type]}`}>{t.transaction_type.replace('_',' ')}</span>
                  </td>
                  <td className="px-4 py-3 font-medium text-gray-800 dark:text-white">{t.product_name}</td>
                  <td className="px-4 py-3 font-bold text-green-600 dark:text-green-400">+{fmtQty(t.quantity)}</td>
                  <td className="px-4 py-3 text-xs text-gray-400">{t.source_type?.replace('_',' ') ?? '—'}{t.notes ? ` — ${t.notes.substring(0,40)}` : ''}</td>
                  <td className="px-4 py-3 text-xs text-gray-500">{t.created_by_name}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
