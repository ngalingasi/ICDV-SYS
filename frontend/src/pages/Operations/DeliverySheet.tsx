import { useEffect, useRef, useState } from 'react';
import { useParams, Link } from 'react-router';
import { workflowApi } from '../../api';

/* ─── Types ─────────────────────────────────────────────────────────────────── */
interface DriverRow {
  driver_id:      number;
  driver_id_card: string;
  full_name:      string;
  phone:          string;
  chassis:        string[];
}

interface SheetData {
  batch: {
    batch_id:     number;
    batch_number: string;
    batch_date:   string;
    vehicle_count:number;
    status:       string;
    vessel_name:  string;
    imo_number:   string;
    icdv_name:    string;
    icdv_code:    string;
  };
  drivers:      DriverRow[];
  max_vehicles: number;
  generated_at: string;
}

/* ─── Print styles injected into <head> ────────────────────────────────────── */
const PRINT_CSS = `
  @media print {
    body * { visibility: hidden !important; }
    #delivery-sheet-root, #delivery-sheet-root * { visibility: visible !important; }
    #delivery-sheet-root { position: fixed; inset: 0; overflow: visible; }
    #no-print { display: none !important; }
    @page { size: A4 landscape; margin: 12mm; }
    table { page-break-inside: auto; }
    tr { page-break-inside: avoid; }
  }
`;

export default function DeliverySheet() {
  const { batchId } = useParams<{ batchId: string }>();
  const [data,    setData]    = useState<SheetData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState('');
  const styleRef = useRef<HTMLStyleElement | null>(null);

  useEffect(() => {
    if (!batchId) return;
    workflowApi.getDeliverySheet(Number(batchId))
      .then(r => setData(r.data))
      .catch(() => setError('Failed to load delivery sheet'))
      .finally(() => setLoading(false));
  }, [batchId]);

  // Inject print CSS on mount, remove on unmount
  useEffect(() => {
    const style = document.createElement('style');
    style.innerHTML = PRINT_CSS;
    document.head.appendChild(style);
    styleRef.current = style;
    return () => { style.remove(); };
  }, []);

  const handlePrint = () => window.print();

  const fmtDate = (d?: string) =>
    d ? new Date(d).toLocaleDateString('en-GB', { day:'2-digit', month:'short', year:'numeric' }) : '—';

  const fmtDateTime = (d?: string) =>
    d ? new Date(d).toLocaleString('en-GB', { day:'2-digit', month:'short', year:'numeric', hour:'2-digit', minute:'2-digit' }) : '—';

  /* ── Loading / error states ─────────────────────────────────────────────── */
  if (loading) return (
    <div className="p-8 text-center text-gray-500 animate-pulse">Loading delivery sheet…</div>
  );
  if (error || !data) return (
    <div className="p-8 text-center text-red-500">{error || 'No data'}</div>
  );

  const { batch, drivers, max_vehicles } = data;
  const colCount = Math.max(max_vehicles, 1);

  /* ── Render ─────────────────────────────────────────────────────────────── */
  return (
    <div className="min-h-screen bg-gray-100 dark:bg-gray-900 p-4 sm:p-6">

      {/* Screen-only action bar */}
      <div id="no-print" className="max-w-7xl mx-auto mb-4 flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <Link to={`/operations/batches/${batchId}`}
            className="flex items-center gap-1.5 text-sm text-brand-500 hover:text-brand-600 font-medium">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
            Back to Batch
          </Link>
          <span className="text-gray-300 dark:text-gray-600">|</span>
          <span className="text-sm font-semibold text-gray-700 dark:text-gray-300">
            Delivery Sheet — {batch.batch_number}
          </span>
        </div>
        <button onClick={handlePrint}
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-brand-500 hover:bg-brand-600 text-white text-sm font-medium transition-colors shadow-sm">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round"
              d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
          </svg>
          Print / Save PDF
        </button>
      </div>

      {/* ── The printable sheet ─────────────────────────────────────────── */}
      <div id="delivery-sheet-root"
        className="max-w-7xl mx-auto bg-white shadow-lg rounded-xl overflow-hidden print:shadow-none print:rounded-none">

        {/* ── Document header ──────────────────────────────────────────── */}
        <div className="px-8 pt-8 pb-4 border-b-2 border-gray-900">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-4">
              {/* Logo */}
              <img
                src="/images/logo/logo.png"
                alt="Logo"
                className="h-14 w-14 object-contain rounded-lg flex-shrink-0"
                onError={e => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }}
              />
              <div>
                <h1 className="text-2xl font-black text-gray-900 uppercase tracking-wide">
                  DELIVERY SHEET
                </h1>
                <p className="text-base font-bold text-gray-700 mt-0.5">{batch.icdv_name ?? '—'}</p>
                {batch.icdv_code && (
                  <p className="text-xs text-gray-500 font-medium">{batch.icdv_code}</p>
                )}
              </div>
            </div>
            <div className="text-right space-y-0.5">
              <p className="text-xs text-gray-500 uppercase tracking-wide font-medium">Batch Number</p>
              <p className="text-xl font-black text-gray-900 font-mono">{batch.batch_number}</p>
            </div>
          </div>

          {/* Meta row */}
          <div className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
            <MetaField label="Vessel"       value={batch.vessel_name ?? '—'} />
            <MetaField label="IMO Number"   value={batch.imo_number  ?? '—'} />
            <MetaField label="Batch Date"   value={fmtDate(batch.batch_date)} />
            <MetaField label="Generated"    value={fmtDateTime(data.generated_at)} />
            <MetaField label="Total Vehicles" value={String(batch.vehicle_count)} />
            <MetaField label="Total Drivers"  value={String(drivers.length)} />
            <MetaField label="Batch Status"   value={batch.status?.toUpperCase()} />
          </div>
        </div>

        {/* ── Driver / Chassis table ────────────────────────────────────── */}
        {drivers.length === 0 ? (
          <div className="px-8 py-16 text-center text-gray-400">
            <p className="text-lg font-medium">No transfers recorded for this batch yet.</p>
            <p className="text-sm mt-1">Complete the TPA Gate Transfer step to see drivers here.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-sm"
              style={{ fontFamily: 'Arial, sans-serif' }}>
              <thead>
                <tr className="bg-gray-900 text-white">
                  <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wider border border-gray-700 whitespace-nowrap w-32">
                    ID Number
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wider border border-gray-700 whitespace-nowrap min-w-[160px]">
                    Driver Name
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wider border border-gray-700 whitespace-nowrap w-36">
                    Mobile
                  </th>
                  {Array.from({ length: colCount }).map((_, i) => (
                    <th key={i}
                      className="px-3 py-3 text-center text-xs font-bold uppercase tracking-wider border border-gray-700 whitespace-nowrap min-w-[100px]">
                      Vehicle {i + 1}
                    </th>
                  ))}
                  {/* Signature column */}
                  <th className="px-4 py-3 text-center text-xs font-bold uppercase tracking-wider border border-gray-700 whitespace-nowrap min-w-[120px]">
                    Signature
                  </th>
                </tr>
              </thead>
              <tbody>
                {drivers.map((dr, rowIdx) => (
                  <tr key={dr.driver_id}
                    className={rowIdx % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                    {/* ID Number */}
                    <td className="px-4 py-3 font-mono font-semibold text-gray-900 border border-gray-300 text-xs">
                      {dr.driver_id_card}
                    </td>
                    {/* Driver Name */}
                    <td className="px-4 py-3 font-semibold text-gray-900 border border-gray-300">
                      {dr.full_name}
                    </td>
                    {/* Mobile */}
                    <td className="px-4 py-3 text-gray-700 border border-gray-300 text-xs">
                      {dr.phone}
                    </td>
                    {/* Chassis columns — one per max_vehicles slot */}
                    {Array.from({ length: colCount }).map((_, i) => (
                      <td key={i}
                        className="px-3 py-3 text-center border border-gray-300">
                        {dr.chassis[i] ? (
                          <span className="font-mono font-bold text-gray-900 text-xs bg-gray-100 px-1.5 py-0.5 rounded">
                            {dr.chassis[i]}
                          </span>
                        ) : (
                          <span className="text-gray-300">—</span>
                        )}
                      </td>
                    ))}
                    {/* Signature box */}
                    <td className="px-4 py-3 border border-gray-300">
                      {/* intentionally blank for hand-signing */}
                    </td>
                  </tr>
                ))}

                {/* Totals row */}
                <tr className="bg-gray-900 text-white font-bold">
                  <td colSpan={3} className="px-4 py-3 text-right text-xs uppercase tracking-wide border border-gray-700">
                    TOTAL DRIVERS: {drivers.length}
                  </td>
                  {Array.from({ length: colCount }).map((_, i) => {
                    const count = drivers.filter(d => d.chassis[i]).length;
                    return (
                      <td key={i} className="px-3 py-3 text-center text-xs border border-gray-700">
                        {count > 0 ? count : ''}
                      </td>
                    );
                  })}
                  <td className="px-4 py-3 text-center text-xs border border-gray-700">
                    TOTAL: {batch.vehicle_count}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        )}

        {/* ── Footer ───────────────────────────────────────────────────── */}
        <div className="px-8 py-5 border-t border-gray-200 mt-4">
          <div className="grid grid-cols-3 gap-8 text-xs text-gray-500">
            <div>
              <p className="font-semibold text-gray-700 mb-1">Prepared by:</p>
              <div className="border-b border-gray-400 h-8" />
              <p className="mt-1">Name &amp; Signature</p>
            </div>
            <div>
              <p className="font-semibold text-gray-700 mb-1">Verified by:</p>
              <div className="border-b border-gray-400 h-8" />
              <p className="mt-1">Name &amp; Signature</p>
            </div>
            <div>
              <p className="font-semibold text-gray-700 mb-1">Approved by:</p>
              <div className="border-b border-gray-400 h-8" />
              <p className="mt-1">Name &amp; Signature</p>
            </div>
          </div>
          <p className="text-center text-[10px] text-gray-400 mt-6">
            {batch.icdv_name} · Batch {batch.batch_number} · Generated {fmtDateTime(data.generated_at)} · ICDV Vehicle Import & Delivery Management System
          </p>
        </div>
      </div>
    </div>
  );
}

function MetaField({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[10px] text-gray-400 uppercase tracking-wide font-medium">{label}</p>
      <p className="text-sm font-semibold text-gray-800">{value}</p>
    </div>
  );
}
