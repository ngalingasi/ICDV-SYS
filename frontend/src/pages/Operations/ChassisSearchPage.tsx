import { useState } from 'react';
import { workflowApi } from '../../api';
import StatusBadge from '../../components/tpfcs/StatusBadge';
import { WorkflowProgress, ErrorAlert } from '../../components/tpfcs/WorkflowCard';

const LOCATION_LABELS: Record<string, string> = {
  vessel:           'On Vessel',
  holding_ground:   'Holding Ground',
  tpa_gate:         'TPA Gate',
  tpa_gate_to_yard: 'TPA Gate to ICDV Yard',
  icdv_yard:        'ICDV Yard',
};

// SVG icons for each operation type — no emojis
const OP_ICON_SVG: Record<string, React.ReactNode> = {
  manifested: (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
    </svg>
  ),
  discharged: (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M7 16V4m0 0L3 8m4-4l4 4M17 8v8m0 4l4-4m-4 4l-4-4M3 20h18" />
    </svg>
  ),
  batched: (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
    </svg>
  ),
  transferred: (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M13 16V6a1 1 0 00-1-1H4a1 1 0 00-1 1v10a1 1 0 001 1h1m8-1a1 1 0 01-1 1H9m4-1V8a1 1 0 011-1h2.586a1 1 0 01.707.293l3.414 3.414a1 1 0 01.293.707V16a1 1 0 01-1 1h-1m-6-1a1 1 0 001 1h1M5 17a2 2 0 104 0m-4 0a2 2 0 114 0m6 0a2 2 0 104 0m-4 0a2 2 0 114 0" />
    </svg>
  ),
  received: (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  ),
  note: (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
    </svg>
  ),
  status_change: (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
    </svg>
  ),
};

const DefaultIcon = () => (
  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
  </svg>
);

const ArrowRightIcon = () => (
  <svg className="w-3 h-3 inline mx-1 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
  </svg>
);

const BackIcon = () => (
  <svg className="w-3.5 h-3.5 inline mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
  </svg>
);

export default function ChassisSearchPage() {
  const [chassis,  setChassis]  = useState('');
  const [results,  setResults]  = useState<any[]>([]);
  const [selected, setSelected] = useState<any>(null);
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState('');
  const [searched, setSearched] = useState(false);

  const handleSearch = async () => {
    if (chassis.trim().length < 3) return;
    setLoading(true); setError(''); setResults([]); setSelected(null); setSearched(true);
    try {
      const r = await workflowApi.search(chassis.trim());
      setResults(r.data);
      if (r.data.length === 1) setSelected(r.data[0]);
    } catch (e: any) {
      setError(e?.response?.data?.message ?? 'Search failed');
    } finally { setLoading(false); }
  };

  return (
    <div className="p-4 sm:p-6 space-y-5">
      <div>
        <h1 className="text-xl font-bold text-gray-800 dark:text-white">Chassis Search</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
          Track any vehicle through its full journey
        </p>
      </div>

      {/* Search bar */}
      <div className="flex gap-2">
        <input
          type="text"
          value={chassis}
          onChange={e => setChassis(e.target.value.toUpperCase())}
          onKeyDown={e => e.key === 'Enter' && handleSearch()}
          placeholder="Enter chassis number (full or last 4 digits)..."
          className="flex-1 border border-gray-200 dark:border-gray-700 rounded-lg px-4 py-3 text-sm font-mono bg-white dark:bg-gray-900 text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-brand-500 uppercase"
        />
        <button
          onClick={handleSearch}
          disabled={loading || chassis.trim().length < 3}
          className="px-5 py-3 rounded-lg bg-brand-500 text-white text-sm font-semibold hover:bg-brand-600 disabled:opacity-50 transition-colors"
        >
          {loading ? 'Searching...' : 'Search'}
        </button>
      </div>

      {error && <ErrorAlert message={error} />}

      {/* Multiple results */}
      {results.length > 1 && !selected && (
        <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-100 dark:border-gray-800">
            <p className="text-sm font-semibold text-gray-700 dark:text-gray-300">
              {results.length} vehicles found — select one:
            </p>
          </div>
          <div className="divide-y divide-gray-100 dark:divide-gray-800">
            {results.map(v => (
              <button
                key={v.vehicle_id}
                onClick={() => setSelected(v)}
                className="w-full px-4 py-3 flex items-center justify-between hover:bg-gray-50 dark:hover:bg-gray-800/40 transition-colors text-left"
              >
                <div>
                  <p className="font-mono text-sm font-semibold text-gray-800 dark:text-white">{v.chassis_number}</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    {[v.brand, v.model, v.vessel_name].filter(Boolean).join(' - ')}
                  </p>
                </div>
                <StatusBadge status={v.workflow_status} />
              </button>
            ))}
          </div>
        </div>
      )}

      {/* No results */}
      {searched && !loading && results.length === 0 && (
        <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-6 py-10 text-center text-gray-400">
          No vehicles found for &quot;{chassis}&quot;
        </div>
      )}

      {/* Vehicle detail */}
      {selected && (
        <div className="space-y-4">
          {results.length > 1 && (
            <button
              onClick={() => setSelected(null)}
              className="text-sm text-brand-500 hover:text-brand-600 flex items-center"
            >
              <BackIcon /> Back to results
            </button>
          )}

          {/* Journey progress */}
          <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-5">
            <WorkflowProgress status={selected.workflow_status} />

            <div className="grid grid-cols-2 gap-4 mt-2">
              <div>
                <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">Chassis</p>
                <p className="font-mono font-bold text-gray-900 dark:text-white text-lg">{selected.chassis_number}</p>
              </div>
              <div>
                <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">Current Status</p>
                <StatusBadge status={selected.workflow_status} />
              </div>
              <div>
                <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">Current Location</p>
                <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  {LOCATION_LABELS[selected.current_location] || selected.current_location || '—'}
                </p>
              </div>
              <div>
                <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">Vessel</p>
                <p className="text-sm font-medium text-gray-700 dark:text-gray-300">{selected.vessel_name || '—'}</p>
              </div>
              {selected.brand && (
                <div>
                  <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">Vehicle</p>
                  <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
                    {[selected.brand, selected.model, selected.year, selected.color].filter(Boolean).join(' ')}
                  </p>
                </div>
              )}
              {selected.customer_name && (
                <div>
                  <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">Customer</p>
                  <p className="text-sm font-medium text-gray-700 dark:text-gray-300">{selected.customer_name}</p>
                </div>
              )}
              {selected.batch_number && (
                <div>
                  <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">Batch</p>
                  <p className="text-sm font-mono font-medium text-gray-700 dark:text-gray-300">{selected.batch_number}</p>
                </div>
              )}
              {selected.driver_name && (
                <div>
                  <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">Driver</p>
                  <p className="text-sm font-medium text-gray-700 dark:text-gray-300">{selected.driver_name}</p>
                </div>
              )}
              {selected.received_at && (
                <div>
                  <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">Received At</p>
                  <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
                    {new Date(selected.received_at).toLocaleString()}
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Operation history timeline */}
          {selected.history?.length > 0 && (
            <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-5">
              <h3 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-4">
                Operation History
              </h3>
              <div className="relative">
                <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-gray-200 dark:bg-gray-700" />
                <div className="space-y-4">
                  {selected.history.map((h: any) => (
                    <div key={h.op_id} className="flex gap-4 relative">
                      {/* Icon circle */}
                      <div className="w-8 h-8 rounded-full bg-white dark:bg-gray-900 border-2 border-gray-200 dark:border-gray-700 flex items-center justify-center z-10 flex-shrink-0 text-gray-500 dark:text-gray-400">
                        {OP_ICON_SVG[h.operation_type] ?? <DefaultIcon />}
                      </div>

                      <div className="flex-1 pb-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-semibold text-gray-800 dark:text-white capitalize">
                            {h.operation_type.replace(/_/g, ' ')}
                          </span>
                          {h.to_status && <StatusBadge status={h.to_status} />}
                        </div>

                        {(h.from_location || h.to_location) && (
                          <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 flex items-center gap-0.5">
                            {h.from_location && <span>{LOCATION_LABELS[h.from_location] ?? h.from_location}</span>}
                            {h.from_location && h.to_location && <ArrowRightIcon />}
                            {h.to_location && <span>{LOCATION_LABELS[h.to_location] ?? h.to_location}</span>}
                          </p>
                        )}

                        {h.notes && (
                          <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 italic">{h.notes}</p>
                        )}

                        <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">
                          {h.operator_name} &middot; {new Date(h.performed_at).toLocaleString()}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
