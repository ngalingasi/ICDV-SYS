/**
 * DeliverySheetPage.tsx
 *
 * Two modes — same data flow, unchanged:
 *   BATCH mode    /operations/batches/:batchId/delivery-sheet
 *   MANIFEST mode /manifests/:manifestId/delivery-sheet
 *
 * Print strategy:
 *   Screen  → plain white card, all batches stacked, no colours, no padding noise
 *   Print   → iframe injection: each batch is an isolated <table> page with its
 *             own @page rule — zero bleed from screen styles
 *
 * ?printed_by=Name   shown in header
 * ?print=1           auto-print on load
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
  batch:        BatchSection & { vessel_name: string; icdv_name: string };
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
    total_vehicles:  number;
    total_batches:   number;
  };
  batches: BatchSection[];
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const fmtDate = (d?: string) =>
  d ? new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';

// ─── Print via iframe (clean, isolated from screen CSS) ───────────────────────

function buildPrintHTML(
  batches: Array<BatchSection & { vessel_name?: string; icdv_name?: string }>,
  meta: { icdv_name: string; vessel_name: string; manifest_number: string; printed_by: string; print_date: string; },
): string {
  const batchPages = batches.map((batch, idx) => {
    const rows = batch.drivers.length === 0
      ? `<tr><td colspan="7" style="text-align:center;padding:16px;color:#888;">No transfer records for this batch.</td></tr>`
      : batch.drivers.map((d, i) => `
          <tr style="background:${i % 2 === 0 ? '#fff' : '#f9f9f9'}">
            <td style="text-align:center">${i + 1}</td>
            <td>${d.id_number || '—'}</td>
            <td>${d.license_number || '—'}</td>
            <td><strong>${d.full_name}</strong></td>
            <td>${d.phone || '—'}</td>
            <td style="font-size:8pt">${d.chassis_numbers.join(' · ') || '—'}</td>
            <td style="text-align:center"><strong>${d.chassis_numbers.length}</strong></td>
          </tr>`).join('');

    return `
      <div class="page">
        <!-- Header -->
        <table class="header-table">
          <tr>
            <td style="width:33%">
              <strong>${meta.icdv_name}</strong><br>
              <span style="font-size:8pt;color:#555">Vehicle Delivery Sheet</span>
            </td>
            <td style="width:34%;text-align:center">
              <div style="font-size:14pt;font-weight:900;letter-spacing:1px">DELIVERY SHEET</div>
              <div style="font-size:8pt;color:#555">Batch ${idx + 1} of ${batches.length}</div>
            </td>
            <td style="width:33%;text-align:right;font-size:8pt;color:#555">
              Manifest: <strong>${meta.manifest_number}</strong><br>
              Printed: ${meta.print_date}<br>
              By: ${meta.printed_by}
            </td>
          </tr>
        </table>

        <!-- Batch info row -->
        <table class="info-table">
          <tr>
            <td><span class="lbl">Batch</span><br><strong>${batch.batch_number}</strong></td>
            <td><span class="lbl">Vessel</span><br>${meta.vessel_name}</td>
            <td><span class="lbl">ICDV</span><br>${meta.icdv_name}</td>
            <td><span class="lbl">Date</span><br>${fmtDate(batch.batch_date)}</td>
            <td><span class="lbl">Vehicles</span><br><strong>${batch.vehicle_count}</strong></td>
            <td><span class="lbl">Drivers</span><br><strong>${batch.drivers.length}</strong></td>
            <td><span class="lbl">Status</span><br>${(batch.status || '').toUpperCase()}</td>
          </tr>
        </table>

        <!-- Driver table -->
        <table class="driver-table">
          <thead>
            <tr>
              <th style="width:30px">No.</th>
              <th style="width:95px">Driver ID</th>
              <th style="width:95px">License No.</th>
              <th style="width:150px">Driver Name</th>
              <th style="width:95px">Mobile</th>
              <th>Chassis Numbers</th>
              <th style="width:44px">Total</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>

        <!-- Signature -->
        <table class="sig-table">
          <tr>
            <td>
              <div class="sig-line"></div>
              <div class="sig-lbl">Prepared By</div>
              <div class="sig-role">Logistics Officer</div>
            </td>
            <td>
              <div class="sig-line"></div>
              <div class="sig-lbl">Checked By</div>
              <div class="sig-role">Supervisor</div>
            </td>
            <td>
              <div class="sig-line"></div>
              <div class="sig-lbl">Received By</div>
              <div class="sig-role">Authorised Personnel</div>
            </td>
          </tr>
        </table>

        <!-- Footer -->
        <div class="footer">
          <span>${meta.icdv_name} — ${meta.manifest_number}</span>
          <span>Page ${idx + 1} of ${batches.length}</span>
          <span>CONFIDENTIAL</span>
        </div>
      </div>`;
  }).join('');

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<title>Delivery Sheet</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    font-family: Arial, Helvetica, sans-serif;
    font-size: 9.5pt;
    color: #000;
    background: #fff;
  }

  /* Each page = one batch */
  .page {
    width: 100%;
    page-break-after: always;
    page-break-inside: avoid;
  }
  .page:last-child { page-break-after: avoid; }

  /* Header bar */
  .header-table {
    width: 100%;
    border-collapse: collapse;
    border-bottom: 2px solid #000;
    padding-bottom: 6px;
    margin-bottom: 6px;
  }
  .header-table td { padding: 4px 6px; vertical-align: middle; }

  /* Info row */
  .info-table {
    width: 100%;
    border-collapse: collapse;
    border: 1px solid #ccc;
    margin-bottom: 6px;
    background: #f5f5f5;
  }
  .info-table td {
    padding: 5px 10px;
    border-right: 1px solid #ccc;
    font-size: 9pt;
    vertical-align: top;
  }
  .info-table td:last-child { border-right: none; }
  .lbl { font-size: 7pt; text-transform: uppercase; color: #666; letter-spacing: 0.5px; display: block; }

  /* Driver table */
  .driver-table {
    width: 100%;
    border-collapse: collapse;
    border: 1px solid #999;
    margin-bottom: 10px;
    table-layout: fixed;
  }
  .driver-table thead tr {
    background: #333;
    color: #fff;
  }
  .driver-table th {
    padding: 6px 7px;
    text-align: left;
    font-size: 7.5pt;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    border-right: 1px solid #555;
    font-weight: 700;
  }
  .driver-table th:last-child { border-right: none; }
  .driver-table td {
    padding: 5px 7px;
    font-size: 8.5pt;
    border-bottom: 1px solid #ddd;
    border-right: 1px solid #ddd;
    vertical-align: top;
    word-wrap: break-word;
    overflow-wrap: break-word;
  }
  .driver-table td:last-child { border-right: none; }
  .driver-table tbody tr:last-child td { border-bottom: none; }

  /* Signature */
  .sig-table {
    width: 100%;
    border-collapse: collapse;
    border: 1px solid #ccc;
    margin-bottom: 6px;
  }
  .sig-table td {
    width: 33.33%;
    padding: 8px 14px 6px;
    border-right: 1px solid #ccc;
    vertical-align: top;
  }
  .sig-table td:last-child { border-right: none; }
  .sig-line {
    border-bottom: 1px solid #000;
    height: 30px;
    margin-bottom: 4px;
  }
  .sig-lbl  { font-size: 8pt; font-weight: 700; text-transform: uppercase; }
  .sig-role { font-size: 7.5pt; color: #666; margin-top: 1px; }

  /* Footer */
  .footer {
    display: flex;
    justify-content: space-between;
    font-size: 7.5pt;
    color: #666;
    border-top: 1px solid #ccc;
    padding-top: 4px;
  }

  @page {
    size: A4 landscape;
    margin: 10mm 12mm;
  }
  @media print {
    body { background: #fff; }
    .page { page-break-after: always; }
    .page:last-child { page-break-after: avoid; }
    .driver-table thead { display: table-header-group; }
  }
</style>
</head>
<body>
${batchPages}
</body>
</html>`;
}

function printViaIframe(html: string) {
  // Remove any previous iframe
  const old = document.getElementById('ds-print-frame');
  if (old) old.remove();

  const iframe = document.createElement('iframe');
  iframe.id = 'ds-print-frame';
  iframe.style.cssText = 'position:fixed;top:0;left:0;width:0;height:0;border:none;visibility:hidden;';
  document.body.appendChild(iframe);

  const doc = iframe.contentDocument!;
  doc.open();
  doc.write(html);
  doc.close();

  // Wait for images/fonts then print
  iframe.onload = () => {
    setTimeout(() => {
      iframe.contentWindow!.focus();
      iframe.contentWindow!.print();
    }, 300);
  };
}

// ─── Screen preview: plain table per batch ────────────────────────────────────

function ScreenBatchTable({ batch, index, total, icdvName, vesselName }: {
  batch: BatchSection; index: number; total: number;
  icdvName: string; vesselName: string;
}) {
  return (
    <div style={{ marginBottom: 32, border: '1px solid #e2e8f0', borderRadius: 8, overflow: 'hidden' }}>
      {/* Batch header */}
      <div style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0', padding: '10px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <span style={{ fontSize: 11, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: 1, marginRight: 10 }}>
            Batch {index + 1} of {total}
          </span>
          <span style={{ fontSize: 14, fontWeight: 700, fontFamily: 'monospace' }}>{batch.batch_number}</span>
        </div>
        <div style={{ display: 'flex', gap: 16, fontSize: 12, color: '#64748b' }}>
          <span>{batch.vehicle_count} vehicles</span>
          <span>{batch.drivers.length} drivers</span>
          <span style={{ textTransform: 'uppercase', fontWeight: 600 }}>{batch.status}</span>
        </div>
      </div>

      {/* Table */}
      {batch.drivers.length === 0 ? (
        <div style={{ padding: '20px', textAlign: 'center', color: '#94a3b8', fontSize: 13 }}>
          No transfer records for this batch yet.
        </div>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ background: '#f1f5f9', borderBottom: '2px solid #e2e8f0' }}>
                {['No.', 'Driver ID', 'License No.', 'Driver Name', 'Mobile', 'Chassis Numbers', 'Total'].map(h => (
                  <th key={h} style={{ padding: '8px 12px', textAlign: 'left', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', color: '#64748b', letterSpacing: 0.5, whiteSpace: 'nowrap' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {batch.drivers.map((d, i) => (
                <tr key={d.driver_id} style={{ background: i % 2 === 0 ? '#fff' : '#f8fafc', borderBottom: '1px solid #f1f5f9' }}>
                  <td style={{ padding: '7px 12px', color: '#94a3b8', textAlign: 'center', width: 40 }}>{i + 1}</td>
                  <td style={{ padding: '7px 12px', fontFamily: 'monospace', fontSize: 12 }}>{d.id_number || '—'}</td>
                  <td style={{ padding: '7px 12px', fontFamily: 'monospace', fontSize: 12 }}>{d.license_number || '—'}</td>
                  <td style={{ padding: '7px 12px', fontWeight: 600 }}>{d.full_name}</td>
                  <td style={{ padding: '7px 12px', fontFamily: 'monospace', fontSize: 12 }}>{d.phone || '—'}</td>
                  <td style={{ padding: '7px 12px', fontFamily: 'monospace', fontSize: 11, color: '#334155' }}>{d.chassis_numbers.join('  ·  ') || '—'}</td>
                  <td style={{ padding: '7px 12px', textAlign: 'center', fontWeight: 700, color: '#0f172a' }}>{d.chassis_numbers.length}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ─── BATCH MODE (screen) ──────────────────────────────────────────────────────

function BatchModeScreen({ data }: { data: SingleBatchData }) {
  const { batch, drivers } = data;
  return (
    <ScreenBatchTable
      batch={{ ...batch, drivers }}
      index={0} total={1}
      icdvName={batch.icdv_name || 'ICDV'}
      vesselName={batch.vessel_name || '—'}
    />
  );
}

// ─── MANIFEST MODE (screen) ───────────────────────────────────────────────────

function ManifestModeScreen({ data }: { data: ManifestData }) {
  const { manifest, batches } = data;
  return (
    <>
      {/* Manifest summary */}
      <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 8, padding: '14px 20px', marginBottom: 24, display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 12 }}>
        {[
          ['Manifest',  manifest.manifest_number],
          ['Vessel',    manifest.vessel_name || '—'],
          ['ICDV',      manifest.icdv_name   || '—'],
          ['Arrival',   fmtDate(manifest.arrival_date)],
          ['Vehicles',  String(manifest.total_vehicles ?? '—')],
          ['Batches',   String(manifest.total_batches)],
        ].map(([label, value]) => (
          <div key={label}>
            <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', color: '#94a3b8', letterSpacing: 0.5, marginBottom: 2 }}>{label}</div>
            <div style={{ fontSize: 14, fontWeight: 700, color: '#0f172a', fontFamily: label === 'Manifest' ? 'monospace' : 'inherit' }}>{value}</div>
          </div>
        ))}
      </div>

      {batches.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 40, color: '#94a3b8', fontSize: 14 }}>
          No batch transfer records found for this manifest yet.
        </div>
      ) : (
        batches.map((batch, idx) => (
          <ScreenBatchTable
            key={batch.batch_id}
            batch={batch}
            index={idx}
            total={batches.length}
            icdvName={manifest.icdv_name || 'ICDV'}
            vesselName={manifest.vessel_name || '—'}
          />
        ))
      )}
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

  const printedBy   = sp.get('printed_by') || 'Operator';
  const printDate   = new Date().toLocaleString('en-GB', {
    day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
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
      } finally { setLoading(false); }
    })();
  }, [batchId, manifestId]);

  // Build print batches list from whichever mode
  const handlePrint = () => {
    let batches: Array<BatchSection & { vessel_name?: string; icdv_name?: string }> = [];
    let meta = { icdv_name: 'ICDV', vessel_name: '—', manifest_number: '—', printed_by: printedBy, print_date: printDate };

    if (manifestData) {
      batches = manifestData.batches;
      meta = {
        icdv_name:       manifestData.manifest.icdv_name   || 'ICDV',
        vessel_name:     manifestData.manifest.vessel_name || '—',
        manifest_number: manifestData.manifest.manifest_number,
        printed_by:      printedBy,
        print_date:      printDate,
      };
    } else if (batchData) {
      batches = [{ ...batchData.batch, drivers: batchData.drivers, max_vehicles: batchData.max_vehicles }];
      meta = {
        icdv_name:       batchData.batch.icdv_name   || 'ICDV',
        vessel_name:     batchData.batch.vessel_name || '—',
        manifest_number: batchData.batch.batch_number,
        printed_by:      printedBy,
        print_date:      printDate,
      };
    }

    if (!batches.length) return;
    printViaIframe(buildPrintHTML(batches, meta));
  };

  // Auto-print
  const didPrint = useRef(false);
  const hasData  = Boolean(batchData || manifestData);
  useEffect(() => {
    if (!loading && !error && hasData && sp.get('print') === '1' && !didPrint.current) {
      didPrint.current = true;
      setTimeout(handlePrint, 500);
    }
  }, [loading, error, hasData]); // eslint-disable-line

  const toolbarSub = isManifestMode && manifestData
    ? `${manifestData.manifest.icdv_name}  ·  ${manifestData.manifest.vessel_name}  ·  ${manifestData.manifest.manifest_number}  ·  ${manifestData.manifest.total_batches} batch${manifestData.manifest.total_batches !== 1 ? 'es' : ''}`
    : batchData
    ? `${batchData.batch.icdv_name}  ·  ${batchData.batch.vessel_name}  ·  ${batchData.batch.batch_number}`
    : '';

  if (loading) return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: 200, gap: 14, color: '#64748b', fontSize: 13 }}>
      <div style={{ width: 32, height: 32, border: '3px solid #e2e8f0', borderTopColor: '#0f172a', borderRadius: '50%', animation: 'spin .7s linear infinite' }} />
      Generating delivery sheet…
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );

  if (error) return (
    <div style={{ margin: 20, padding: 16, background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8, color: '#dc2626', fontSize: 13 }}>
      ⚠ {error}
    </div>
  );

  return (
    <div style={{ fontFamily: 'Arial, sans-serif' }}>
      {/* Toolbar */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#0f172a', color: '#fff', padding: '11px 20px', borderRadius: 8, marginBottom: 20, flexWrap: 'wrap', gap: 10 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <span style={{ fontWeight: 700, fontSize: 14 }}>
            {isManifestMode ? 'Manifest Delivery Sheet' : 'Batch Delivery Sheet'}
          </span>
          {toolbarSub && <span style={{ fontSize: 11, opacity: .65 }}>{toolbarSub}</span>}
        </div>
        <button
          onClick={handlePrint}
          style={{ background: '#fff', color: '#0f172a', border: 'none', padding: '9px 20px', borderRadius: 6, fontWeight: 700, fontSize: 13, cursor: 'pointer', whiteSpace: 'nowrap' }}
        >
          🖨 Print / Save PDF
        </button>
      </div>

      {/* Screen content */}
      <div style={{ maxWidth: 1060, margin: '0 auto' }}>
        {isManifestMode && manifestData && <ManifestModeScreen data={manifestData} />}
        {!isManifestMode && batchData    && <BatchModeScreen   data={batchData}    />}
      </div>
    </div>
  );
}
