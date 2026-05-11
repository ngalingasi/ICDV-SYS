import { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router';
import { manifestsApi, vesselsApi } from '../../api';
import type { Vessel } from '../../types';
import { toast } from '../../components/tpfcs/Toast';
import BackButton from '../../components/tpfcs/BackButton';

interface CsvRow { _rowNum: number; bill_of_lading_no?: string; chassis_no?: string; destination?: string; delivery_location?: string; [k: string]: any; }
interface PreviewResult { total: number; rows: CsvRow[]; in_file_duplicates: string[]; }
interface ImportResult { total: number; imported: number; failed: number; duplicates: string[]; errors: { row: number; chassis?: string; error: string }[]; }

export default function ManifestForm() {
  const { id } = useParams();
  const [sp] = useSearchParams();
  const navigate = useNavigate();
  const isEdit = Boolean(id);

  const [form, setForm] = useState({
    manifest_number: '', vessel_id: sp.get('vessel_id') ?? '',
    arrival_date: '', notes: '', status: 'pending',
  });
  const [vessels, setVessels]         = useState<Vessel[]>([]);
  const [saving, setSaving]           = useState(false);
  const [loading, setLoading]         = useState(isEdit);
  const [numLoading, setNumLoading]   = useState(!isEdit);

  // CSV state
  const [csvFile, setCsvFile]         = useState<File | null>(null);
  const [preview, setPreview]         = useState<PreviewResult | null>(null);
  const [previewing, setPreviewing]   = useState(false);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const [manifestId, setManifestId]   = useState<number | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }));

  useEffect(() => {
    vesselsApi.list({ limit: 200 }).then(r => setVessels(r.data.results ?? []));
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
      }).finally(() => setLoading(false));
    } else {
      // Auto-fetch next manifest number
      manifestsApi.getNextNumber().then(r => {
        setForm(f => ({ ...f, manifest_number: r.data.manifest_number }));
      }).finally(() => setNumLoading(false));
    }
  }, [id]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.vessel_id || !form.arrival_date) {
      toast.error('Vessel and arrival date are required'); return;
    }
    setSaving(true);
    try {
      const payload = {
        vessel_id: Number(form.vessel_id),
        arrival_date: form.arrival_date,
        notes: form.notes || null,
        ...(isEdit ? { status: form.status } : {}),
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
          // Stay on page to do import
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
    setCsvFile(file);
    setPreview(null);
    setImportResult(null);
  };

  const handlePreview = async () => {
    if (!csvFile) return;
    // Need a manifest to preview against, create one first if needed
    let mid = manifestId ?? Number(id);
    if (!mid) {
      toast.error('Please save the manifest first before previewing CSV');
      return;
    }
    setPreviewing(true);
    try {
      const fd = new FormData();
      fd.append('csv', csvFile);
      const r = await manifestsApi.previewCSV(mid, fd);
      setPreview(r.data);
    } catch (err: any) {
      toast.error(err?.response?.data?.message ?? 'Preview failed');
    } finally {
      setPreviewing(false);
    }
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
    } finally {
      setSaving(false);
    }
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

      {/* ── Manifest details form ─────────────────────────────── */}
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

          {/* Vessel */}
          <div>
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
              Vessel <span className="text-red-500">*</span>
            </label>
            <select value={form.vessel_id} onChange={e => set('vessel_id', e.target.value)} required className={cls}>
              <option value="">Select vessel…</option>
              {vessels.map(v => (
                <option key={v.vessel_id} value={v.vessel_id}>{v.name}{v.imo_number ? ` (${v.imo_number})` : ''}</option>
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
          <button type="submit" disabled={saving || numLoading}
            className="px-5 py-2 rounded-lg bg-brand-500 hover:bg-brand-600 text-white text-sm font-medium disabled:opacity-70 transition-colors">
            {saving ? 'Saving…' : isEdit ? 'Update Manifest' : 'Create Manifest'}
          </button>
        </div>
      </form>

      {/* ── CSV Import section ────────────────────────────────── */}
      <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-6 space-y-5">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-sm font-semibold text-gray-800 dark:text-white">Import Vehicles from CSV</h2>
            <p className="text-xs text-gray-500 mt-0.5">
              Expected columns: <code className="bg-gray-100 dark:bg-gray-800 px-1 rounded">M B/L No, Chassis No, Place of Destination, Place of Delivery</code>
            </p>
          </div>
          <button onClick={() => fileRef.current?.click()}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-sm border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 text-gray-700 dark:text-gray-300">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
            </svg>
            {csvFile ? 'Change File' : 'Choose CSV'}
          </button>
          <input ref={fileRef} type="file" accept=".csv,text/csv" className="hidden" onChange={handleCsvChange} />
        </div>

        {csvFile && (
          <div className="flex items-center gap-3 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
            <svg className="w-5 h-5 text-blue-500 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <span className="text-sm text-blue-700 dark:text-blue-300 flex-1">{csvFile.name}</span>
            <div className="flex gap-2">
              <button onClick={handlePreview} disabled={previewing || !manifestSaved}
                title={!manifestSaved ? 'Save manifest first' : ''}
                className="px-3 py-1.5 text-xs font-medium rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50">
                {previewing ? 'Parsing…' : 'Preview'}
              </button>
            </div>
          </div>
        )}

        {!manifestSaved && csvFile && (
          <p className="text-xs text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg px-3 py-2">
            ⚠ Save the manifest above first, then click Preview to validate the CSV.
          </p>
        )}

        {/* Preview table */}
        {preview && !importResult && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
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
                className="px-4 py-1.5 text-sm font-medium rounded-lg bg-green-600 text-white hover:bg-green-700 disabled:opacity-50">
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
                      <th key={h} className="px-3 py-2 text-left font-medium">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                  {preview.rows.slice(0, 50).map((row, i) => (
                    <tr key={i} className={`${preview.in_file_duplicates.includes(row.chassis_no ?? '') ? 'bg-amber-50 dark:bg-amber-900/10' : 'hover:bg-gray-50 dark:hover:bg-gray-800/40'}`}>
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
                { label: 'Total Rows',   val: importResult.total,    cls: 'bg-gray-50 dark:bg-gray-800' },
                { label: 'Imported',     val: importResult.imported, cls: 'bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400' },
                { label: 'Failed',       val: importResult.failed,   cls: 'bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400' },
                { label: 'Duplicates',   val: importResult.duplicates.length, cls: 'bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400' },
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
