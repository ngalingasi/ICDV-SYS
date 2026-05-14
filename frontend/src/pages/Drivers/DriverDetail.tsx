import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { driversApi } from '../../api';
import type { Driver } from '../../types';
import StatusBadge from '../../components/tpfcs/StatusBadge';
import { toast } from '../../components/tpfcs/Toast';
import BackButton from '../../components/tpfcs/BackButton';

const RAW_API  = (import.meta as any).env?.VITE_API_URL ?? 'http://localhost:3000/api';
const API_BASE = RAW_API.replace(/\/api(\/v\d+)?$/, '');

export default function DriverDetail() {
  const { id }     = useParams();
  const navigate   = useNavigate();

  const [driver,   setDriver]   = useState<Driver | null>(null);
  const [loading,  setLoading]  = useState(true);
  const [showDel,  setShowDel]  = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [showRel,  setShowRel]  = useState(false);
  const [releasing,setReleasing]= useState(false);

  const load = () => {
    driversApi.get(Number(id))
      .then(r => setDriver(r.data))
      .finally(() => setLoading(false));
  };
  useEffect(() => { load(); }, [id]); // eslint-disable-line

  const handleDelete = async () => {
    setDeleting(true);
    try {
      await driversApi.delete(Number(id));
      toast.success('Driver deleted');
      navigate('/drivers');
    } catch (e: any) {
      toast.error(e?.response?.data?.message ?? 'Delete failed');
    } finally { setDeleting(false); setShowDel(false); }
  };

  const handleRelease = async () => {
    setReleasing(true);
    try {
      const r = await driversApi.release(Number(id));
      setDriver(r.data as Driver);
      toast.success('Driver released — now available to all ICDVs');
      setShowRel(false);
    } catch (e: any) {
      toast.error(e?.response?.data?.message ?? 'Release failed');
    } finally { setReleasing(false); }
  };

  const fmtDate = (d?: string) => d
    ? new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
    : '—';

  const fmtDateTime = (d?: string) => d
    ? new Date(d).toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
    : '—';

  if (loading) return <div className="p-6 text-sm text-gray-500 animate-pulse">Loading driver…</div>;
  if (!driver)  return <div className="p-6 text-sm text-red-500">Driver not found</div>;

  const d         = driver as any;
  const photoUrl  = d.photo ? `${API_BASE}${d.photo}` : null;
  const isGlobal  = d.icdv_id === null;
  const hasActive = (d.active_assignments ?? 0) > 0;
  const history: any[] = d.transfer_history ?? [];

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">

      {/* ── Header ───────────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <BackButton />
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-xl font-bold text-gray-900 dark:text-white">{driver.full_name}</h1>
              <StatusBadge status={driver.status} />
              {isGlobal && (
                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300">
                  Global
                </span>
              )}
              {hasActive && (
                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold bg-orange-100 text-orange-700 dark:bg-orange-500/20 dark:text-orange-300">
                  ⚡ Active Assignment
                </span>
              )}
            </div>
            <p className="text-sm text-gray-500 mt-0.5">License: {driver.license_number}</p>
          </div>
        </div>

        <div className="flex gap-2 flex-wrap">
          {/* Release button — only show if driver is tied to an ICDV */}
          {!isGlobal && (
            <button
              onClick={() => setShowRel(true)}
              className="px-4 py-2 text-sm font-medium bg-amber-500 hover:bg-amber-600 text-white rounded-lg"
            >
              Release from ICDV
            </button>
          )}
          <Link to={`/drivers/${id}/edit`}
            className="px-4 py-2 text-sm font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700">
            Edit
          </Link>
          <button onClick={() => setShowDel(true)}
            className="px-4 py-2 text-sm font-medium bg-red-600 text-white rounded-lg hover:bg-red-700">
            Delete
          </button>
        </div>
      </div>

      {/* Active assignment warning */}
      {hasActive && (
        <div className="rounded-lg bg-orange-50 dark:bg-orange-500/10 border border-orange-200 dark:border-orange-500/20 px-4 py-3 text-sm text-orange-700 dark:text-orange-400">
          ⚡ This driver currently has an <strong>active vehicle assignment</strong>. They cannot be released or deleted until the current transfer is completed.
        </div>
      )}

      {/* Global driver info */}
      {isGlobal && (
        <div className="rounded-lg bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/20 px-4 py-3 text-sm text-emerald-700 dark:text-emerald-400">
          ✓ This driver is <strong>globally available</strong> and can be assigned to operations across all ICDVs.
        </div>
      )}

      {/* ── Driver Info ───────────────────────────────────────────────────────── */}
      <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-gray-800/50">
          <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300">Driver Details</h2>
        </div>
        <div className="flex flex-col sm:flex-row gap-6 px-5 py-5">
          {/* Photo */}
          <div className="flex-shrink-0 flex flex-col items-center gap-2">
            <div className="w-28 h-28 rounded-full overflow-hidden border-2 border-gray-200 dark:border-gray-700 bg-gray-100 dark:bg-gray-800 flex items-center justify-center">
              {photoUrl ? (
                <img src={photoUrl} alt={driver.full_name} className="w-full h-full object-cover" />
              ) : (
                <svg className="w-12 h-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                    d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
              )}
            </div>
          </div>

          {/* Fields */}
          <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 flex-1">
            {([
              ['Full Name',          driver.full_name],
              ['ID Number',          d.id_number ?? '—'],
              ['License Number',     <span className="font-mono">{driver.license_number}</span>],
              ['Phone',              driver.phone ?? '—'],
              ['Email',              d.email ?? '—'],
              ['ICDV',               isGlobal ? <span className="text-emerald-600 font-medium">Global (unassigned)</span> : (d.icdv_name ?? `ID ${d.icdv_id}`)],
              ['Total Transfers',    d.total_transfers ?? 0],
              ['Active Assignment',  hasActive ? <span className="text-orange-600 font-semibold">Yes</span> : 'No'],
              ['Registered',         fmtDate(driver.created_at)],
              ['Notes',              d.notes ?? '—'],
            ] as [string, React.ReactNode][]).map(([label, value]) => (
              <div key={label} className="py-2.5 border-b border-gray-100 dark:border-gray-800 flex flex-col gap-0.5">
                <dt className="text-xs font-medium text-gray-400 uppercase tracking-wide">{label}</dt>
                <dd className="text-sm text-gray-800 dark:text-gray-200">{value}</dd>
              </div>
            ))}
          </dl>
        </div>
      </div>

      {/* ── Transfer History ──────────────────────────────────────────────────── */}
      <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-gray-800/50 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300">
            Transfer History
          </h2>
          <span className="text-xs text-gray-400">{history.length} record{history.length !== 1 ? 's' : ''}</span>
        </div>

        {history.length === 0 ? (
          <p className="px-5 py-8 text-sm text-gray-400 text-center">No transfer records for this driver.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 dark:bg-gray-800/50 border-b border-gray-100 dark:border-gray-800 text-xs text-gray-500 uppercase">
                <tr>
                  {['Chassis #', 'Vehicle', 'Batch', 'Vessel', 'ICDV', 'Transferred', 'Received', 'Status'].map(h => (
                    <th key={h} className="px-4 py-3 text-left font-medium whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                {history.map((t: any) => (
                  <tr key={t.transfer_id} className="hover:bg-gray-50 dark:hover:bg-gray-800/40">
                    <td className="px-4 py-3 font-mono text-xs font-semibold text-gray-800 dark:text-white">{t.chassis_number}</td>
                    <td className="px-4 py-3 text-gray-600 dark:text-gray-300 whitespace-nowrap">
                      {[t.brand, t.model].filter(Boolean).join(' ') || '—'}
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-gray-600 dark:text-gray-400 whitespace-nowrap">{t.batch_number || '—'}</td>
                    <td className="px-4 py-3 text-gray-600 dark:text-gray-300 whitespace-nowrap">{t.vessel_name || '—'}</td>
                    <td className="px-4 py-3 text-gray-600 dark:text-gray-300 whitespace-nowrap">{t.icdv_name || '—'}</td>
                    <td className="px-4 py-3 text-gray-500 dark:text-gray-400 whitespace-nowrap text-xs">{fmtDateTime(t.transferred_at)}</td>
                    <td className="px-4 py-3 text-gray-500 dark:text-gray-400 whitespace-nowrap text-xs">{t.received_at ? fmtDateTime(t.received_at) : '—'}</td>
                    <td className="px-4 py-3"><StatusBadge status={t.transfer_status} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── Release modal ─────────────────────────────────────────────────────── */}
      {showRel && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white dark:bg-gray-900 rounded-xl shadow-xl p-6 w-full max-w-sm mx-4">
            <h3 className="text-base font-semibold text-gray-900 dark:text-white mb-2">Release from ICDV</h3>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-5">
              <strong>{driver.full_name}</strong> will be detached from their current ICDV and become globally available for any operation.
            </p>
            <div className="flex gap-3 justify-end">
              <button onClick={() => setShowRel(false)}
                className="px-4 py-2 text-sm rounded-lg border border-gray-300 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800">
                Cancel
              </button>
              <button onClick={handleRelease} disabled={releasing}
                className="px-4 py-2 text-sm font-medium rounded-lg bg-amber-500 text-white hover:bg-amber-600 disabled:opacity-50">
                {releasing ? 'Releasing…' : 'Confirm Release'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Delete modal ──────────────────────────────────────────────────────── */}
      {showDel && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white dark:bg-gray-900 rounded-xl shadow-xl p-6 w-full max-w-sm mx-4">
            <h3 className="text-base font-semibold text-gray-900 dark:text-white mb-2">Delete Driver</h3>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-5">
              Are you sure you want to delete <strong>{driver.full_name}</strong>? This cannot be undone.
            </p>
            <div className="flex gap-3 justify-end">
              <button onClick={() => setShowDel(false)}
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
    </div>
  );
}
