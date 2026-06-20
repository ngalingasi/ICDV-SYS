// ─────────────────────────────────────────────────────────────────────────────
// frontend/src/pages/SuperAdmin/IcdvDetail.tsx
// Super admin: manage one ICDV tenant — edit info, view/create/transfer users.
// ─────────────────────────────────────────────────────────────────────────────
import { useEffect, useState } from 'react';
import { Link, useParams, useNavigate } from 'react-router';
import PageBreadCrumb from '../../components/common/PageBreadCrumb';
import { icdvsApi, usersApi } from '../../api';
import type { Icdv } from '../../types';

// Modal layer must sit above the app header (z-99999) — see AppHeader.tsx
const MODAL_BACKDROP_CLS = 'fixed inset-0 z-[100000] flex items-center justify-center bg-black/50 p-4';
const MODAL_PANEL_CLS    = 'relative z-[100001] bg-white dark:bg-gray-900 rounded-2xl shadow-xl p-6 w-full max-w-md mx-4';

const ROLE_OPTIONS = [
  ['operator',           'Operator'],
  ['supervisor',         'Supervisor'],
  ['admin',              'Admin'],
  ['system_admin',       'System Admin'],
  ['discharge_officer',  'Discharge Officer'],
  ['backoffice_officer', 'Backoffice Officer'],
  ['transfer_officer',   'Transfer Officer'],
  ['yard_officer',       'Yard Officer'],
  ['fuel_officer',       'Fuel Officer'],
  ['cashier',            'Cashier'],
];

function InfoRow({ label, value }: { label: string; value?: string | number | null }) {
  return (
    <div className="flex justify-between py-2.5 border-b border-gray-100 dark:border-gray-800 last:border-0">
      <span className="text-sm text-gray-500 dark:text-gray-400">{label}</span>
      <span className="text-sm font-medium text-gray-800 dark:text-white">{value ?? '—'}</span>
    </div>
  );
}

// ── Create User Modal (super_admin: any role for this ICDV) ──────────────────
function CreateUserModal({ icdvId, onClose, onCreated }: {
  icdvId: number; onClose: () => void; onCreated: () => void;
}) {
  const [form, setForm] = useState({ full_name: '', username: '', email: '', mobile: '', password: '', role: 'admin' });
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');

  const handleSubmit = async () => {
    setSaving(true); setErr('');
    try {
      await usersApi.create({ ...form, icdv_id: icdvId });
      onCreated();
      onClose();
    } catch (e: any) {
      setErr(e?.response?.data?.message || 'Failed to create user');
    } finally { setSaving(false); }
  };

  const InputCls = "w-full rounded-lg border border-gray-300 dark:border-gray-700 px-3 py-2.5 text-sm bg-white dark:bg-gray-900 dark:text-white focus:outline-none focus:border-brand-400";
  const LabelCls = "block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5";

  return (
    <div className={MODAL_BACKDROP_CLS}>
      <div className={MODAL_PANEL_CLS}>
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-5">Create User for this ICDV</h3>
        {err && <div className="mb-4 p-2.5 rounded-lg bg-red-50 text-red-700 text-sm dark:bg-red-500/10 dark:text-red-400">{err}</div>}
        <div className="space-y-4">
          <div><label className={LabelCls}>Role *</label>
            <select value={form.role} onChange={e => setForm(f => ({ ...f, role: e.target.value }))} className={InputCls}>
              {ROLE_OPTIONS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
          </div>
          <div><label className={LabelCls}>Full Name *</label>
            <input type="text" value={form.full_name} onChange={e => setForm(f => ({...f, full_name: e.target.value}))} className={InputCls} /></div>
          <div><label className={LabelCls}>Username *</label>
            <input type="text" value={form.username} onChange={e => setForm(f => ({...f, username: e.target.value}))} className={InputCls} /></div>
          <div><label className={LabelCls}>Email *</label>
            <input type="email" value={form.email} onChange={e => setForm(f => ({...f, email: e.target.value}))} className={InputCls} /></div>
          <div><label className={LabelCls}>Mobile</label>
            <input type="tel" value={form.mobile} onChange={e => setForm(f => ({...f, mobile: e.target.value}))} className={InputCls} /></div>
          <div><label className={LabelCls}>Temporary Password *</label>
            <input type="password" value={form.password} onChange={e => setForm(f => ({...f, password: e.target.value}))} className={InputCls} /></div>
        </div>
        <div className="mt-6 flex gap-3">
          <button onClick={onClose} disabled={saving}
            className="flex-1 px-4 py-2 text-sm rounded-lg border border-gray-300 dark:border-gray-700 text-gray-700 dark:text-gray-200">Cancel</button>
          <button onClick={handleSubmit} disabled={saving}
            className="flex-1 px-4 py-2 text-sm rounded-lg bg-brand-500 text-white hover:bg-brand-600 disabled:opacity-50">
            {saving ? 'Creating…' : 'Create User'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Transfer User Modal (move a user to a different ICDV) ────────────────────
function TransferUserModal({ user, currentIcdvId, onClose, onTransferred }: {
  user: any; currentIcdvId: number; onClose: () => void; onTransferred: () => void;
}) {
  const [icdvList, setIcdvList] = useState<any[]>([]);
  const [targetId, setTargetId] = useState('');
  const [saving,   setSaving]   = useState(false);
  const [err,      setErr]      = useState('');

  useEffect(() => {
    icdvsApi.list({ limit: 200, is_active: 1 }).then(r => {
      setIcdvList((r.data.results ?? []).filter((i: any) => i.icdv_id !== currentIcdvId));
    }).catch(() => setErr('Failed to load ICDV list'));
  }, [currentIcdvId]);

  const handleTransfer = async () => {
    if (!targetId) { setErr('Select a destination ICDV'); return; }
    setSaving(true); setErr('');
    try {
      await usersApi.update(user.user_id, { icdv_id: Number(targetId) });
      onTransferred();
      onClose();
    } catch (e: any) {
      setErr(e?.response?.data?.message || 'Transfer failed');
    } finally { setSaving(false); }
  };

  return (
    <div className={MODAL_BACKDROP_CLS}>
      <div className={MODAL_PANEL_CLS}>
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-1">Transfer User</h3>
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-5">
          Move <strong className="text-gray-700 dark:text-gray-300">{user.full_name}</strong> to a different ICDV.
        </p>
        {err && <div className="mb-4 p-2.5 rounded-lg bg-red-50 text-red-700 text-sm dark:bg-red-500/10 dark:text-red-400">{err}</div>}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Destination ICDV *</label>
          <select value={targetId} onChange={e => setTargetId(e.target.value)}
            className="w-full rounded-lg border border-gray-300 dark:border-gray-700 px-3 py-2.5 text-sm bg-white dark:bg-gray-900 dark:text-white focus:outline-none focus:border-brand-400">
            <option value="">Select ICDV…</option>
            {icdvList.map(i => <option key={i.icdv_id} value={i.icdv_id}>{i.name}</option>)}
          </select>
        </div>
        <div className="mt-6 flex gap-3">
          <button onClick={onClose} disabled={saving}
            className="flex-1 px-4 py-2 text-sm rounded-lg border border-gray-300 dark:border-gray-700 text-gray-700 dark:text-gray-200">Cancel</button>
          <button onClick={handleTransfer} disabled={saving}
            className="flex-1 px-4 py-2 text-sm rounded-lg bg-brand-500 text-white hover:bg-brand-600 disabled:opacity-50">
            {saving ? 'Transferring…' : 'Transfer User'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────
export default function IcdvDetail() {
  const { icdvId } = useParams<{ icdvId: string }>();
  const navigate = useNavigate();

  const [icdv,          setIcdv]          = useState<Icdv | null>(null);
  const [users,         setUsers]         = useState<any[]>([]);
  const [loading,       setLoading]       = useState(true);
  const [error,         setError]         = useState('');
  const [showModal,     setShowModal]     = useState(false);
  const [transferUser,  setTransferUser]  = useState<any | null>(null);
  const [deleting,      setDeleting]      = useState(false);
  const [showConfirm,   setShowConfirm]   = useState(false);

  const load = async () => {
    if (!icdvId) return;
    setLoading(true);
    try {
      const [icdvRes, usersRes] = await Promise.all([
        icdvsApi.get(Number(icdvId)),
        icdvsApi.getUsers(Number(icdvId), { limit: 50 }),
      ]);
      setIcdv(icdvRes.data);
      setUsers(usersRes.data.results ?? []);
    } catch { setError('Failed to load ICDV'); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, [icdvId]); // eslint-disable-line

  const toggleActive = async () => {
    if (!icdv || !icdvId) return;
    try {
      const updated = await icdvsApi.update(Number(icdvId), { is_active: icdv.is_active ? 0 : 1 });
      setIcdv(updated.data);
    } catch (e: any) { setError(e?.response?.data?.message || 'Update failed'); }
  };

  const handleDelete = async () => {
    if (!icdvId) return;
    setDeleting(true);
    try {
      await icdvsApi.delete(Number(icdvId));
      navigate('/super-admin/icdvs');
    } catch (e: any) {
      setError(e?.response?.data?.message || 'Delete failed');
      setShowConfirm(false);
    } finally { setDeleting(false); }
  };

  if (loading) return (
    <div className="p-6">
      <div className="h-8 w-48 bg-gray-200 dark:bg-gray-700 rounded animate-pulse mb-6" />
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {[1,2].map(i => <div key={i} className="h-52 bg-gray-200 dark:bg-gray-700 rounded-xl animate-pulse" />)}
      </div>
    </div>
  );

  if (error && !icdv) return <div className="p-6"><div className="p-4 rounded-xl bg-red-50 text-red-700">{error}</div></div>;
  if (!icdv) return null;

  return (
    <div className="p-4 sm:p-6">
      <PageBreadCrumb pageTitle={icdv.name} />

      {/* Super admin banner */}
      <div className="mb-4 p-3 rounded-xl bg-purple-50 dark:bg-purple-500/10 border border-purple-200 dark:border-purple-500/20 text-purple-700 dark:text-purple-400 text-xs">
        Super Admin · Platform Management
      </div>

      {/* Header */}
      <div className="mb-6 flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{icdv.name}</h1>
            <span className="font-mono text-sm text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-gray-800 px-2 py-0.5 rounded">{icdv.code}</span>
            <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${
              icdv.is_active ? 'bg-green-50 text-green-700 dark:bg-green-500/10 dark:text-green-400'
                             : 'bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400'
            }`}>{icdv.is_active ? 'Active' : 'Inactive'}</span>
          </div>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{icdv.city}, {icdv.country}</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Link to={`/super-admin/icdvs/${icdvId}/edit`}
            className="px-4 py-2 text-sm font-medium rounded-lg border border-gray-300 dark:border-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
            Edit
          </Link>
          <button onClick={toggleActive}
            className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
              icdv.is_active
                ? 'bg-yellow-50 text-yellow-700 hover:bg-yellow-100 dark:bg-yellow-500/10 dark:text-yellow-400'
                : 'bg-green-50 text-green-700 hover:bg-green-100 dark:bg-green-500/10 dark:text-green-400'
            }`}>
            {icdv.is_active ? 'Deactivate' : 'Activate'}
          </button>
          <button onClick={() => setShowConfirm(true)}
            className="px-4 py-2 text-sm font-medium rounded-lg bg-red-50 text-red-600 hover:bg-red-100 dark:bg-red-500/10 dark:text-red-400 transition-colors">
            Delete
          </button>
        </div>
      </div>

      {error && <div className="mb-4 p-3 rounded-lg bg-red-50 text-red-700 text-sm">{error}</div>}

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
        {[
          { label: 'Users',    value: icdv.user_count    ?? 0 },
          { label: 'Vessels',  value: icdv.vessel_count  ?? 0 },
          { label: 'Vehicles', value: icdv.vehicle_count ?? 0 },
          { label: 'Drivers',  value: icdv.driver_count  ?? 0 },
        ].map(s => (
          <div key={s.label} className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-4 text-center">
            <div className="text-2xl font-bold text-gray-900 dark:text-white">{s.value}</div>
            <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">{s.label}</div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* ICDV Info */}
        <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-5">
          <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wide mb-4">ICDV Information</h2>
          <InfoRow label="Name"    value={icdv.name} />
          <InfoRow label="Code"    value={icdv.code} />
          <InfoRow label="Email"   value={icdv.email} />
          <InfoRow label="Phone"   value={icdv.phone} />
          <InfoRow label="City"    value={icdv.city} />
          <InfoRow label="Country" value={icdv.country} />
          <InfoRow label="TIN"     value={icdv.tin} />
          <InfoRow label="VRN"     value={icdv.vrn} />
          <InfoRow label="Status"  value={icdv.is_active ? 'Active' : 'Inactive'} />
        </div>

        {/* Users panel — scoped to THIS ICDV only */}
        <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wide">
              Users <span className="text-gray-400 font-normal normal-case">({users.length})</span>
            </h2>
            <button onClick={() => setShowModal(true)}
              className="text-xs text-brand-500 hover:text-brand-600 font-medium">
              + Create User
            </button>
          </div>
          {users.length > 0 ? (
            <div className="space-y-2">
              {users.map(u => (
                <div key={u.user_id} className="flex items-center justify-between gap-3 p-3 rounded-lg border border-gray-100 dark:border-gray-800">
                  <div className="min-w-0">
                    <div className="text-sm font-medium text-gray-800 dark:text-white truncate">{u.full_name}</div>
                    <div className="text-xs text-gray-500 dark:text-gray-400 truncate">{u.email}</div>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium capitalize ${
                      u.role === 'admin'   ? 'bg-purple-50 text-purple-700 dark:bg-purple-500/10 dark:text-purple-400' :
                      u.role === 'manager' ? 'bg-blue-50 text-blue-700 dark:bg-blue-500/10 dark:text-blue-400' :
                      'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400'
                    }`}>{u.role}</span>
                    <button onClick={() => setTransferUser(u)}
                      title="Transfer to another ICDV"
                      className="text-xs text-gray-400 hover:text-brand-500 dark:hover:text-brand-400 transition-colors">
                      Transfer
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="py-6 text-center text-gray-400 text-sm">
              No users yet.{' '}
              <button onClick={() => setShowModal(true)} className="text-brand-500 hover:text-brand-600">Create a user</button>
            </div>
          )}
        </div>
      </div>

      {showModal && (
        <CreateUserModal
          icdvId={Number(icdvId)}
          onClose={() => setShowModal(false)}
          onCreated={load}
        />
      )}

      {transferUser && (
        <TransferUserModal
          user={transferUser}
          currentIcdvId={Number(icdvId)}
          onClose={() => setTransferUser(null)}
          onTransferred={load}
        />
      )}

      {showConfirm && (
        <div className={MODAL_BACKDROP_CLS}>
          <div className={`${MODAL_PANEL_CLS} max-w-sm`}>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">Delete ICDV?</h3>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">
              Delete <strong>{icdv.name}</strong>? This cannot be undone. All users must be removed first.
            </p>
            <div className="flex gap-3">
              <button onClick={() => setShowConfirm(false)} disabled={deleting}
                className="flex-1 px-4 py-2 text-sm rounded-lg border border-gray-300 dark:border-gray-700 text-gray-700 dark:text-gray-200">Cancel</button>
              <button onClick={handleDelete} disabled={deleting}
                className="flex-1 px-4 py-2 text-sm rounded-lg bg-red-600 text-white hover:bg-red-700 disabled:opacity-50">
                {deleting ? 'Deleting…' : 'Delete ICDV'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
