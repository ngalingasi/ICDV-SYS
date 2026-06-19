/**
 * ManifestSelector.tsx
 *
 * Reusable manifest picker dropdown with search.
 * Shared between:
 *   - IcdvDashboard
 *   - LiveTransferMonitoringPage
 *   - TransferPerformancePage
 *   - BatchListPage
 *
 * Props:
 *   value        — currently selected Manifest or null (= all)
 *   onChange     — called when selection changes
 *   icdvId       — optional scope: only list manifests for this ICDV
 *   statusFilter — optional: 'active' | 'completed' | 'pending' — omit to show all
 *   placeholder  — override the trigger label when nothing selected
 *   allLabel     — label for the "clear / show all" option inside the dropdown
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { manifestsApi } from '../../api';
import type { Manifest } from '../../types';

interface ManifestSelectorProps {
  value:         Manifest | null;
  onChange:      (m: Manifest | null) => void;
  icdvId?:       number | null;
  statusFilter?: 'active' | 'completed' | 'pending';   // undefined = all statuses
  placeholder?:  string;
  allLabel?:     string;
}

const fmtDate = (d: string) =>
  new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });

export default function ManifestSelector({
  value,
  onChange,
  icdvId,
  statusFilter,
  placeholder = 'Select a manifest…',
  allLabel    = 'All manifests',
}: ManifestSelectorProps) {
  const [open,    setOpen]    = useState(false);
  const [search,  setSearch]  = useState('');
  const [list,    setList]    = useState<Manifest[]>([]);
  const [loading, setLoading] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const load = useCallback(async (q: string) => {
    setLoading(true);
    try {
      const r = await manifestsApi.list({
        search:  q        || undefined,
        limit:   30,
        icdv_id: icdvId   || undefined,
        status:  statusFilter,          // undefined = omitted = all statuses
      });
      setList(r.data.results ?? []);
    } finally { setLoading(false); }
  }, [icdvId, statusFilter]);

  useEffect(() => {
    if (open) load(search);
  }, [open, search, load]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  return (
    <div ref={ref} className="relative w-full">
      {/* Trigger */}
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between gap-2 px-3 py-2.5 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-sm text-left hover:border-brand-300 dark:hover:border-brand-600 focus:outline-none focus:ring-2 focus:ring-brand-500 transition-colors"
      >
        <span className={value ? 'text-gray-800 dark:text-white font-medium' : 'text-gray-400 dark:text-gray-500'}>
          {value ? `${value.manifest_number} · ${fmtDate(value.arrival_date)}` : placeholder}
        </span>
        <svg className={`w-4 h-4 flex-shrink-0 text-gray-400 transition-transform ${open ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {/* Dropdown */}
      {open && (
        <div className="absolute z-50 top-full mt-1.5 left-0 right-0 min-w-[280px] rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 shadow-xl overflow-hidden">
          {/* Search */}
          <div className="px-3 pt-3 pb-2 border-b border-gray-100 dark:border-gray-800">
            <div className="flex items-center gap-2 px-2.5 py-2 rounded-lg bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700">
              <svg className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input
                autoFocus
                type="text"
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search manifest number…"
                className="flex-1 bg-transparent text-sm text-gray-800 dark:text-white placeholder-gray-400 focus:outline-none"
              />
            </div>
          </div>

          {/* Options */}
          <div className="max-h-64 overflow-y-auto">
            {/* All manifests option */}
            <button
              onClick={() => { onChange(null); setOpen(false); setSearch(''); }}
              className={`w-full px-4 py-2.5 text-left text-sm hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors ${!value ? 'bg-brand-50 dark:bg-brand-500/10' : ''}`}
            >
              <span className={`font-medium ${!value ? 'text-brand-600 dark:text-brand-400' : 'text-gray-600 dark:text-gray-400'}`}>
                {allLabel}
              </span>
            </button>

            {loading ? (
              <div className="px-4 py-6 text-center text-sm text-gray-400">Loading…</div>
            ) : list.length === 0 ? (
              <div className="px-4 py-6 text-center text-sm text-gray-400">No manifests found</div>
            ) : list.map(m => (
              <button
                key={m.manifest_id}
                onClick={() => { onChange(m); setOpen(false); setSearch(''); }}
                className={`w-full px-4 py-2.5 text-left hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors ${value?.manifest_id === m.manifest_id ? 'bg-brand-50 dark:bg-brand-500/10' : ''}`}
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className={`text-sm font-semibold truncate ${value?.manifest_id === m.manifest_id ? 'text-brand-600 dark:text-brand-400' : 'text-gray-800 dark:text-white'}`}>
                      {m.manifest_number}
                    </p>
                    <p className="text-xs text-gray-400 mt-0.5">
                      {fmtDate(m.arrival_date)} · {(m as any).vessel_name ?? '—'}
                    </p>
                  </div>
                  <span className={`flex-shrink-0 text-xs px-2 py-0.5 rounded-full font-medium capitalize
                    ${m.status === 'completed' ? 'bg-green-50 dark:bg-green-500/10 text-green-700 dark:text-green-400' :
                      m.status === 'active'    ? 'bg-blue-50  dark:bg-blue-500/10  text-blue-700  dark:text-blue-400'  :
                                                 'bg-gray-100 dark:bg-gray-800     text-gray-500  dark:text-gray-400'}`}>
                    {m.status}
                  </span>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
