import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router';
import { driversApi } from '../../api';
import type { Driver } from '../../types';
import StatusBadge from '../../components/tpfcs/StatusBadge';
import { toast } from '../../components/tpfcs/Toast';
import { useAuth } from '../../store/authStore';

// ── Print CSS — injected on mount, hides screen UI during print ───────────────
const PRINT_CSS = `
  .driver-print-hidden { display: none; }

  @media print {
    body > * { visibility: hidden; }
    .driver-print-hidden {
      display: block !important;
      visibility: visible;
      position: absolute;
      top: 0; left: 0;
      width: 100%;
      background: white;
      z-index: 99999;
    }
    .driver-print-hidden * { visibility: visible; }
    @page { size: A4 portrait; margin: 15mm 12mm; }
    table  { border-collapse: collapse; width: 100%; page-break-inside: auto; }
    tr     { page-break-inside: avoid; }
    .driver-data-table thead { display: table-header-group; }
    tfoot  { display: table-footer-group; }
  }
`;

// ── Cell styles used in the printable table ───────────────────────────────────
const th: React.CSSProperties = {
  padding: '6px 10px', textAlign: 'left', fontSize: '8.5pt',
  fontWeight: 'bold', border: '1px solid #374151', whiteSpace: 'nowrap',
};
const td: React.CSSProperties = {
  padding: '5px 10px', border: '1px solid #d1d5db', verticalAlign: 'middle',
};

export default function DriversPage() {
  const { icdvName, user } = useAuth();

  const [drivers,   setDrivers]   = useState<Driver[]>([]);
  const [total,     setTotal]     = useState(0);
  const [loading,   setLoading]   = useState(true);
  const [search,    setSearch]    = useState('');
  const [page,      setPage]      = useState(1);
  const [delId,     setDelId]     = useState<number | null>(null);
  const [deleting,  setDeleting]  = useState(false);

  // ── Selection state ───────────────────────────────────────────────────────
  const [selected,     setSelected]     = useState<Set<number>>(new Set());
  // Ref mirrors selected so handlePrint always reads the LATEST set,
  // even if called immediately after a checkbox change (before React re-render).
  const selectedRef = useRef<Set<number>>(new Set());
  const [printing,     setPrinting]     = useState(false);
  const [printDrivers, setPrintDrivers] = useState<Driver[]>([]);

  const limit    = 20;
  const timer    = useRef<ReturnType<typeof setTimeout>>(undefined as any);
  const printDate = new Date().toLocaleString('en-GB', {
    day: '2-digit', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit',
  });

  // ── Inject print CSS on mount ─────────────────────────────────────────────
  useEffect(() => {
    const style = document.createElement('style');
    style.id = 'driver-print-css';
    style.innerHTML = PRINT_CSS;
    document.head.appendChild(style);
    return () => { style.remove(); };
  }, []);

  const load = () => {
    setLoading(true);
    driversApi.list({ page, limit, search: search || undefined })
      .then(r => { setDrivers(r.data.results); setTotal(r.data.totalResults); })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    clearTimeout(timer.current);
    timer.current = setTimeout(() => { setPage(1); load(); }, 350);
    return () => clearTimeout(timer.current);
  }, [search]); // eslint-disable-line

  useEffect(() => { load(); }, [page]); // eslint-disable-line

  // ── Checkbox helpers ──────────────────────────────────────────────────────
  const toggleOne = (id: number) =>
    setSelected(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      selectedRef.current = next;
      return next;
    });

  const allOnPageSelected =
    drivers.length > 0 && drivers.every(d => selected.has(d.driver_id));

  const someOnPageSelected = drivers.some(d => selected.has(d.driver_id));

  const toggleAllOnPage = () => {
    if (allOnPageSelected) {
      setSelected(prev => {
        const next = new Set(prev);
        drivers.forEach(d => next.delete(d.driver_id));
        selectedRef.current = next;
        return next;
      });
    } else {
      setSelected(prev => {
        const next = new Set(prev);
        drivers.forEach(d => next.add(d.driver_id));
        selectedRef.current = next;
        return next;
      });
    }
  };

  const clearSelection = () => {
    const empty = new Set<number>();
    selectedRef.current = empty;
    setSelected(empty);
  };

  // ── Print — only checked drivers ─────────────────────────────────────────
  const handlePrint = async () => {
    const currentSelected = new Set(selectedRef.current);
    if (currentSelected.size === 0) {
      toast.error('Select at least one driver to print.');
      return;
    }
    setPrinting(true);
    try {
      const r = await driversApi.list({ page: 1, limit: 9999 });
      const all: Driver[] = r.data.results ?? [];

      const onPage    = drivers.filter(d => currentSelected.has(d.driver_id));
      const onPageIds = new Set(onPage.map(d => d.driver_id));
      const others    = all
        .filter(d => currentSelected.has(d.driver_id) && !onPageIds.has(d.driver_id))
        .sort((a, b) => a.full_name.localeCompare(b.full_name));

      const toPrint = [...onPage, ...others];

      if (toPrint.length !== currentSelected.size) {
        toast.error(`${currentSelected.size - toPrint.length} selected driver(s) could not be found.`);
      }

      setPrintDrivers(toPrint);
      await new Promise(res => setTimeout(res, 200));
      window.print();
    } catch {
      toast.error('Failed to load drivers for printing.');
    } finally {
      setPrinting(false);
    }
  };

  const handleDelete = async () => {
    if (!delId) return;
    setDeleting(true);
    try {
      await driversApi.delete(delId);
      toast.success('Driver deleted');
      setDelId(null);
      load();
    } catch (e: any) {
      toast.error(e?.response?.data?.message ?? 'Delete failed');
    } finally { setDeleting(false); }
  };

  const totalPages = Math.ceil(total / limit);
  const orgName    = icdvName ?? 'ICDV Management';
  const selCount   = selected.size;

  return (
    <div className="p-6 space-y-5">

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold text-gray-900 dark:text-white">Drivers</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            {total} driver{total !== 1 ? 's' : ''} registered
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {/* Print button */}
          <button
            onClick={handlePrint}
            disabled={printing || selCount === 0}
            title={selCount === 0 ? 'Check drivers below to enable printing' : `Print ${selCount} selected driver${selCount !== 1 ? 's' : ''}`}
            className={`inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium rounded-lg border transition-colors ${
              selCount > 0
                ? 'border-gray-800 bg-gray-800 text-white hover:bg-gray-700'
                : 'border-gray-300 dark:border-gray-700 text-gray-400 dark:text-gray-600 cursor-not-allowed'
            } disabled:opacity-60`}
          >
            {printing ? (
              <>
                <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"/>
                </svg>
                Preparing…
              </>
            ) : (
              <>
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round"
                    d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
                </svg>
                Print{selCount > 0 ? ` (${selCount})` : ''}
              </>
            )}
          </button>

          <Link to="/drivers/new"
            className="px-4 py-2 text-sm font-medium bg-brand-500 hover:bg-brand-600 text-white rounded-lg transition-colors">
            + Add Driver
          </Link>
        </div>
      </div>

      {/* ── Selection action bar ────────────────────────────────────────────── */}
      {selCount > 0 && (
        <div className="flex items-center justify-between px-4 py-2.5 rounded-lg bg-brand-50 dark:bg-brand-500/10 border border-brand-200 dark:border-brand-500/30 text-sm">
          <span className="font-medium text-brand-700 dark:text-brand-300">
            {selCount} driver{selCount !== 1 ? 's' : ''} selected
          </span>
          <button
            onClick={clearSelection}
            className="text-xs text-brand-500 hover:text-brand-700 dark:hover:text-brand-300 font-medium"
          >
            Clear selection
          </button>
        </div>
      )}

      {/* ── Search ─────────────────────────────────────────────────────────── */}
      <div className="flex gap-3 flex-wrap">
        <input
          type="text" placeholder="Search by name or license…" value={search}
          onChange={e => setSearch(e.target.value)}
          className="border border-gray-300 dark:border-gray-700 rounded-lg px-3 py-2 text-sm w-64 focus:outline-none focus:ring-2 focus:ring-brand-500 bg-white dark:bg-gray-900 text-gray-800 dark:text-gray-200"
        />
      </div>

      {/* ── Table ──────────────────────────────────────────────────────────── */}
      <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 dark:bg-gray-800/50 border-b border-gray-200 dark:border-gray-700 text-xs text-gray-500 dark:text-gray-400 uppercase">
            <tr>
              <th className="px-4 py-3 w-10">
                <input
                  type="checkbox"
                  checked={allOnPageSelected}
                  ref={el => { if (el) el.indeterminate = someOnPageSelected && !allOnPageSelected; }}
                  onChange={toggleAllOnPage}
                  title={allOnPageSelected ? 'Deselect all on this page' : 'Select all on this page'}
                  className="w-4 h-4 rounded accent-brand-500 cursor-pointer"
                />
              </th>
              {['Name', 'ID Number', 'License Number', 'Phone', 'Status', 'Actions'].map(h => (
                <th key={h} className="px-4 py-3 text-left font-medium">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
            {loading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <tr key={i} className="animate-pulse">
                  {Array.from({ length: 7 }).map((_, j) => (
                    <td key={j} className="px-4 py-3">
                      <div className="h-4 bg-gray-100 dark:bg-gray-800 rounded w-24" />
                    </td>
                  ))}
                </tr>
              ))
            ) : drivers.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-10 text-center text-gray-400">
                  No drivers found
                </td>
              </tr>
            ) : drivers.map(d => {
              const isChecked = selected.has(d.driver_id);
              return (
                <tr
                  key={d.driver_id}
                  className={`hover:bg-gray-50 dark:hover:bg-gray-800/40 transition-colors ${isChecked ? 'bg-brand-50 dark:bg-brand-500/10' : ''}`}
                >
                  <td className="px-4 py-3">
                    <input
                      type="checkbox"
                      checked={isChecked}
                      onChange={() => toggleOne(d.driver_id)}
                      className="w-4 h-4 rounded accent-brand-500 cursor-pointer"
                    />
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-full overflow-hidden bg-gray-100 flex-shrink-0 flex items-center justify-center">
                        {(d as any).photo
                          ? <img src={`http://localhost:3000${(d as any).photo}`} alt="" className="w-full h-full object-cover" />
                          : <svg className="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                            </svg>
                        }
                      </div>
                      <span className="font-medium text-gray-900 dark:text-white">{d.full_name}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 font-mono text-xs text-gray-700 dark:text-gray-300">{(d as any).id_number ?? '—'}</td>
                  <td className="px-4 py-3 font-mono text-gray-700 dark:text-gray-300">{d.license_number}</td>
                  <td className="px-4 py-3 text-gray-600 dark:text-gray-400">{d.phone ?? '—'}</td>
                  <td className="px-4 py-3"><StatusBadge status={d.status} /></td>
                  <td className="px-4 py-3">
                    <div className="flex gap-3">
                      <Link to={`/drivers/${d.driver_id}`} className="text-brand-600 hover:underline text-xs">View</Link>
                      <Link to={`/drivers/${d.driver_id}/edit`} className="text-gray-600 hover:underline text-xs">Edit</Link>
                      <button onClick={() => setDelId(d.driver_id)} className="text-red-500 hover:underline text-xs">Delete</button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="px-4 py-3 border-t border-gray-100 dark:border-gray-800 flex items-center justify-between text-sm text-gray-600 dark:text-gray-400">
            <span>Page {page} of {totalPages}</span>
            <div className="flex gap-2">
              <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
                className="px-3 py-1 rounded border border-gray-300 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800 disabled:opacity-40">Prev</button>
              <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}
                className="px-3 py-1 rounded border border-gray-300 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800 disabled:opacity-40">Next</button>
            </div>
          </div>
        )}
      </div>

      {/* ── Delete modal ───────────────────────────────────────────────────── */}
      {delId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white dark:bg-gray-900 rounded-xl shadow-xl p-6 w-full max-w-sm mx-4 border border-gray-200 dark:border-gray-700">
            <h3 className="text-base font-semibold text-gray-900 dark:text-white mb-2">Delete Driver</h3>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-5">This action cannot be undone.</p>
            <div className="flex gap-3 justify-end">
              <button onClick={() => setDelId(null)}
                className="px-4 py-2 text-sm rounded-lg border border-gray-300 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800">Cancel</button>
              <button onClick={handleDelete} disabled={deleting}
                className="px-4 py-2 text-sm font-medium rounded-lg bg-red-600 text-white hover:bg-red-700 disabled:opacity-50">
                {deleting ? 'Deleting…' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Hidden printable section ───────────────────────────────────────────
          Only rendered when print is triggered. Hidden on screen via CSS class.
          position: absolute (not fixed) so the org header only appears once —
          on page 1 — and does not overlay content on subsequent pages.
      ─────────────────────────────────────────────────────────────────────── */}
      <div className="driver-print-hidden">
        <div style={{ fontFamily: 'Arial, sans-serif', fontSize: '10pt', color: '#000' }}>

          {/* Org header — appears on first page only */}
          <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '16px' }}>
            <tbody>
              <tr>
                <td style={{ verticalAlign: 'middle', paddingRight: '16px', width: '60px' }}>
                  <img src="/images/logo/logo.png" alt="Logo"
                    style={{ height: '52px', width: '52px', objectFit: 'contain', borderRadius: '8px' }}
                    onError={e => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }} />
                </td>
                <td style={{ verticalAlign: 'middle' }}>
                  <div style={{ fontSize: '14pt', fontWeight: 'bold', color: '#111' }}>{orgName}</div>
                  <div style={{ fontSize: '8pt', color: '#666', marginTop: '2px' }}>
                    ICDV Vehicle Import & Delivery Management System
                  </div>
                </td>
                <td style={{ verticalAlign: 'middle', textAlign: 'right' }}>
                  <div style={{ fontSize: '16pt', fontWeight: '900', color: '#111', textTransform: 'uppercase', letterSpacing: '1px' }}>
                    DRIVER LIST
                  </div>
                  <div style={{ fontSize: '8pt', color: '#666', marginTop: '4px' }}>
                    Print Date: {printDate}
                  </div>
                  <div style={{ fontSize: '8pt', color: '#666' }}>
                    Generated By: {(user as any)?.full_name ?? (user as any)?.username ?? 'System'}
                  </div>
                  <div style={{ fontSize: '8pt', color: '#666' }}>
                    Drivers Selected: {printDrivers.length}
                    {search ? ` · Filter: "${search}"` : ''}
                  </div>
                </td>
              </tr>
            </tbody>
          </table>

          <div style={{ borderTop: '2px solid #111', marginBottom: '12px' }} />

          {/* Driver data table — thead repeats column headers on every page via CSS */}
          <table className="driver-data-table" style={{ width: '100%', borderCollapse: 'collapse', fontSize: '9pt' }}>
            <thead>
              <tr style={{ background: '#1e3a5f', color: '#fff' }}>
                <th style={th}>No.</th>
                <th style={th}>ID Number</th>
                <th style={th}>Driver Name</th>
                <th style={th}>License Number</th>
                <th style={th}>Mobile Number</th>
                <th style={th}>Status</th>
              </tr>
            </thead>
            <tbody>
              {printDrivers.length === 0 ? (
                <tr>
                  <td colSpan={6} style={{ ...td, textAlign: 'center', color: '#888', padding: '24px' }}>
                    No drivers selected
                  </td>
                </tr>
              ) : printDrivers.map((d, idx) => (
                <tr key={d.driver_id} style={{ background: idx % 2 === 0 ? '#fff' : '#f5f7fa' }}>
                  <td style={{ ...td, textAlign: 'center', color: '#888', width: '36px' }}>{idx + 1}</td>
                  <td style={{ ...td, fontFamily: 'Courier New, monospace', fontSize: '8.5pt', fontWeight: '700' }}>
                    {(d as any).id_number ?? '—'}
                  </td>
                  <td style={{ ...td, fontWeight: '600' }}>{d.full_name}</td>
                  <td style={{ ...td, fontFamily: 'Courier New, monospace', fontSize: '8.5pt', fontWeight: '700' }}>
                    {d.license_number}
                  </td>
                  <td style={td}>{d.phone ?? '—'}</td>
                  <td style={{ ...td, textAlign: 'center' }}>
                    <span style={{
                      display: 'inline-block', padding: '1px 8px', borderRadius: '10px',
                      fontSize: '8pt', fontWeight: '600',
                      background: d.status === 'active' ? '#dcfce7' : '#fee2e2',
                      color:      d.status === 'active' ? '#166534' : '#991b1b',
                      border:    `1px solid ${d.status === 'active' ? '#86efac' : '#fca5a5'}`,
                    }}>
                      {d.status?.toUpperCase()}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
            {printDrivers.length > 0 && (
              <tfoot>
                <tr style={{ background: '#1e3a5f', color: '#fff', fontWeight: 'bold' }}>
                  <td colSpan={3} style={{ ...td, textAlign: 'right', fontSize: '8.5pt', color: '#fff', borderColor: '#374151' }}>
                    TOTAL:
                  </td>
                  <td style={{ ...td, fontSize: '8.5pt', color: '#fff', borderColor: '#374151' }}>
                    {printDrivers.length}
                  </td>
                  <td style={{ ...td, fontSize: '8.5pt', color: '#fff', borderColor: '#374151' }}>
                    Active: {printDrivers.filter(d => d.status === 'active').length}
                  </td>
                  <td style={{ ...td, fontSize: '8.5pt', color: '#fff', borderColor: '#374151' }}>
                    Inactive: {printDrivers.filter(d => d.status !== 'active').length}
                  </td>
                </tr>
              </tfoot>
            )}
          </table>

          {/* Signature footer */}
          <div style={{ marginTop: '48px' }}>
            <div style={{ borderTop: '1px solid #ccc', marginBottom: '24px' }} />
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <tbody>
                <tr>
                  {['PREPARED BY:', 'VERIFIED BY:', 'APPROVED BY:'].map(label => (
                    <td key={label} style={{ width: '33%', paddingRight: '24px', verticalAlign: 'top' }}>
                      <div style={{ fontSize: '8.5pt', fontWeight: '600', color: '#374151', marginBottom: '6px' }}>{label}</div>
                      <div style={{ borderBottom: '1px solid #9ca3af', height: '36px' }} />
                      <div style={{ fontSize: '8pt', color: '#6b7280', marginTop: '4px' }}>Name &amp; Signature</div>
                    </td>
                  ))}
                </tr>
              </tbody>
            </table>
            <div style={{ textAlign: 'center', fontSize: '7.5pt', color: '#9ca3af', marginTop: '24px' }}>
              {orgName} · Driver List · Printed {printDate} · ICDV Vehicle Import & Delivery Management System
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}