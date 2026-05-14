/**
 * DeliverySheet.tsx
 *
 * Printable delivery sheet — one section per batch.
 * Columns: ID Number | Driver Name | Mobile Number | Vehicle 1 | Vehicle 2 | …
 * Each vehicle column contains an actual chassis number from transfer records.
 *
 * Usage:
 *   /operations/batches/:batchId/delivery-sheet   → single batch
 *   /operations/vessels/:vesselId/delivery-sheet  → all batches for vessel
 */

import { useEffect, useRef, useState } from 'react';
import { useParams, useSearchParams } from 'react-router';
import { workflowApi } from '../../api';

// ─── Types ────────────────────────────────────────────────────────────────────

interface BatchInfo {
  batch_id:      number;
  batch_number:  string;
  batch_date:    string;
  status:        string;
  vehicle_count: number;
  vessel_name:   string;
  icdv_name:     string;
  icdv_code?:    string;
}

interface DriverRow {
  driver_id:       number;
  id_number:       string;
  full_name:       string;
  phone:           string | null;
  chassis_numbers: string[];
}

interface SheetSection {
  batch:        BatchInfo;
  drivers:      DriverRow[];
  max_vehicles: number;
}

// ─── Single batch section ─────────────────────────────────────────────────────

function BatchSection({ section, generatedDate, printedBy }: {
  section:      SheetSection;
  generatedDate: string;
  printedBy:    string;
}) {
  const { batch, drivers, max_vehicles } = section;

  // Build dynamic vehicle column headers: Vehicle 1, Vehicle 2, …
  const vehicleCols = Array.from({ length: max_vehicles }, (_, i) => `Vehicle ${i + 1}`);

  return (
    <div className="delivery-sheet-section">
      {/* ── Header ──────────────────────────────────────────────────────────── */}
      <div className="sheet-header">
        <div className="sheet-header-top">
          <h1 className="sheet-title">VEHICLE DELIVERY SHEET</h1>
          <div className="sheet-logo-placeholder">ICDV</div>
        </div>

        <div className="sheet-meta-grid">
          <div className="sheet-meta-item">
            <span className="meta-label">ICDV Name</span>
            <span className="meta-value">{batch.icdv_name || '—'}</span>
          </div>
          <div className="sheet-meta-item">
            <span className="meta-label">Batch Number</span>
            <span className="meta-value mono">{batch.batch_number}</span>
          </div>
          <div className="sheet-meta-item">
            <span className="meta-label">Vessel Name</span>
            <span className="meta-value">{batch.vessel_name || '—'}</span>
          </div>
          <div className="sheet-meta-item">
            <span className="meta-label">Batch Date</span>
            <span className="meta-value">{batch.batch_date || '—'}</span>
          </div>
          <div className="sheet-meta-item">
            <span className="meta-label">Generated</span>
            <span className="meta-value">{generatedDate}</span>
          </div>
          <div className="sheet-meta-item">
            <span className="meta-label">Printed By</span>
            <span className="meta-value">{printedBy || '—'}</span>
          </div>
          <div className="sheet-meta-item">
            <span className="meta-label">Total Drivers</span>
            <span className="meta-value">{drivers.length}</span>
          </div>
          <div className="sheet-meta-item">
            <span className="meta-label">Total Vehicles</span>
            <span className="meta-value">{batch.vehicle_count}</span>
          </div>
        </div>
      </div>

      {/* ── Table ────────────────────────────────────────────────────────────── */}
      {drivers.length === 0 ? (
        <div className="no-drivers">No transfer records found for this batch.</div>
      ) : (
        <table className="delivery-table">
          <thead>
            <tr>
              <th className="col-id">ID Number</th>
              <th className="col-name">Driver Name</th>
              <th className="col-phone">Mobile Number</th>
              {vehicleCols.map((label, i) => (
                <th key={i} className="col-vehicle">{label}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {drivers.map((driver, rowIdx) => (
              <tr key={driver.driver_id} className={rowIdx % 2 === 0 ? 'row-even' : 'row-odd'}>
                <td className="col-id mono">{driver.id_number || '—'}</td>
                <td className="col-name">{driver.full_name}</td>
                <td className="col-phone mono">{driver.phone || '—'}</td>
                {vehicleCols.map((_, i) => (
                  <td key={i} className="col-vehicle mono">
                    {driver.chassis_numbers[i] || ''}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {/* ── Footer / Signature ───────────────────────────────────────────────── */}
      <div className="sheet-footer">
        <div className="signature-block">
          <div className="signature-line" />
          <p>Prepared By</p>
        </div>
        <div className="signature-block">
          <div className="signature-line" />
          <p>Verified By</p>
        </div>
        <div className="signature-block">
          <div className="signature-line" />
          <p>Authorised By</p>
        </div>
      </div>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function DeliverySheetPage() {
  const { batchId, vesselId } = useParams<{ batchId?: string; vesselId?: string }>();
  const [sp] = useSearchParams();

  const [sections, setSections] = useState<SheetSection[]>([]);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState('');
  const printedBy = sp.get('printed_by') || 'Operator';

  const generatedDate = new Date().toLocaleDateString('en-GB', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });

  useEffect(() => {
    const load = async () => {
      try {
        if (batchId) {
          const r = await workflowApi.getBatchDeliverySheet(Number(batchId));
          setSections([r.data as SheetSection]);
        } else if (vesselId) {
          const r = await workflowApi.getVesselDeliverySheet(Number(vesselId));
          setSections(r.data as SheetSection[]);
        }
      } catch (e: any) {
        setError(e?.response?.data?.message ?? 'Failed to load delivery sheet');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [batchId, vesselId]);

  // Auto-print when data is ready if ?print=1
  const didPrint = useRef(false);
  useEffect(() => {
    if (!loading && !error && sections.length && sp.get('print') === '1' && !didPrint.current) {
      didPrint.current = true;
      setTimeout(() => window.print(), 400);
    }
  }, [loading, error, sections, sp]);

  if (loading) {
    return (
      <div className="sheet-loading">
        <div className="loading-spinner" />
        <p>Generating delivery sheet…</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="sheet-error">
        <p>⚠ {error}</p>
      </div>
    );
  }

  return (
    <>
      {/* ── Screen-only toolbar ─────────────────────────────────────────────── */}
      <div className="print-toolbar no-print">
        <div className="toolbar-info">
          <span className="toolbar-title">
            {batchId ? `Batch Delivery Sheet` : `Vessel Delivery Sheet`}
          </span>
          {sections[0] && (
            <span className="toolbar-sub">
              {sections[0].batch.icdv_name} · {sections[0].batch.vessel_name}
              {sections.length > 1 && ` · ${sections.length} batches`}
            </span>
          )}
        </div>
        <button
          className="print-button"
          onClick={() => window.print()}
        >
          🖨 Print / Save PDF
        </button>
      </div>

      {/* ── Printable content ───────────────────────────────────────────────── */}
      <div className="delivery-sheet-root">
        {sections.map((section, i) => (
          <BatchSection
            key={section.batch.batch_id}
            section={section}
            generatedDate={generatedDate}
            printedBy={printedBy}
          />
        ))}
      </div>

      {/* ── Scoped print styles ─────────────────────────────────────────────── */}
      <style>{`
        /* ── Root ──────────────────────────────────────────────────────── */
        .delivery-sheet-root {
          background: #fff;
          font-family: 'Arial', sans-serif;
          font-size: 11px;
          color: #000;
          max-width: 1200px;
          margin: 0 auto;
          padding: 8px;
        }

        .delivery-sheet-section {
          margin-bottom: 40px;
          page-break-after: always;
        }
        .delivery-sheet-section:last-child {
          page-break-after: avoid;
          margin-bottom: 0;
        }

        /* ── Header ────────────────────────────────────────────────────── */
        .sheet-header {
          border: 2px solid #1a1a1a;
          margin-bottom: 0;
        }
        .sheet-header-top {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 10px 14px;
          border-bottom: 1px solid #1a1a1a;
          background: #1a3a5c;
          color: #fff;
        }
        .sheet-title {
          font-size: 15px;
          font-weight: 700;
          letter-spacing: 1px;
          margin: 0;
        }
        .sheet-logo-placeholder {
          font-size: 18px;
          font-weight: 900;
          letter-spacing: 2px;
          opacity: 0.9;
        }

        .sheet-meta-grid {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          border-bottom: none;
        }
        .sheet-meta-item {
          padding: 6px 12px;
          border-right: 1px solid #ccc;
          border-bottom: 1px solid #ccc;
          display: flex;
          flex-direction: column;
          gap: 1px;
        }
        .sheet-meta-item:nth-child(4n) {
          border-right: none;
        }
        .meta-label {
          font-size: 8px;
          font-weight: 700;
          text-transform: uppercase;
          color: #666;
          letter-spacing: 0.5px;
        }
        .meta-value {
          font-size: 11px;
          font-weight: 600;
          color: #111;
        }
        .meta-value.mono {
          font-family: 'Courier New', monospace;
        }

        /* ── Table ─────────────────────────────────────────────────────── */
        .delivery-table {
          width: 100%;
          border-collapse: collapse;
          border: 2px solid #1a1a1a;
          border-top: none;
          table-layout: auto;
        }
        .delivery-table thead tr {
          background: #1a3a5c;
          color: #fff;
        }
        .delivery-table th {
          padding: 7px 8px;
          text-align: left;
          font-size: 9px;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.5px;
          border-right: 1px solid rgba(255,255,255,0.3);
          white-space: nowrap;
        }
        .delivery-table th:last-child { border-right: none; }

        .delivery-table td {
          padding: 6px 8px;
          border-bottom: 1px solid #ddd;
          border-right: 1px solid #ddd;
          vertical-align: middle;
          font-size: 10.5px;
        }
        .delivery-table td:last-child { border-right: none; }

        .row-even { background: #fff; }
        .row-odd  { background: #f5f8fc; }

        /* Column widths */
        .col-id    { width: 100px; min-width: 90px; }
        .col-name  { width: 170px; min-width: 150px; font-weight: 600; }
        .col-phone { width: 110px; min-width: 100px; }
        .col-vehicle {
          width: 90px;
          min-width: 80px;
          font-family: 'Courier New', monospace;
          font-weight: 700;
          font-size: 10px;
          letter-spacing: 0.3px;
          color: #1a3a5c;
          text-align: center;
        }
        .mono {
          font-family: 'Courier New', monospace;
        }

        /* ── Footer ────────────────────────────────────────────────────── */
        .sheet-footer {
          display: flex;
          justify-content: space-around;
          padding: 18px 20px 10px;
          border: 2px solid #1a1a1a;
          border-top: 1px solid #ccc;
          margin-top: 0;
          gap: 20px;
        }
        .signature-block {
          flex: 1;
          text-align: center;
        }
        .signature-line {
          border-bottom: 1px solid #333;
          margin-bottom: 6px;
          height: 32px;
        }
        .signature-block p {
          font-size: 9px;
          text-transform: uppercase;
          color: #555;
          letter-spacing: 0.5px;
          margin: 0;
        }

        /* ── No-data ────────────────────────────────────────────────────── */
        .no-drivers {
          padding: 20px;
          text-align: center;
          color: #666;
          border: 2px solid #1a1a1a;
          border-top: none;
        }

        /* ── Screen-only toolbar ─────────────────────────────────────────── */
        .print-toolbar {
          display: flex;
          align-items: center;
          justify-content: space-between;
          background: #1a3a5c;
          color: #fff;
          padding: 10px 20px;
          margin-bottom: 16px;
          border-radius: 8px;
          gap: 12px;
          flex-wrap: wrap;
        }
        .toolbar-info {
          display: flex;
          flex-direction: column;
          gap: 2px;
        }
        .toolbar-title {
          font-weight: 700;
          font-size: 14px;
        }
        .toolbar-sub {
          font-size: 12px;
          opacity: 0.75;
        }
        .print-button {
          background: #fff;
          color: #1a3a5c;
          border: none;
          padding: 8px 18px;
          border-radius: 6px;
          font-weight: 700;
          font-size: 13px;
          cursor: pointer;
          white-space: nowrap;
        }
        .print-button:hover { background: #e8f0fe; }

        /* ── Loading / error ─────────────────────────────────────────────── */
        .sheet-loading {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          height: 200px;
          gap: 12px;
          color: #666;
        }
        .loading-spinner {
          width: 32px; height: 32px;
          border: 3px solid #e2e8f0;
          border-top-color: #1a3a5c;
          border-radius: 50%;
          animation: spin 0.8s linear infinite;
        }
        @keyframes spin { to { transform: rotate(360deg); } }
        .sheet-error {
          padding: 20px;
          color: #dc2626;
          background: #fef2f2;
          border: 1px solid #fecaca;
          border-radius: 8px;
          margin: 20px;
        }

        /* ── Print media ─────────────────────────────────────────────────── */
        @media print {
          @page {
            size: A4 landscape;
            margin: 10mm 8mm;
          }

          body {
            background: #fff !important;
          }

          .no-print { display: none !important; }

          .delivery-sheet-root {
            padding: 0;
            max-width: none;
          }

          .delivery-sheet-section {
            page-break-after: always;
            margin-bottom: 0;
          }
          .delivery-sheet-section:last-child {
            page-break-after: avoid;
          }

          .delivery-table th,
          .delivery-table td {
            font-size: 9.5px;
            padding: 5px 6px;
          }

          .sheet-title { font-size: 13px; }
          .meta-value  { font-size: 10px; }

          /* Force background colours in print */
          .delivery-table thead tr,
          .sheet-header-top {
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }
          .row-odd {
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }
        }
      `}</style>
    </>
  );
}
