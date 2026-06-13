/**
 * TransferPerformancePage.tsx
 *
 * Report of completed vehicle transfers with full timeline.
 * TPA Gate-Out Time → Arrival Time → Duration → Status.
 *
 * Features:
 *   - ManifestSelector dropdown (reused from dashboard/live monitoring)
 *   - flatpickr date range filters
 *   - Print button — opens a styled A4 print window (same approach as delivery sheet)
 *
 * Routes:
 *   /operations/transfer-performance
 *   /manifests/:id/transfer-performance   (pre-filtered to manifest)
 */

import { useEffect, useRef, useState } from 'react';
import { useParams } from 'react-router';
import { workflowApi } from '../../api';
import BackButton from '../../components/tpfcs/BackButton';
import { FormDateInput } from '../../components/tpfcs/FormField';
import ManifestSelector from '../../components/tpfcs/ManifestSelector';
import type { Manifest } from '../../types';
import { useAuth } from '../../store/authStore';

// ─── Types ────────────────────────────────────────────────────────────────────

interface PerfRow {
  vehicle_id:                 number;
  chassis_number:             string;
  brand?:                     string;
  model?:                     string;
  manifest_number?:           string;
  manifest_id?:               number;
  driver_name?:               string;
  tpa_gate_out_time:          string;
  arrival_time:               string;
  transfer_duration_minutes:  number;
  normal_minutes:             number;
  max_minutes:                number;
  performance_status:         'on_time' | 'delayed';
}

interface PaginatedPerf {
  results:      PerfRow[];
  page:         number;
  limit:        number;
  totalPages:   number;
  totalResults: number;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const fmtDateTime = (d: string) =>
  new Date(d).toLocaleString('en-GB', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });

const fmtDate = (d: string) =>
  new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });

const fmtDuration = (mins: number) => {
  if (mins < 60) return `${mins}m`;
  return `${Math.floor(mins / 60)}h ${mins % 60}m`;
};

// ─── Print HTML builder ───────────────────────────────────────────────────────

function buildPrintHTML(
  rows: PerfRow[],
  meta: {
    manifest?: Manifest | null;
    dateFrom?: string;
    dateTo?: string;
    printed_by: string;
    print_date: string;
    on_time: number;
    delayed: number;
    avg_duration: number;
  }
): string {
  const tableRows = rows.map((r, i) => {
    const isDelayed = r.performance_status === 'delayed';
    return `
      <tr style="background:${i % 2 === 0 ? '#fff' : '#f9f9f9'}">
        <td style="text-align:center">${i + 1}</td>
        <td style="font-family:monospace;font-size:8.5pt;font-weight:700">${r.chassis_number}</td>
        <td>${[r.brand, r.model].filter(Boolean).join(' ') || '—'}</td>
        <td>${r.manifest_number ?? '—'}</td>
        <td>${r.driver_name ?? '—'}</td>
        <td>${fmtDateTime(r.tpa_gate_out_time)}</td>
        <td>${fmtDateTime(r.arrival_time)}</td>
        <td style="font-weight:700;color:${isDelayed ? '#dc2626' : '#16a34a'}">${fmtDuration(r.transfer_duration_minutes ?? 0)}</td>
        <td style="text-align:center">${r.max_minutes}m</td>
        <td style="text-align:center">
          <span style="display:inline-block;padding:2px 8px;border-radius:12px;font-size:7.5pt;font-weight:700;
            background:${isDelayed ? '#fee2e2' : '#dcfce7'};color:${isDelayed ? '#b91c1c' : '#15803d'}">
            ${isDelayed ? 'DELAYED' : 'ON TIME'}
          </span>
        </td>
      </tr>`;
  }).join('');

  const periodLabel = meta.dateFrom || meta.dateTo
    ? [meta.dateFrom ? `From: ${meta.dateFrom}` : '', meta.dateTo ? `To: ${meta.dateTo}` : ''].filter(Boolean).join('  ·  ')
    : 'All dates';

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<title>Transfer Performance Report${meta.manifest ? ' — ' + meta.manifest.manifest_number : ''}</title>
<style>
  * { box-sizing:border-box; margin:0; padding:0; }
  body { font-family:Arial,Helvetica,sans-serif; font-size:9.5pt; color:#000; background:#fff; }
  .header-table { width:100%; border-collapse:collapse; border-bottom:2px solid #000; padding-bottom:6px; margin-bottom:8px; }
  .header-table td { padding:4px 6px; vertical-align:middle; }
  .info-table { width:100%; border-collapse:collapse; border:1px solid #ccc; margin-bottom:8px; background:#f5f5f5; }
  .info-table td { padding:5px 10px; border-right:1px solid #ccc; font-size:9pt; vertical-align:top; }
  .info-table td:last-child { border-right:none; }
  .lbl { font-size:7pt; text-transform:uppercase; color:#666; letter-spacing:0.5px; display:block; }
  .kpi-table { width:100%; border-collapse:collapse; border:1px solid #ccc; margin-bottom:10px; }
  .kpi-table td { padding:8px 14px; border-right:1px solid #ccc; text-align:center; }
  .kpi-table td:last-child { border-right:none; }
  .kpi-val { font-size:16pt; font-weight:900; display:block; }
  .perf-table { width:100%; border-collapse:collapse; border:1px solid #999; margin-bottom:10px; table-layout:fixed; }
  .perf-table thead tr { background:#333; color:#fff; }
  .perf-table th { padding:6px 7px; text-align:left; font-size:7.5pt; text-transform:uppercase;
    letter-spacing:0.5px; border-right:1px solid #555; font-weight:700; }
  .perf-table th:last-child { border-right:none; }
  .perf-table td { padding:5px 7px; font-size:8.5pt; border-bottom:1px solid #ddd;
    border-right:1px solid #ddd; vertical-align:top; word-wrap:break-word; overflow-wrap:break-word; }
  .perf-table td:last-child { border-right:none; }
  .perf-table tbody tr:last-child td { border-bottom:none; }
  .footer { display:flex; justify-content:space-between; font-size:7.5pt; color:#666;
    border-top:1px solid #ccc; padding-top:4px; margin-top:4px; }
  @page { size: A4 landscape; margin: 10mm 12mm; }
  @media print { body { background:#fff; } }
</style>
</head>
<body>

  <table class="header-table">
    <tr>
      <td style="width:40%">
        <strong style="font-size:11pt">Transfer Performance Report</strong>
        ${meta.manifest ? `<br><span style="font-size:8pt;color:#555">${meta.manifest.manifest_number} &nbsp;·&nbsp; Vessel: ${(meta.manifest as any).vessel_name ?? '—'}</span>` : ''}
      </td>
      <td style="width:30%;text-align:center">
        <div style="font-size:13pt;font-weight:900;letter-spacing:1px">TRANSFER PERFORMANCE</div>
        <div style="font-size:8pt;color:#555;margin-top:2px">TPA Gate-Out → ICDV Yard Arrival</div>
      </td>
      <td style="width:30%;text-align:right;font-size:8pt;color:#444">
        Printed by: <strong>${meta.printed_by}</strong><br>
        Date: ${meta.print_date}<br>
        Period: ${periodLabel}
      </td>
    </tr>
  </table>

  <table class="info-table">
    <tr>
      <td><span class="lbl">Total Records</span><strong>${rows.length}</strong></td>
      <td><span class="lbl">On Time</span><strong style="color:#15803d">${meta.on_time}</strong></td>
      <td><span class="lbl">Delayed</span><strong style="color:#b91c1c">${meta.delayed}</strong></td>
      <td><span class="lbl">On-Time Rate</span><strong>${rows.length ? Math.round((meta.on_time / rows.length) * 100) : 0}%</strong></td>
      <td><span class="lbl">Avg Duration</span><strong>${fmtDuration(meta.avg_duration)}</strong></td>
    </tr>
  </table>

  <table class="perf-table">
    <thead>
      <tr>
        <th style="width:4%">#</th>
        <th style="width:13%">Chassis No.</th>
        <th style="width:11%">Vehicle</th>
        <th style="width:11%">Manifest</th>
        <th style="width:12%">Driver</th>
        <th style="width:14%">Gate-Out Time</th>
        <th style="width:14%">Arrival Time</th>
        <th style="width:8%">Duration</th>
        <th style="width:6%">Max</th>
        <th style="width:7%">Status</th>
      </tr>
    </thead>
    <tbody>
      ${tableRows || '<tr><td colspan="10" style="text-align:center;padding:16px;color:#888">No records</td></tr>'}
    </tbody>
  </table>

  <div class="footer">
    <span>ICDV Transfer Performance Report &nbsp;—&nbsp; Confidential</span>
    <span>Generated: ${meta.print_date}</span>
  </div>

</body>
</html>`;
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function TransferPerformancePage() {
  const { id: manifestIdParam } = useParams<{ id?: string }>();
  const { user }                = useAuth();

  const [data,             setData]             = useState<PaginatedPerf | null>(null);
  const [loading,          setLoading]          = useState(true);
  const [page,             setPage]             = useState(1);
  const [dateFrom,         setDateFrom]         = useState('');
  const [dateTo,           setDateTo]           = useState('');
  // Manifest selector — only shown when NOT opened via /manifests/:id/
  const [selectedManifest, setSelectedManifest] = useState<Manifest | null>(null);

  // Effective manifest filter: URL param takes priority
  const effectiveManifestId = manifestIdParam
    ? Number(manifestIdParam)
    : selectedManifest?.manifest_id ?? undefined;

  const load = () => {
    setLoading(true);
    workflowApi.getTransferPerformance({
      manifest_id: effectiveManifestId,
      date_from:   dateFrom || undefined,
      date_to:     dateTo   || undefined,
      page,
      limit: 25,
    })
      .then(r => setData(r.data))
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, [page, effectiveManifestId]); // eslint-disable-line
  const applyFilters = () => { setPage(1); load(); };

  const rows         = data?.results      ?? [];
  const totalPages   = data?.totalPages   ?? 1;
  const totalResults = data?.totalResults ?? 0;

  const onTimeCount  = rows.filter(r => r.performance_status === 'on_time').length;
  const delayedCount = rows.filter(r => r.performance_status === 'delayed').length;
  const avgDuration  = rows.length
    ? Math.round(rows.reduce((s, r) => s + (r.transfer_duration_minutes ?? 0), 0) / rows.length)
    : 0;

  // ── Print ──────────────────────────────────────────────────────────────────
  const handlePrint = () => {
    if (!rows.length) return;
    const html = buildPrintHTML(rows, {
      manifest:     selectedManifest,
      dateFrom:     dateFrom ? fmtDate(dateFrom) : '',
      dateTo:       dateTo   ? fmtDate(dateTo)   : '',
      printed_by:   user?.full_name ?? user?.username ?? 'System',
      print_date:   new Date().toLocaleString('en-GB', {
        day: '2-digit', month: 'short', year: 'numeric',
        hour: '2-digit', minute: '2-digit',
      }),
      on_time:      onTimeCount,
      delayed:      delayedCount,
      avg_duration: avgDuration,
    });
    const w = window.open('', '_blank', 'width=1100,height=800');
    if (!w) return;
    w.document.open();
    w.document.write(html);
    w.document.close();
    w.onload = () => { w.focus(); w.print(); };
  };

  return (
    <div className="p-4 sm:p-6 space-y-5">

      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <BackButton />
          <div>
            <h1 className="text-xl font-bold text-gray-800 dark:text-white">Transfer Performance Report</h1>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
              {manifestIdParam
                ? 'Manifest-scoped · '
                : selectedManifest
                  ? `${selectedManifest.manifest_number} · `
                  : ''}
              TPA gate-out to ICDV yard arrival timeline
            </p>
          </div>
        </div>
        {rows.length > 0 && (
          <button
            onClick={handlePrint}
            className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-sm font-medium transition-colors"
          >
            <PrintIcon /> Print Report
          </button>
        )}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-end">
        {/* Manifest selector — only when not opened via URL param */}
        {!manifestIdParam && (
          <div className="w-64">
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1.5">
              Manifest
            </label>
            <ManifestSelector
              value={selectedManifest}
              onChange={m => { setSelectedManifest(m); setPage(1); }}
              placeholder="All manifests…"
              allLabel="All manifests"
            />
          </div>
        )}
        <div className="w-44">
          <FormDateInput
            label="From"
            id="perf-date-from"
            value={dateFrom}
            onChange={setDateFrom}
            placeholder="Start date"
          />
        </div>
        <div className="w-44">
          <FormDateInput
            label="To"
            id="perf-date-to"
            value={dateTo}
            onChange={setDateTo}
            placeholder="End date"
          />
        </div>
        <div className="flex gap-2 pb-0.5">
          <button onClick={applyFilters}
            className="px-4 py-2 rounded-lg bg-brand-500 hover:bg-brand-600 text-white text-sm font-medium">
            Apply
          </button>
          {(dateFrom || dateTo) && (
            <button onClick={() => { setDateFrom(''); setDateTo(''); setTimeout(applyFilters, 0); }}
              className="px-4 py-2 rounded-lg border border-gray-200 dark:border-gray-700 text-sm text-gray-500 hover:bg-gray-50 dark:hover:bg-gray-800">
              Clear
            </button>
          )}
        </div>
      </div>

      {/* KPI strip */}
      {!loading && rows.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: 'Total Records', value: totalResults,          color: 'text-gray-800 dark:text-white' },
            { label: 'On Time',       value: onTimeCount,           color: 'text-green-600 dark:text-green-400' },
            { label: 'Delayed',       value: delayedCount,          color: 'text-red-600 dark:text-red-400' },
            { label: 'Avg Duration',  value: fmtDuration(avgDuration), color: 'text-brand-600 dark:text-brand-400' },
          ].map(s => (
            <div key={s.label} className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-4 text-center">
              <p className="text-xs text-gray-500 dark:text-gray-400">{s.label}</p>
              <p className={`text-2xl font-bold mt-1 ${s.color}`}>{s.value}</p>
            </div>
          ))}
        </div>
      )}

      {/* Table */}
      <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[760px]">
            <thead>
              <tr className="border-b border-gray-200 dark:border-gray-700">
                {['Manifest #', 'Vehicle (Chassis)', 'Driver', 'Gate-Out Time', 'Arrival Time', 'Duration', 'Max Allowed', 'Status'].map(h => (
                  <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
              {loading ? (
                Array.from({ length: 8 }).map((_, i) => (
                  <tr key={i}>{Array.from({ length: 8 }).map((_, j) => (
                    <td key={j} className="px-4 py-3"><div className="h-3.5 bg-gray-200 dark:bg-gray-700 rounded animate-pulse w-16" /></td>
                  ))}</tr>
                ))
              ) : rows.length === 0 ? (
                <tr><td colSpan={8} className="px-4 py-12 text-center text-sm text-gray-400">
                  No completed transfers found for the selected filters.
                </td></tr>
              ) : rows.map(row => {
                const isDelayed = row.performance_status === 'delayed';
                return (
                  <tr key={row.vehicle_id} className={`hover:bg-gray-50 dark:hover:bg-gray-800/40 ${isDelayed ? 'bg-red-50/30 dark:bg-red-500/5' : ''}`}>
                    <td className="px-4 py-3 text-xs font-mono text-brand-600 dark:text-brand-400 whitespace-nowrap">
                      {row.manifest_number ?? '—'}
                    </td>
                    <td className="px-4 py-3">
                      <p className="font-mono text-xs font-semibold text-gray-800 dark:text-white">{row.chassis_number}</p>
                      {(row.brand || row.model) && (
                        <p className="text-[11px] text-gray-400">{[row.brand, row.model].filter(Boolean).join(' ')}</p>
                      )}
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-600 dark:text-gray-400 whitespace-nowrap">
                      {row.driver_name ?? '—'}
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-600 dark:text-gray-400 whitespace-nowrap">
                      {fmtDateTime(row.tpa_gate_out_time)}
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-600 dark:text-gray-400 whitespace-nowrap">
                      {fmtDateTime(row.arrival_time)}
                    </td>
                    <td className={`px-4 py-3 text-xs font-semibold whitespace-nowrap ${isDelayed ? 'text-red-600 dark:text-red-400' : 'text-green-600 dark:text-green-400'}`}>
                      {fmtDuration(row.transfer_duration_minutes ?? 0)}
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-500 dark:text-gray-400 whitespace-nowrap">
                      {row.max_minutes}m
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold ${
                        isDelayed
                          ? 'bg-red-100 dark:bg-red-500/20 text-red-700 dark:text-red-400'
                          : 'bg-green-100 dark:bg-green-500/20 text-green-700 dark:text-green-400'
                      }`}>
                        {isDelayed ? 'Delayed' : 'On Time'}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-gray-200 dark:border-gray-700">
            <p className="text-xs text-gray-500">Page {page} of {totalPages} · {totalResults} records</p>
            <div className="flex gap-2">
              <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
                className="px-3 py-1 rounded border border-gray-200 dark:border-gray-700 text-xs text-gray-600 dark:text-gray-400 disabled:opacity-50">Prev</button>
              <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}
                className="px-3 py-1 rounded border border-gray-200 dark:border-gray-700 text-xs text-gray-600 dark:text-gray-400 disabled:opacity-50">Next</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

const PrintIcon = () => (
  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
  </svg>
);
