import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router';
import { driversApi } from '../../api';
import type { Driver } from '../../types';
import StatusBadge from '../../components/tpfcs/StatusBadge';
import { toast } from '../../components/tpfcs/Toast';
import { useAuth } from '../../store/authStore';

// ─── Print styles ─────────────────────────────────────────────────────────────
// Injected into <head> only while the print dialog is open.
const PRINT_CSS = `
  /* Hide print root on screen — overridden at print time */
  .driver-print-hidden { display: none; }

  @media print {
    /* Hide all normal page chrome */
    body > * { visibility: hidden; }
    .driver-print-hidden { display: block !important; visibility: visible; }
    .driver-print-hidden * { visibility: visible; }

    /* Position the sheet to fill the page */
    .driver-print-hidden {
      position: fixed;
      top: 0; left: 0;
      width: 100%; height: auto;
      background: white;
      z-index: 99999;
    }

    /* A4 portrait, 15 mm margins */
    @page { size: A4 portrait; margin: 15mm 12mm; }

    /* Prevent rows from splitting across page breaks */
    table  { border-collapse: collapse; width: 100%; page-break-inside: auto; }
    thead  { display: table-header-group; }
    tfoot  { display: table-footer-group; }
    tr     { page-break-inside: avoid; }
  }
`;

export default function DriversPage() {
  const { icdvName, user } = useAuth();

  const [drivers,   setDrivers]   = useState<Driver[]>([]);
  const [total,     setTotal]     = useState(0);
  const [loading,   setLoading]   = useState(true);
  const [search,    setSearch]    = useState('');
  const [page,      setPage]      = useState(1);
  const [delId,     setDelId]     = useState<number | null>(null);
  const [deleting,  setDeleting]  = useState(false);

  // Print state
  const [printing,     setPrinting]     = useState(false);
  const [printDrivers, setPrintDrivers] = useState<Driver[]>([]);
  const limit = 20;
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined as any);

  const load = () => {
    setLoading(true);
    driversApi.list({ page, limit, search: search || undefined })
      .then(r => { setDrivers(r.data.results); setTotal(r.data.totalResults); })
      .finally(() => setLoading(false));
  };

  // Inject the screen-hiding CSS for the print section on mount
  useEffect(() => {
    const style = document.createElement('style');
    style.id = 'driver-print-screen-css';
    style.innerHTML = PRINT_CSS;
    document.head.appendChild(style);
    return () => { style.remove(); };
  }, []);

  useEffect(() => {
    clearTimeout(timer.current);
    timer.current = setTimeout(() => { setPage(1); load(); }, 350);
    return () => clearTimeout(timer.current);
  }, [search]); // eslint-disable-line

  useEffect(() => { load(); }, [page]); // eslint-disable-line

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

  // ── Print handler ─────────────────────────────────────────────────────────
  const handlePrint = async () => {
    setPrinting(true);
    try {
      // Fetch ALL drivers (no pagination limit) for the print
      const r = await driversApi.list({ page: 1, limit: 9999, search: search || undefined });
      setPrintDrivers(r.data.results ?? []);

      // Let React re-render the print DOM with the new data before opening print dialog
      await new Promise(res => setTimeout(res, 200));
      window.print();
    } catch {
      toast.error('Failed to load drivers for printing');
    } finally {
      setPrinting(false);
    }
  };

  const totalPages = Math.ceil(total / limit);

  const printDate = new Date().toLocaleDateString('en-GB', {
    day: '2-digit', month: 'long', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });

  const orgName = icdvName ?? 'ICDV Management';

  return (
    <div className="p-4 sm:p-6 space-y-5">

      {/* ── Page Header ───────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold text-gray-900 dark:text-white">Drivers</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            {total} driver{total !== 1 ? 's' : ''} registered
          </p>
        </div>
        <div className="flex items-center gap-2">
          {/* Print button */}
          <button
            onClick={handlePrint}
            disabled={printing || loading}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium border border-gray-300 dark:border-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 disabled:opacity-50 transition-colors"
          >
            {printing ? (
              <>
                <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                </svg>
                Preparing…
              </>
            ) : (
              <>
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round"
                    d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
                </svg>
                Print Driver List
              </>
            )}
          </button>

          <Link
            to="/drivers/new"
            className="px-4 py-2 text-sm font-medium bg-brand-500 hover:bg-brand-600 text-white rounded-lg transition-colors"
          >
            + Add Driver
          </Link>
        </div>
      </div>

      {/* ── Search ────────────────────────────────────────────────────────── */}
      <div className="flex gap-3 flex-wrap">
        <input
          type="text"
          placeholder="Search by name or license…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="border border-gray-300 dark:border-gray-700 rounded-lg px-3 py-2 text-sm w-64 focus:outline-none focus:ring-2 focus:ring-brand-500 bg-white dark:bg-gray-900 text-gray-800 dark:text-gray-200"
        />
      </div>

      {/* ── Table ─────────────────────────────────────────────────────────── */}
      <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 dark:bg-gray-800/50 border-b border-gray-200 dark:border-gray-700 text-xs text-gray-500 dark:text-gray-400 uppercase">
            <tr>
              {['Name','ID Number','License Number','Phone','Status','Actions'].map(h => (
                <th key={h} className="px-4 py-3 text-left font-medium">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
            {loading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <tr key={i} className="animate-pulse">
                  {Array.from({ length: 6 }).map((_, j) => (
                    <td key={j} className="px-4 py-3">
                      <div className="h-4 bg-gray-100 dark:bg-gray-800 rounded w-24" />
                    </td>
                  ))}
                </tr>
              ))
            ) : drivers.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-10 text-center text-gray-400">
                  No drivers found
                </td>
              </tr>
            ) : drivers.map(d => (
              <tr key={d.driver_id} className="hover:bg-gray-50 dark:hover:bg-gray-800/40">
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
            ))}
          </tbody>
        </table>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="px-4 py-3 border-t border-gray-100 dark:border-gray-800 flex items-center justify-between text-sm text-gray-600 dark:text-gray-400">
            <span>Page {page} of {totalPages}</span>
            <div className="flex gap-2">
              <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
                className="px-3 py-1 rounded border border-gray-300 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800 disabled:opacity-40">
                Prev
              </button>
              <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}
                className="px-3 py-1 rounded border border-gray-300 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800 disabled:opacity-40">
                Next
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ── Delete modal ──────────────────────────────────────────────────── */}
      {delId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white dark:bg-gray-900 rounded-xl shadow-xl p-6 w-full max-w-sm mx-4 border border-gray-200 dark:border-gray-700">
            <h3 className="text-base font-semibold text-gray-900 dark:text-white mb-2">Delete Driver</h3>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-5">This action cannot be undone.</p>
            <div className="flex gap-3 justify-end">
              <button onClick={() => setDelId(null)}
                className="px-4 py-2 text-sm rounded-lg border border-gray-300 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800">
                Cancel
              </button>
              <button onClick={handleDelete} disabled={deleting}
                className="px-4 py-2 text-sm font-medium rounded-lg bg-red-600 text-white hover:bg-red-700 disabled:opacity-50">
                {deleting ? 'Deleting…' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Hidden printable section ─────────────────────────────────────────
          Rendered in the DOM but invisible on screen.
          The print CSS makes ONLY this visible when printing.
      ─────────────────────────────────────────────────────────────────────── */}
      <div id="driver-print-root" className="driver-print-hidden">
        <div style={{ fontFamily: 'Arial, sans-serif', fontSize: '10pt', color: '#000' }}>

          {/* ── Document header ───────────────────────────────────────────── */}
          <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '16px' }}>
            <tbody>
              <tr>
                <td style={{ verticalAlign: 'middle', paddingRight: '16px', width: '60px' }}>
                  {/* Logo placeholder — replace src with actual logo path if available */}
                  <div style={{
                    width: '52px', height: '52px', borderRadius: '8px',
                    background: '#1e3a5f', display: 'flex', alignItems: 'center',
                    justifyContent: 'center', color: '#fff', fontWeight: 'bold', fontSize: '14pt',
                  }}>
                    IC
                  </div>
                </td>
                <td style={{ verticalAlign: 'middle' }}>
                  <div style={{ fontSize: '14pt', fontWeight: 'bold', color: '#111' }}>{orgName}</div>
                  <div style={{ fontSize: '8pt', color: '#666', marginTop: '2px' }}>
                    ICDV Vehicle Import & Delivery Management System
                  </div>
                </td>
                <td style={{ verticalAlign: 'middle', textAlign: 'right' }}>
                  <div style={{ fontSize: '16pt', fontWeight: 'black', color: '#111', textTransform: 'uppercase', letterSpacing: '1px' }}>
                    DRIVER LIST
                  </div>
                  <div style={{ fontSize: '8pt', color: '#666', marginTop: '4px' }}>
                    Print Date: {printDate}
                  </div>
                  <div style={{ fontSize: '8pt', color: '#666' }}>
                    Generated By: {(user as any)?.full_name ?? (user as any)?.username ?? 'System'}
                  </div>
                  <div style={{ fontSize: '8pt', color: '#666' }}>
                    Total Drivers: {printDrivers.length}
                    {search ? ` (filtered: "${search}")` : ''}
                  </div>
                </td>
              </tr>
            </tbody>
          </table>

          {/* Separator */}
          <div style={{ borderTop: '2px solid #111', marginBottom: '12px' }} />

          {/* ── Driver table ──────────────────────────────────────────────── */}
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '9pt' }}>
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
                    No drivers to print
                  </td>
                </tr>
              ) : printDrivers.map((d, idx) => (
                <tr key={d.driver_id} style={{ background: idx % 2 === 0 ? '#fff' : '#f5f7fa' }}>
                  <td style={{ ...td, textAlign: 'center', color: '#888', width: '36px' }}>{idx + 1}</td>
                  <td style={{ ...td, fontFamily: 'Courier New, monospace', fontSize: '8.5pt' }}>
                    {(d as any).id_number ?? '—'}
                  </td>
                  <td style={{ ...td, fontWeight: '600' }}>{d.full_name}</td>
                  <td style={{ ...td, fontFamily: 'Courier New, monospace', fontSize: '8.5pt' }}>
                    {d.license_number}
                  </td>
                  <td style={td}>{d.phone ?? '—'}</td>
                  <td style={{ ...td, textAlign: 'center' }}>
                    <span style={{
                      display: 'inline-block',
                      padding: '1px 8px',
                      borderRadius: '10px',
                      fontSize: '8pt',
                      fontWeight: '600',
                      background: d.status === 'active' ? '#dcfce7' : '#fee2e2',
                      color:      d.status === 'active' ? '#166534' : '#991b1b',
                      border:     `1px solid ${d.status === 'active' ? '#86efac' : '#fca5a5'}`,
                    }}>
                      {d.status?.toUpperCase()}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>

            {/* Summary row */}
            {printDrivers.length > 0 && (
              <tfoot>
                <tr style={{ background: '#1e3a5f', color: '#fff', fontWeight: 'bold' }}>
                  <td colSpan={3} style={{ ...td, textAlign: 'right', fontSize: '8.5pt' }}>
                    TOTAL DRIVERS:
                  </td>
                  <td colSpan={1} style={{ ...td, fontSize: '8.5pt' }}>
                    {printDrivers.length}
                  </td>
                  <td style={{ ...td, fontSize: '8.5pt' }}>
                    Active: {printDrivers.filter(d => d.status === 'active').length}
                  </td>
                  <td style={{ ...td, fontSize: '8.5pt' }}>
                    Inactive: {printDrivers.filter(d => d.status !== 'active').length}
                  </td>
                </tr>
              </tfoot>
            )}
          </table>

          {/* ── Footer / signature section ─────────────────────────────────── */}
          <div style={{ marginTop: '48px' }}>
            <div style={{ borderTop: '1px solid #ccc', marginBottom: '24px' }} />
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <tbody>
                <tr>
                  <td style={{ width: '33%', paddingRight: '24px', verticalAlign: 'top' }}>
                    <div style={{ fontSize: '8.5pt', fontWeight: '600', color: '#374151', marginBottom: '6px' }}>
                      PREPARED BY:
                    </div>
                    <div style={{ borderBottom: '1px solid #9ca3af', height: '36px' }} />
                    <div style={{ fontSize: '8pt', color: '#6b7280', marginTop: '4px' }}>
                      Name &amp; Signature
                    </div>
                  </td>
                  <td style={{ width: '33%', paddingRight: '24px', verticalAlign: 'top' }}>
                    <div style={{ fontSize: '8.5pt', fontWeight: '600', color: '#374151', marginBottom: '6px' }}>
                      VERIFIED BY:
                    </div>
                    <div style={{ borderBottom: '1px solid #9ca3af', height: '36px' }} />
                    <div style={{ fontSize: '8pt', color: '#6b7280', marginTop: '4px' }}>
                      Name &amp; Signature
                    </div>
                  </td>
                  <td style={{ width: '33%', verticalAlign: 'top' }}>
                    <div style={{ fontSize: '8.5pt', fontWeight: '600', color: '#374151', marginBottom: '6px' }}>
                      APPROVED BY:
                    </div>
                    <div style={{ borderBottom: '1px solid #9ca3af', height: '36px' }} />
                    <div style={{ fontSize: '8pt', color: '#6b7280', marginTop: '4px' }}>
                      Name &amp; Signature
                    </div>
                  </td>
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

// ── Inline table cell styles (used in print DOM) ──────────────────────────────
const th: React.CSSProperties = {
  padding: '6px 10px',
  textAlign: 'left',
  fontSize: '8.5pt',
  fontWeight: 'bold',
  border: '1px solid #374151',
  whiteSpace: 'nowrap',
};

const td: React.CSSProperties = {
  padding: '5px 10px',
  border: '1px solid #d1d5db',
  verticalAlign: 'middle',
};
