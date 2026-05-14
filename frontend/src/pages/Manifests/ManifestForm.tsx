import { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router';
import { manifestsApi, vesselsApi, icdvsApi } from '../../api';
import type { Vessel } from '../../types';
import { toast } from '../../components/tpfcs/Toast';
import BackButton from '../../components/tpfcs/BackButton';
import { useAuth } from '../../store/authStore';

interface CsvRow { _rowNum: number; bill_of_lading_no?: string; chassis_no?: string; destination?: string; delivery_location?: string; [k: string]: any; }
interface PreviewResult { total: number; rows: CsvRow[]; in_file_duplicates: string[]; }
interface ImportResult { total: number; imported: number; failed: number; duplicates: string[]; errors: { row: number; chassis?: string; error: string }[]; }

export default function ManifestForm() {
  const { id } = useParams();
  const [sp] = useSearchParams();
  const navigate = useNavigate();
  const isEdit = Boolean(id);

  const { isSuperAdmin } = useAuth();
  // system_admin role check via user object
  const { user } = useAuth() as any;
  const isSystemAdmin  = user?.role === 'system_admin';
  const isCrossTenant  = isSuperAdmin || isSystemAdmin;

  const [form, setForm] = useState({
    manifest_number: '', vessel_id: sp.get('vessel_id') ?? '',
    arrival_date: '', notes: '', status: 'pending',
  });

  // ICDV selector state — only used for cross-tenant users
  const [selectedIcdvId,   setSelectedIcdvId]   = useState('');
  const [selectedIcdvName, setSelectedIcdvName] = useState('');
  const [icdvs,            setIcdvs]            = useState<any[]>([]);

  const [vessels,    setVessels]    = useState<Vessel[]>([]);
  const [saving,     setSaving]     = useState(false);
  const [loading,    setLoading]    = useState(isEdit);
  const [numLoading, setNumLoading] = useState(!isEdit);

  // CSV state
  const [csvFile,      setCsvFile]      = useState<File | null>(null);
  const [preview,      setPreview]      = useState<PreviewResult | null>(null);
  const [previewing,   setPreviewing]   = useState(false);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const [manifestId,   setManifestId]   = useState<number | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }));

  // Load ICDV list for cross-tenant users
  useEffect(() => {
    if (!isCrossTenant) return;
    icdvsApi.list({ limit: 200, status: 'active' })
      .then(r => setIcdvs(r.data.results ?? r.data))
      .catch(() => {});
  }, [isCrossTenant]); // eslint-disable-line

  // Load vessels — scoped to selected ICDV for cross-tenant users
  useEffect(() => {
    const params: any = { limit: 200 };
    if (isCrossTenant && selectedIcdvId) params.icdv_id = selectedIcdvId;
    if (!isCrossTenant || selectedIcdvId) {
      // Only fetch if we have a tenant scope (or user is a fixed-ICDV user)
      vesselsApi.list(params).then(r => setVessels(r.data.results ?? []));
    } else {
      setVessels([]); // clear until ICDV is picked
    }
    // Reset vessel selection when ICDV changes
    if (isCrossTenant) set('vessel_id', '');
  }, [selectedIcdvId, isCrossTenant]); // eslint-disable-line

  useEffect(() => {
    if (isEdit) {
      manifestsApi.get(Number(id)).then(r => {
        const m = r.data;
        setForm({
          manifest_number: m.manifest_number,
          vessel_id:       String(m.vessel_id),
          arrival_date:    m.arrival_date?.slice(0, 10) ?? '',
          notes:           m.notes ?? '',
          status:          m.status,
        });
        setManifestId(m.manifest_id);
        // For edit, pre-select the ICDV from manifest
        if (isCrossTenant && (m as any).icdv_id) {
          setSelectedIcdvId(String((m as any).icdv_id));
        }
      }).finally(() => setLoading(false));
    } else {
      manifestsApi.getNextNumber().then(r => {
        setForm(f => ({ ...f, manifest_number: r.data.manifest_number }));
      }).finally(() => setNumLoading(false));
    }
  }, [id]); // eslint-disable-line

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();

    // Cross-tenant users must pick an ICDV first
    if (isCrossTenant && !selectedIcdvId) {
      toast.error('Please select an ICDV before creating a manifest.');
      return;
    }
    if (!form.vessel_id || !form.arrival_date) {
      toast.error('Vessel and arrival date are required'); return;
    }

    setSaving(true);
    try {
      const payload: any = {
        vessel_id:    Number(form.vessel_id),
        arrival_date: form.arrival_date,
        notes:        form.notes || null,
        // Include icdv_id for super/system admin so tenant middleware sets req.icdvId
        ...(isCrossTenant && selectedIcdvId ? { icdv_id: Number(selectedIcdvId) } : {}),
        ...(isEdit ? { status: form.status as import('../../types').ManifestStatus } : {}),
      };

      if (isEdit) {
        await manifestsApi.update(Number(id), payload);
        toast.success('Manifest updated');
        navigate(`/manifests/${id}`);
      } else {
        const r = await manifestsApi.create(payload);
        const newId = r.data.manifest_id;
        setManifestId(newId);
        toast.success(`Manifest ${r.data.manifest_number} created`);
        if (csvFile) {
          setForm(f => ({ ...f, manifest_number: r.data.manifest_number }));
        } else {
          navigate(`/manifests/${newId}`);
        }
      }
    } catch (err: any) {
      toast.error(err?.response?.data?.message ?? 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  const handleCsvChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setCsvFile(file); setPreview(null); setImportResult(null);
  };

  const handlePreview = async () => {
    if (!csvFile) return;
    const mid = manifestId ?? Number(id);
    if (!mid) { toast.error('Save the manifest first before previewing'); return; }
    setPreviewing(true);
    try {
      const fd = new FormData();
      fd.append('csv', csvFile);
      const r = await manifestsApi.previewCSV(mid, fd);
      setPreview(r.data);
    } catch (err: any) {
      toast.error(err?.response?.data?.message ?? 'Preview failed');
    } finally { setPreviewing(false); }
  };

  const handleImport = async () => {
    const mid = manifestId ?? Number(id);
    if (!mid || !csvFile) return;
    setSaving(true);
    try {
      const fd = new FormData();
      fd.append('csv', csvFile);
      const r = await manifestsApi.importVehicles(mid, fd);
      setImportResult(r.data);
      toast.success(`Import complete: ${r.data.imported} vehicles added`);
    } catch (err: any) {
      toast.error(err?.response?.data?.message ?? 'Import failed');
    } finally { setSaving(false); }
  };

  const cls = "w-full border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-900 text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-brand-500";

  if (loading) return <div className="p-6 text-sm text-gray-500 animate-pulse">Loading…</div>;

  const manifestSaved = Boolean(manifestId || isEdit);

  return (
    <div className="p-4 sm:p-6 max-w-4xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <BackButton />
        <div>
          <h1 className="text-xl font-bold text-gray-800 dark:text-white">
            {isEdit ? 'Edit Manifest' : 'New Manifest'}
          </h1>
          {!isEdit && <p className="text-xs text-gray-500">Manifest number is auto-generated by the system</p>}
        </div>
      </div>

      {/* ── ICDV Selector — super admin / system_admin only ────────────────── */}
      {isCrossTenant && (
        <div className={`rounded-xl border-2 p-4 space-y-3 ${
          selectedIcdvId
            ? 'border-brand-300 dark:border-brand-500/40 bg-brand-50 dark:bg-brand-500/10'
            : 'border-dashed border-orange-300 dark:border-orange-500/40 bg-orange-50 dark:bg-orange-500/10'
        }`}>
          <div className="flex items-center gap-2">
            <svg className={`w-4 h-4 flex-shrink-0 ${selectedIcdvId ? 'text-brand-500' : 'text-orange-500'}`}
              fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round"
                d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
            </svg>
            <p className={`text-sm font-semibold ${selectedIcdvId ? 'text-brand-700 dark:text-brand-300' : 'text-orange-700 dark:text-orange-400'}`}>
              {selectedIcdvId
                ? `Operating on behalf of: ${selectedIcdvName}`
                : 'Select ICDV — required before creating manifest'}
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {icdvs.map((ic: any) => (
              <button
                key={ic.icdv_id}
                type="button"
                onClick={() => {
                  setSelectedIcdvId(String(ic.icdv_id));
                  setSelectedIcdvName(ic.name);
                }}
                className={`flex items-center gap-3 px-4 py-3 rounded-xl border-2 text-left transition-all ${
                  selectedIcdvId === String(ic.icdv_id)
                    ? 'border-brand-500 bg-white dark:bg-gray-900 shadow-sm'
                    : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 hover:border-brand-300 dark:hover:border-brand-500/40'
                }`}
              >
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 text-xs font-bold ${
                  selectedIcdvId === String(ic.icdv_id)
                    ? 'bg-brand-500 text-white'
                    : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400'
                }`}>
                  {ic.code?.slice(0, 2) ?? 'IC'}
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-gray-800 dark:text-white truncate">{ic.name}</p>
                  {ic.code && <p className="text-xs text-gray-400 dark:text-gray-500">{ic.code}</p>}
                </div>
                {selectedIcdvId === String(ic.icdv_id) && (
                  <svg className="w-5 h-5 text-brand-500 flex-shrink-0 ml-auto" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                )}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ── Manifest details form ─────────────────────────────────────────── */}
      <form onSubmit={handleSave} className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-6 space-y-5">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Auto-generated manifest number */}
          <div>
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
              Manifest Number
              <span className="ml-1.5 text-xs text-brand-500 font-normal">(auto-generated)</span>
            </label>
            <input
              value={numLoading ? 'Generating…' : form.manifest_number}
              readOnly
              className={`${cls} bg-gray-50 dark:bg-gray-800 cursor-not-allowed text-gray-500`}
            />
          </div>

          {/* Vessel — disabled until ICDV selected for cross-tenant users */}
          <div>
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
              Vessel <span className="text-red-500">*</span>
              {isCrossTenant && !selectedIcdvId && (
                <span className="ml-2 text-orange-500 font-normal">— select ICDV first</span>
              )}
            </label>
            <select
              value={form.vessel_id}
              onChange={e => set('vessel_id', e.target.value)}
              required
              disabled={isCrossTenant && !selectedIcdvId}
              className={`${cls} ${isCrossTenant && !selectedIcdvId ? 'opacity-50 cursor-not-allowed' : ''}`}
            >
              <option value="">Select vessel…</option>
              {vessels.map(v => (
                <option key={v.vessel_id} value={v.vessel_id}>
                  {v.name}{v.imo_number ? ` (${v.imo_number})` : ''}
                </option>
              ))}
            </select>
          </div>

          {/* Arrival date */}
          <div>
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
              Arrival Date <span className="text-red-500">*</span>
            </label>
            <input type="date" value={form.arrival_date} onChange={e => set('arrival_date', e.target.value)} required className={cls} />
          </div>

          {/* Status (edit only) */}
          {isEdit && (
            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Status</label>
              <select value={form.status} onChange={e => set('status', e.target.value)} className={cls}>
                {['pending','active','completed','cancelled'].map(s =>
                  <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>)}
              </select>
            </div>
          )}
        </div>

        <div>
          <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Notes</label>
          <textarea value={form.notes} onChange={e => set('notes', e.target.value)} rows={2}
            className={`${cls} resize-none`} placeholder="Optional notes…" />
        </div>

        <div className="flex justify-end gap-3 pt-1">
          <button type="button" onClick={() => navigate(-1)}
            className="px-4 py-2 rounded-lg border border-gray-200 dark:border-gray-700 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800">
            Cancel
          </button>
          <button type="submit" disabled={saving || numLoading || (isCrossTenant && !selectedIcdvId)}
            className="px-5 py-2 rounded-lg bg-brand-500 hover:bg-brand-600 text-white text-sm font-medium disabled:opacity-70 transition-colors">
            {saving ? 'Saving…' : isEdit ? 'Update Manifest' : 'Create Manifest'}
          </button>
        </div>
      </form>

      {/* ── CSV / Excel Import section ────────────────────────────────────── */}
      <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-6 space-y-5">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h2 className="text-sm font-semibold text-gray-800 dark:text-white">Import Vehicles from CSV / Excel</h2>
            <p className="text-xs text-gray-500 mt-0.5">
              Accepts <strong className="text-gray-600 dark:text-gray-300">.csv</strong>, <strong className="text-gray-600 dark:text-gray-300">.xlsx</strong>, <strong className="text-gray-600 dark:text-gray-300">.xls</strong>.
              Required column: <code className="bg-gray-100 dark:bg-gray-800 px-1 rounded text-xs">chassis_no</code> or <code className="bg-gray-100 dark:bg-gray-800 px-1 rounded text-xs">chassis_number</code>
            </p>
          </div>
          <button onClick={() => fileRef.current?.click()}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-sm border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 text-gray-700 dark:text-gray-300">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
            </svg>
            {csvFile ? 'Change File' : 'Choose File'}
          </button>
          <input ref={fileRef} type="file"
            accept=".csv,.xlsx,.xls,text/csv,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            className="hidden" onChange={handleCsvChange} />
        </div>

        {csvFile && (
          <div className="flex items-center gap-3 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
            <svg className="w-5 h-5 text-blue-500 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <span className="text-sm text-blue-700 dark:text-blue-300 flex-1 truncate">{csvFile.name}</span>
            <button onClick={handlePreview} disabled={previewing || !manifestSaved}
              title={!manifestSaved ? 'Save manifest first' : ''}
              className="px-3 py-1.5 text-xs font-medium rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 whitespace-nowrap">
              {previewing ? 'Parsing…' : 'Preview'}
            </button>
          </div>
        )}

        {!manifestSaved && csvFile && (
          <p className="text-xs text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg px-3 py-2">
            Save the manifest above first, then click Preview to validate the file.
          </p>
        )}

        {/* Preview table */}
        {preview && !importResult && (
          <div className="space-y-3">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div className="flex gap-3 text-sm">
                <span className="text-gray-600 dark:text-gray-400">
                  <strong className="text-gray-900 dark:text-white">{preview.total}</strong> rows found
                </span>
                {preview.in_file_duplicates.length > 0 && (
                  <span className="text-amber-600 dark:text-amber-400">
                    ⚠ {preview.in_file_duplicates.length} duplicate(s) in file
                  </span>
                )}
              </div>
              <button onClick={handleImport} disabled={saving}
                className="px-4 py-1.5 text-sm font-medium rounded-lg bg-green-600 text-white hover:bg-green-700 disabled:opacity-50 whitespace-nowrap">
                {saving ? 'Importing…' : `Import ${preview.total} Vehicles`}
              </button>
            </div>

            {preview.in_file_duplicates.length > 0 && (
              <div className="text-xs text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg px-3 py-2">
                Duplicate chassis in file: {preview.in_file_duplicates.join(', ')}
              </div>
            )}

            <div className="overflow-x-auto rounded-lg border border-gray-200 dark:border-gray-700">
              <table className="w-full text-xs">
                <thead className="bg-gray-50 dark:bg-gray-800 text-gray-500 uppercase">
                  <tr>
                    {['#','B/L No','Chassis No','Destination','Delivery Location'].map(h => (
                      <th key={h} className="px-3 py-2 text-left font-medium whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                  {preview.rows.slice(0, 50).map((row, i) => (
                    <tr key={i} className={preview.in_file_duplicates.includes(row.chassis_no ?? '') ? 'bg-amber-50 dark:bg-amber-900/10' : 'hover:bg-gray-50 dark:hover:bg-gray-800/40'}>
                      <td className="px-3 py-2 text-gray-400">{row._rowNum}</td>
                      <td className="px-3 py-2 text-gray-600 dark:text-gray-400">{row.bill_of_lading_no || '—'}</td>
                      <td className="px-3 py-2 font-mono font-medium text-gray-800 dark:text-gray-200">{row.chassis_no || <span className="text-red-400">MISSING</span>}</td>
                      <td className="px-3 py-2 text-gray-600 dark:text-gray-400">{row.destination || '—'}</td>
                      <td className="px-3 py-2 text-gray-600 dark:text-gray-400">{row.delivery_location || '—'}</td>
                    </tr>
                  ))}
                  {preview.rows.length > 50 && (
                    <tr><td colSpan={5} className="px-3 py-2 text-center text-gray-400 italic">… and {preview.rows.length - 50} more rows</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Import result */}
        {importResult && (
          <div className="space-y-3">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {[
                { label: 'Total Rows',  val: importResult.total,              cls: 'bg-gray-50 dark:bg-gray-800' },
                { label: 'Imported',    val: importResult.imported,           cls: 'bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400' },
                { label: 'Failed',      val: importResult.failed,             cls: 'bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400' },
                { label: 'Duplicates', val: importResult.duplicates.length,  cls: 'bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400' },
              ].map(s => (
                <div key={s.label} className={`rounded-lg p-3 ${s.cls}`}>
                  <p className="text-xs text-gray-500 dark:text-gray-400">{s.label}</p>
                  <p className="text-2xl font-bold mt-0.5">{s.val}</p>
                </div>
              ))}
            </div>
            {importResult.errors.length > 0 && (
              <div className="rounded-lg border border-red-200 dark:border-red-800 overflow-hidden">
                <div className="px-3 py-2 bg-red-50 dark:bg-red-900/20 text-xs font-medium text-red-700 dark:text-red-400">
                  Errors ({importResult.errors.length})
                </div>
                <ul className="divide-y divide-red-100 dark:divide-red-900/20 max-h-40 overflow-y-auto">
                  {importResult.errors.map((e, i) => (
                    <li key={i} className="px-3 py-1.5 text-xs text-gray-600 dark:text-gray-400">
                      Row {e.row}{e.chassis ? ` · ${e.chassis}` : ''}: <span className="text-red-500">{e.error}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            <div className="flex gap-2 justify-end">
              <button onClick={() => navigate(`/manifests/${manifestId ?? id}`)}
                className="px-4 py-2 text-sm rounded-lg bg-brand-500 text-white hover:bg-brand-600">
                View Manifest
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
