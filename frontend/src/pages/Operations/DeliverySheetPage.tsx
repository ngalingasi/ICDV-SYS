/**
 * DeliverySheetPage.tsx
 *
 * Printable delivery sheet — two modes:
 *
 *  BATCH mode    /operations/batches/:batchId/delivery-sheet
 *    Single batch: batch-level header + one driver/chassis table.
 *
 *  MANIFEST mode /manifests/:manifestId/delivery-sheet
 *    Full manifest: manifest-level cover header + one batch section
 *    per batch (each with its own sub-header + driver/chassis table).
 *    Batches remain visually separated — NOT merged into one flat table.
 *
 * Query params:
 *   ?printed_by=Name   shown in header
 *   ?print=1           auto-triggers window.print() after load
 */

import { useEffect, useRef, useState } from 'react';
import { useParams, useSearchParams } from 'react-router';
import { workflowApi, manifestsApi } from '../../api';

// ─── Types ────────────────────────────────────────────────────────────────────

interface DriverRow {
  driver_id:       number;
  id_number:       string;
  license_number:  string | null;
  full_name:       string;
  phone:           string | null;
  chassis_numbers: string[];
}

interface BatchSection {
  batch_id:      number;
  batch_number:  string;
  batch_date:    string;
  status:        string;
  vehicle_count: number;
  drivers:       DriverRow[];
  max_vehicles:  number;
}

interface SingleBatchData {
  batch:        BatchSection & { vessel_name: string; icdv_name: string; icdv_code?: string };
  drivers:      DriverRow[];
  max_vehicles: number;
}

interface ManifestData {
  manifest: {
    manifest_id:     number;
    manifest_number: string;
    arrival_date:    string;
    status:          string;
    vessel_name:     string;
    icdv_name:       string;
    icdv_code?:      string;
    total_vehicles:  number;
    total_batches:   number;
  };
  batches: BatchSection[];
}

// ─── Shared: driver/chassis table ────────────────────────────────────────────

function DriverTable({ drivers }: { drivers: DriverRow[] }) {
  if (drivers.length === 0) {
    return <p className="no-records">No transfer records found for this batch.</p>;
  }

  return (
    <table className="delivery-table">
      <thead>
        <tr>
          <th className="col-id">ID Number</th>
          <th className="col-license">License No.</th>
          <th className="col-name">Driver Name</th>
          <th className="col-phone">Mobile Number</th>
          <th className="col-chassis">Chassis Numbers</th>
          <th className="col-total">Total</th>
        </tr>
      </thead>
      <tbody>
        {drivers.map((driver, rowIdx) => (
          <tr key={driver.driver_id} className={rowIdx % 2 === 0 ? 'row-even' : 'row-odd'}>
            <td className="col-id mono">{driver.id_number || '—'}</td>
            <td className="col-license mono">{driver.license_number || '—'}</td>
            <td className="col-name">{driver.full_name}</td>
            <td className="col-phone mono">{driver.phone || '—'}</td>
            <td className="col-chassis mono">{driver.chassis_numbers.join(', ') || '—'}</td>
            <td className="col-total">{driver.chassis_numbers.length}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

// ─── Shared: signature footer ─────────────────────────────────────────────────

function SignatureFooter() {
  return (
    <div className="sheet-footer">
      {['Prepared By', 'Verified By', 'Authorised By'].map(label => (
        <div key={label} className="signature-block">
          <div className="signature-line" />
          <p>{label}</p>
        </div>
      ))}
    </div>
  );
}

// ─── BATCH MODE ───────────────────────────────────────────────────────────────

function BatchModeSheet({ data, generatedDate, printedBy }: {
  data: SingleBatchData; generatedDate: string; printedBy: string;
}) {
  const { batch, drivers, max_vehicles } = data;
  return (
    <div className="delivery-sheet-section">
      <div className="sheet-header">
        <div className="sheet-header-top">
          <h1 className="sheet-title">VEHICLE DELIVERY SHEET</h1>
          <div className="sheet-logo-placeholder">ICDV</div>
        </div>
        <div className="sheet-meta-grid">
          {([
            ['ICDV Name',      batch.icdv_name  || '—', false],
            ['Batch Number',   batch.batch_number,       true],
            ['Vessel Name',    batch.vessel_name || '—', false],
            ['Batch Date',     batch.batch_date  || '—', false],
            ['Generated',      generatedDate,             false],
            ['Printed By',     printedBy        || '—', false],
            ['Total Vehicles', String(batch.vehicle_count), false],
            ['Status',         (batch.status || '').toUpperCase(), false],
          ] as [string, string, boolean][]).map(([label, value, mono]) => (
            <div key={label} className="sheet-meta-item">
              <span className="meta-label">{label}</span>
              <span className={`meta-value${mono ? ' mono' : ''}`}>{value}</span>
            </div>
          ))}
        </div>
      </div>
      <DriverTable drivers={drivers} />
      <SignatureFooter />
    </div>
  );
}

// ─── MANIFEST MODE ────────────────────────────────────────────────────────────

function ManifestModeSheet({ data, generatedDate, printedBy }: {
  data: ManifestData; generatedDate: string; printedBy: string;
}) {
  const { manifest, batches } = data;
  const fmtDate = (d?: string) =>
    d ? new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';

  return (
    <>
      {/* ── Manifest cover ──────────────────────────────────────────────────── */}
      <div className="manifest-cover">
        <div className="sheet-header-top">
          <h1 className="sheet-title">VEHICLE DELIVERY SHEET</h1>
          <div className="sheet-logo-placeholder">ICDV</div>
        </div>
        <div className="manifest-banner">
          <span className="manifest-label">MANIFEST</span>
          <span className="manifest-number mono">{manifest.manifest_number}</span>
        </div>
        <div className="sheet-meta-grid">
          {([
            ['ICDV Name',      manifest.icdv_name  || '—',              false],
            ['Manifest No.',   manifest.manifest_number,                 true],
            ['Vessel Name',    manifest.vessel_name || '—',              false],
            ['Arrival Date',   fmtDate(manifest.arrival_date),           false],
            ['Generated',      generatedDate,                            false],
            ['Printed By',     printedBy || '—',                        false],
            ['Total Vehicles', String(manifest.total_vehicles ?? '—'),  false],
            ['Total Batches',  String(manifest.total_batches),           false],
          ] as [string, string, boolean][]).map(([label, value, mono]) => (
            <div key={label} className="sheet-meta-item">
              <span className="meta-label">{label}</span>
              <span className={`meta-value${mono ? ' mono' : ''}`}>{value}</span>
            </div>
          ))}
        </div>
      </div>

      {/* ── Batch sections ──────────────────────────────────────────────────── */}
      {batches.length === 0 ? (
        <div style={{ padding: '24px', textAlign: 'center', color: '#888', fontSize: '12px' }}>
          No batch transfer records found for this manifest yet.
        </div>
      ) : (
        batches.map((batch, idx) => (
          <div key={batch.batch_id} className="batch-section">

            {/* Batch sub-header */}
            <div className="batch-header">
              <div className="batch-header-left">
                <span className="batch-seq">Batch {idx + 1} of {batches.length}</span>
                <span className="batch-number mono">{batch.batch_number}</span>
              </div>
              <div className="batch-header-right">
                <span className="batch-stat">{batch.vehicle_count} vehicle{batch.vehicle_count !== 1 ? 's' : ''}</span>
                <span className={`batch-status-badge status-${batch.status}`}>
                  {(batch.status || '').toUpperCase()}
                </span>
              </div>
            </div>

            <DriverTable drivers={batch.drivers} />

            {idx < batches.length - 1 && <div className="batch-divider" />}
          </div>
        ))
      )}

      <SignatureFooter />
    </>
  );
}

// ─── Page shell ───────────────────────────────────────────────────────────────

export default function DeliverySheetPage() {
  const { batchId, manifestId } = useParams<{ batchId?: string; manifestId?: string }>();
  const [sp] = useSearchParams();

  const [batchData,    setBatchData]    = useState<SingleBatchData | null>(null);
  const [manifestData, setManifestData] = useState<ManifestData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState('');

  const printedBy     = sp.get('printed_by') || 'Operator';
  const generatedDate = new Date().toLocaleString('en-GB', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });

  const isManifestMode = Boolean(manifestId);

  useEffect(() => {
    (async () => {
      try {
        if (manifestId) {
          const r = await manifestsApi.deliverySheet(Number(manifestId));
          setManifestData(r.data as ManifestData);
        } else if (batchId) {
          const r = await workflowApi.getBatchDeliverySheet(Number(batchId));
          setBatchData(r.data as SingleBatchData);
        }
      } catch (e: any) {
        setError(e?.response?.data?.message ?? 'Failed to load delivery sheet');
      } finally {
        setLoading(false);
      }
    })();
  }, [batchId, manifestId]);

  const didPrint = useRef(false);
  const hasData  = Boolean(batchData || manifestData);
  useEffect(() => {
    if (!loading && !error && hasData && sp.get('print') === '1' && !didPrint.current) {
      didPrint.current = true;
      setTimeout(() => window.print(), 400);
    }
  }, [loading, error, hasData, sp]);

  const toolbarTitle = isManifestMode ? 'Manifest Delivery Sheet' : 'Batch Delivery Sheet';
  const toolbarSub = isManifestMode && manifestData
    ? `${manifestData.manifest.icdv_name} · ${manifestData.manifest.vessel_name} · ${manifestData.manifest.manifest_number} · ${manifestData.manifest.total_batches} batch${manifestData.manifest.total_batches !== 1 ? 'es' : ''}`
    : batchData
    ? `${batchData.batch.icdv_name} · ${batchData.batch.vessel_name} · ${batchData.batch.batch_number}`
    : '';

  if (loading) return (
    <div className="sheet-loading">
      <div className="loading-spinner" />
      <p>Generating delivery sheet…</p>
    </div>
  );
  if (error) return <div className="sheet-error">⚠ {error}</div>;

  return (
    <>
      <div className="print-toolbar no-print">
        <div className="toolbar-info">
          <span className="toolbar-title">{toolbarTitle}</span>
          {toolbarSub && <span className="toolbar-sub">{toolbarSub}</span>}
        </div>
        <button className="print-button" onClick={() => window.print()}>
          🖨 Print / Save PDF
        </button>
      </div>

      <div className="delivery-sheet-root">
        {isManifestMode && manifestData && (
          <ManifestModeSheet data={manifestData} generatedDate={generatedDate} printedBy={printedBy} />
        )}
        {!isManifestMode && batchData && (
          <BatchModeSheet data={batchData} generatedDate={generatedDate} printedBy={printedBy} />
        )}
      </div>

      <style>{`
        .delivery-sheet-root {
          background:#fff; font-family:Arial,sans-serif; font-size:11px;
          color:#000; max-width:1280px; margin:0 auto; padding:8px;
        }

        /* ── Manifest cover ───────────────────────────── */
        .manifest-cover { margin-bottom:0; }
        .manifest-banner {
          display:flex; align-items:center; gap:12px;
          background:#0f2d52; color:#fff; padding:8px 14px;
          border-left:4px solid #f59e0b;
        }
        .manifest-label { font-size:9px; font-weight:700; letter-spacing:2px; opacity:.7; text-transform:uppercase; }
        .manifest-number { font-size:16px; font-weight:900; letter-spacing:1px; }

        /* ── Batch section ────────────────────────────── */
        .batch-section { margin-top:0; }
        .batch-header {
          display:flex; align-items:center; justify-content:space-between;
          background:#e8f0fe; border:1px solid #1a3a5c; border-top:3px solid #1a3a5c;
          padding:6px 12px; margin-top:18px;
          -webkit-print-color-adjust:exact; print-color-adjust:exact;
        }
        .batch-header-left  { display:flex; align-items:center; gap:12px; }
        .batch-header-right { display:flex; align-items:center; gap:10px; }
        .batch-seq    { font-size:9px; font-weight:700; text-transform:uppercase; letter-spacing:1px; color:#555; }
        .batch-number { font-size:13px; font-weight:900; color:#1a3a5c; }
        .batch-stat   { font-size:10px; color:#666; font-weight:600; }
        .batch-status-badge {
          font-size:8px; font-weight:700; letter-spacing:.5px;
          padding:2px 7px; border-radius:9999px; text-transform:uppercase;
          -webkit-print-color-adjust:exact; print-color-adjust:exact;
        }
        .status-open        { background:#dbeafe; color:#1d4ed8; }
        .status-full        { background:#ffedd5; color:#c2410c; }
        .status-closed      { background:#f3f4f6; color:#374151; }
        .status-transferred { background:#dcfce7; color:#15803d; }
        .batch-divider { border-top:2px dashed #cbd5e1; margin:20px 0; }

        /* ── Shared header ────────────────────────────── */
        .sheet-header { border:2px solid #1a1a1a; margin-bottom:0; }
        .sheet-header-top {
          display:flex; justify-content:space-between; align-items:center;
          padding:10px 14px; border-bottom:1px solid #1a1a1a;
          background:#1a3a5c; color:#fff;
          -webkit-print-color-adjust:exact; print-color-adjust:exact;
        }
        .sheet-title { font-size:15px; font-weight:700; letter-spacing:1px; margin:0; }
        .sheet-logo-placeholder { font-size:18px; font-weight:900; letter-spacing:2px; }
        .sheet-meta-grid { display:grid; grid-template-columns:repeat(4,1fr); }
        .sheet-meta-item {
          padding:6px 12px; border-right:1px solid #ccc; border-bottom:1px solid #ccc;
          display:flex; flex-direction:column; gap:1px;
        }
        .sheet-meta-item:nth-child(4n) { border-right:none; }
        .meta-label { font-size:8px; font-weight:700; text-transform:uppercase; color:#666; letter-spacing:.5px; }
        .meta-value { font-size:11px; font-weight:600; color:#111; }
        .meta-value.mono,.mono { font-family:'Courier New',monospace; }

        /* ── Driver table ─────────────────────────────── */
        .delivery-table {
          width:100%; border-collapse:collapse;
          border:2px solid #1a1a1a; border-top:none; table-layout:auto;
        }
        .delivery-table thead tr {
          background:#1a3a5c; color:#fff;
          -webkit-print-color-adjust:exact; print-color-adjust:exact;
        }
        .delivery-table th {
          padding:7px 8px; text-align:left; font-size:9px; font-weight:700;
          text-transform:uppercase; letter-spacing:.5px;
          border-right:1px solid rgba(255,255,255,.25); white-space:nowrap;
        }
        .delivery-table th:last-child { border-right:none; }
        .delivery-table td {
          padding:6px 8px; border-bottom:1px solid #ddd; border-right:1px solid #ddd;
          vertical-align:middle; font-size:10.5px;
        }
        .delivery-table td:last-child { border-right:none; }
        .row-even { background:#fff; }
        .row-odd  { background:#f5f8fc; -webkit-print-color-adjust:exact; print-color-adjust:exact; }
        .col-id      { width:100px; min-width:90px; }
        .col-license { width:110px; min-width:100px; }
        .col-name    { width:160px; min-width:140px; font-weight:600; }
        .col-phone   { width:110px; min-width:100px; }
        .col-chassis {
          font-family:'Courier New',monospace; font-size:10px;
          letter-spacing:.2px; word-break:break-all; color:#111;
        }
        /* chassis header cell must be white like other headers */
        .delivery-table thead .col-chassis { color:#fff; }
        .col-total {
          width:52px; min-width:48px; text-align:center;
          font-weight:700; font-size:11px; color:#1a3a5c;
        }

        /* ── Footer ───────────────────────────────────── */
        .sheet-footer {
          display:flex; justify-content:space-around;
          padding:18px 20px 10px; border:2px solid #1a1a1a; border-top:1px solid #ccc; gap:20px;
        }
        .signature-block { flex:1; text-align:center; }
        .signature-line  { border-bottom:1px solid #333; margin-bottom:6px; height:32px; }
        .signature-block p { font-size:9px; text-transform:uppercase; color:#555; letter-spacing:.5px; margin:0; }

        /* ── Misc ─────────────────────────────────────── */
        .no-records { padding:16px 12px; font-size:11px; color:#888; border:2px solid #1a1a1a; border-top:none; }
        .delivery-sheet-section { margin-bottom:40px; }

        /* ── Screen toolbar ───────────────────────────── */
        .print-toolbar {
          display:flex; align-items:center; justify-content:space-between;
          background:#1a3a5c; color:#fff; padding:10px 20px;
          margin-bottom:16px; border-radius:8px; gap:12px; flex-wrap:wrap;
        }
        .toolbar-info  { display:flex; flex-direction:column; gap:2px; }
        .toolbar-title { font-weight:700; font-size:14px; }
        .toolbar-sub   { font-size:12px; opacity:.75; }
        .print-button {
          background:#fff; color:#1a3a5c; border:none;
          padding:8px 18px; border-radius:6px; font-weight:700; font-size:13px;
          cursor:pointer; white-space:nowrap;
        }
        .print-button:hover { background:#e8f0fe; }

        /* ── Loading/error ────────────────────────────── */
        .sheet-loading {
          display:flex; flex-direction:column; align-items:center;
          justify-content:center; height:200px; gap:12px; color:#666;
        }
        .loading-spinner {
          width:32px; height:32px; border:3px solid #e2e8f0;
          border-top-color:#1a3a5c; border-radius:50%;
          animation:spin .8s linear infinite;
        }
        @keyframes spin { to { transform:rotate(360deg); } }
        .sheet-error {
          padding:20px; color:#dc2626; background:#fef2f2;
          border:1px solid #fecaca; border-radius:8px; margin:20px;
        }

        /* ── Print ────────────────────────────────────── */
        @media print {
          @page { size:A4 landscape; margin:10mm 8mm; }
          body { background:#fff !important; }
          .no-print { display:none !important; }
          .delivery-sheet-root { padding:0; max-width:none; }

          /* Manifest: each batch starts on new page */
          .batch-section { page-break-before:always; }
          .batch-section:first-child { page-break-before:avoid; }
          .batch-divider { display:none; }
          .manifest-cover { page-break-after:always; }

          .delivery-table th, .delivery-table td { font-size:9.5px; padding:5px 6px; }
          .sheet-title { font-size:13px; }
          .meta-value  { font-size:10px; }
        }
      `}</style>
    </>
  );
}
