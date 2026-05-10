import { useEffect, useState, useCallback } from 'react';
import { usersApi } from '../../api';
import type { UserRecord, PaginatedResponse } from '../../types';
import Modal from '../../components/tpfcs/Modal';
import { FormInput, FormSelect } from '../../components/tpfcs/FormField';
import { useAuth } from '../../store/authStore';
import { toast } from '../../components/tpfcs/Toast';

// ─── All sub-components defined OUTSIDE to prevent remount → focus loss ───────

interface Skill { skill_id: number; name: string; category: string; }

function Avatar({ name, size = 'md' }: { name: string; size?: 'sm' | 'md' }) {
  const initials = name.split(' ').slice(0, 2).map(n => n[0]).join('').toUpperCase();
  const colors   = ['bg-blue-500','bg-purple-500','bg-green-500','bg-orange-500','bg-pink-500','bg-teal-500'];
  const color    = colors[name.charCodeAt(0) % colors.length];
  const sz       = size === 'sm' ? 'w-8 h-8 text-xs' : 'w-10 h-10 text-sm';
  return (
    <div className={`${sz} ${color} rounded-full flex items-center justify-center text-white font-semibold flex-shrink-0`}>
      {initials}
    </div>
  );
}

const ROLE_STYLES: Record<string, string> = {
  admin:   'bg-purple-100 text-purple-700 dark:bg-purple-500/20 dark:text-purple-400',
  manager: 'bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-400',
  user:    'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400',
};

const SKILL_CATEGORIES = ['Technical','Managerial','Field','Finance','IT','Legal'];

function SkillPicker({ allSkills, selected, onChange }: {
  allSkills: Skill[];
  selected: number[];
  onChange: (ids: number[]) => void;
}) {
  const toggle = (id: number) =>
    onChange(selected.includes(id) ? selected.filter(x => x !== id) : [...selected, id]);

  return (
    <div className="space-y-3">
      {SKILL_CATEGORIES.map(cat => {
        const catSkills = allSkills.filter(s => s.category === cat);
        if (!catSkills.length) return null;
        return (
          <div key={cat}>
            <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2">{cat}</p>
            <div className="flex flex-wrap gap-1.5">
              {catSkills.map(s => (
                <button key={s.skill_id} type="button" onClick={() => toggle(s.skill_id)}
                  className={`px-2.5 py-1 text-xs rounded-full border transition-colors ${
                    selected.includes(s.skill_id)
                      ? 'bg-brand-500 text-white border-brand-500'
                      : 'border-gray-300 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:border-brand-400'
                  }`}>
                  {s.name}
                </button>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function UserForm({ user, allSkills, onSaved, onClose }: {
  user?: UserRecord & { skills?: Skill[] };
  allSkills: Skill[];
  onSaved: () => void;
  onClose: () => void;
}) {
  const isEdit = !!user;
  const [form, setForm] = useState({
    full_name: user?.full_name ?? '',
    username:  user?.username  ?? '',
    email:     user?.email     ?? '',
    mobile:    user?.mobile    ?? '',
    gender:    user?.gender    ?? 'male',
    role:      user?.role      ?? 'user',
    status:    user?.status    ?? 'active',
    password:  '',
  });
  const [selectedSkills, setSelectedSkills] = useState<number[]>(
    user?.skills?.map(s => s.skill_id) ?? []
  );
  const [saving, setSaving] = useState(false);
  const [error,  setError]  = useState('');

  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }));

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.full_name.trim() || !form.username.trim()) { setError('Full name and username are required'); return; }
    if (!isEdit && !form.password.trim()) { setError('Password is required for new users'); return; }
    setSaving(true); setError('');
    try {
      let userId = user?.user_id;
      if (isEdit) {
        const payload: any = { full_name: form.full_name, email: form.email, mobile: form.mobile, gender: form.gender, role: form.role, status: form.status };
        await usersApi.update(user!.user_id, payload);
      } else {
        const res = await usersApi.create({ ...form });
        userId = res.data.user_id;
      }
      // Always update skills
      if (userId) {
        await usersApi.updateSkills(userId, selectedSkills);
      }
      toast.success(isEdit ? 'User updated' : 'User created');
      onSaved(); onClose();
    } catch (err: any) {
      const m = err?.response?.data?.message ?? 'Failed to save user';
      toast.error('Save failed', m);
      setError(m);
    } finally { setSaving(false); }
  };

  return (
    <form onSubmit={save} className="space-y-4">
      {error && <p className="text-sm text-red-500 bg-red-50 dark:bg-red-500/10 p-3 rounded-lg">{error}</p>}

      <FormInput label="Full Name" required value={form.full_name} onChange={e => set('full_name', e.target.value)} placeholder="e.g. John Doe" />

      <div className="grid grid-cols-2 gap-3">
        <FormInput label="Username" required value={form.username} onChange={e => set('username', e.target.value)} placeholder="johndoe" disabled={isEdit} />
        <FormInput label="Email" type="email" value={form.email} onChange={e => set('email', e.target.value)} placeholder="john@tpfcs.go.tz" />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <FormInput label="Mobile" value={form.mobile} onChange={e => set('mobile', e.target.value)} placeholder="+255712345678" />
        <FormSelect label="Gender" value={form.gender} onChange={e => set('gender', e.target.value)}>
          <option value="male">Male</option>
          <option value="female">Female</option>
        </FormSelect>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <FormSelect label="Role" required value={form.role} onChange={e => set('role', e.target.value)}>
          <option value="user">User</option>
          <option value="manager">Manager</option>
          <option value="admin">Admin</option>
        </FormSelect>
        {isEdit && (
          <FormSelect label="Status" value={form.status} onChange={e => set('status', e.target.value)}>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </FormSelect>
        )}
      </div>

      {!isEdit && (
        <FormInput label="Password" required type="password" value={form.password} onChange={e => set('password', e.target.value)} placeholder="Temporary password (min 8 chars)" />
      )}

      {allSkills.length > 0 && (
        <div className="pt-2 border-t border-gray-100 dark:border-gray-800">
          <p className="text-xs font-medium text-gray-600 dark:text-gray-400 mb-3">
            Skills <span className="font-normal text-gray-400">({selectedSkills.length} selected)</span>
          </p>
          <SkillPicker allSkills={allSkills} selected={selectedSkills} onChange={setSelectedSkills} />
        </div>
      )}

      <div className="flex justify-end gap-3 pt-2">
        <button type="button" onClick={onClose} className="px-4 py-2 text-sm border border-gray-300 dark:border-gray-700 rounded-lg text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800">Cancel</button>
        <button type="submit" disabled={saving} className="px-5 py-2 text-sm font-medium bg-brand-500 text-white rounded-lg hover:bg-brand-600 disabled:opacity-50">
          {saving ? 'Saving...' : isEdit ? 'Update User' : 'Create User'}
        </button>
      </div>
    </form>
  );
}

function ResetPasswordForm({ user, onClose }: { user: UserRecord; onClose: () => void }) {
  const [saving, setSaving] = useState(false);
  const [done,   setDone]   = useState(false);

  const handleReset = async () => {
    setSaving(true);
    try {
      await usersApi.update(user.user_id, { must_change_password: 1 } as any);
      setDone(true);
    } finally { setSaving(false); }
  };

  if (done) return (
    <div className="text-center py-4 space-y-3">
      <div className="w-12 h-12 bg-green-100 dark:bg-green-500/20 rounded-full flex items-center justify-center mx-auto">
        <svg className="w-6 h-6 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
      </div>
      <p className="text-sm text-gray-600 dark:text-gray-400">User will be prompted to change password on next login.</p>
      <button onClick={onClose} className="px-4 py-2 text-sm bg-brand-500 text-white rounded-lg hover:bg-brand-600">Close</button>
    </div>
  );

  return (
    <div className="space-y-4">
      <p className="text-sm text-gray-500 dark:text-gray-400">
        This will flag <strong className="text-gray-700 dark:text-gray-300">{user.full_name}</strong> to change their password on next login.
      </p>
      <div className="flex justify-end gap-3">
        <button onClick={onClose} className="px-4 py-2 text-sm border border-gray-300 dark:border-gray-700 rounded-lg text-gray-600">Cancel</button>
        <button onClick={handleReset} disabled={saving} className="px-4 py-2 text-sm bg-orange-500 text-white rounded-lg hover:bg-orange-600 disabled:opacity-50">
          {saving ? 'Processing...' : 'Force Password Reset'}
        </button>
      </div>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function UsersPage() {
  const { user: me }        = useAuth();
  const [data,      setData]     = useState<PaginatedResponse<UserRecord & { skills?: Skill[] }> | null>(null);
  const [allSkills, setAllSkills]= useState<Skill[]>([]);
  const [loading,   setLoading]  = useState(true);
  const [search,    setSearch]   = useState('');
  const [roleFilter,setRoleFilter]= useState('');
  const [page,      setPage]     = useState(1);
  const [modal,     setModal]    = useState<'create' | 'edit' | 'delete' | 'reset' | null>(null);
  const [selected,  setSelected] = useState<(UserRecord & { skills?: Skill[] }) | null>(null);
  const [deleting,  setDeleting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await usersApi.list({ page, limit: 12, search: search || undefined, role: roleFilter || undefined });
      setData(res.data as any);
    } finally { setLoading(false); }
  }, [page, search, roleFilter]);

  useEffect(() => { load(); }, [load]);

  // Load skills once
  useEffect(() => {
    usersApi.getSkills().then(r => setAllSkills(r.data as any)).catch(() => {});
  }, []);

  const handleDelete = async () => {
    if (!selected) return;
    setDeleting(true);
    try {
      await usersApi.delete(selected.user_id);
      toast.success('User deactivated');
      await load(); setModal(null);
    } finally { setDeleting(false); }
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-800 dark:text-white">Users</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">{data?.totalResults ?? 0} total users</p>
        </div>
        <button onClick={() => { setSelected(null); setModal('create'); }}
          className="flex items-center gap-2 px-4 py-2 text-sm font-medium bg-brand-500 text-white rounded-lg hover:bg-brand-600">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
          New User
        </button>
      </div>

      <div className="flex gap-3 flex-wrap">
        <input type="text" placeholder="Search name, username, email..." value={search}
          onChange={e => { setSearch(e.target.value); setPage(1); }}
          className="flex-1 min-w-[200px] rounded-lg border border-gray-300 dark:border-gray-700 px-3 py-2 text-sm dark:bg-gray-900 dark:text-white focus:outline-none focus:border-brand-400" />
        <select value={roleFilter} onChange={e => { setRoleFilter(e.target.value); setPage(1); }}
          className="rounded-lg border border-gray-300 dark:border-gray-700 px-3 py-2 text-sm dark:bg-gray-900 dark:text-white focus:outline-none focus:border-brand-400">
          <option value="">All Roles</option>
          <option value="admin">Admin</option>
          <option value="manager">Manager</option>
          <option value="user">User</option>
        </select>
      </div>

      <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
                <th className="px-4 py-3 text-left font-medium text-gray-600 dark:text-gray-400">User</th>
                <th className="px-4 py-3 text-left font-medium text-gray-600 dark:text-gray-400">Username</th>
                <th className="px-4 py-3 text-left font-medium text-gray-600 dark:text-gray-400">Role</th>
                <th className="px-4 py-3 text-left font-medium text-gray-600 dark:text-gray-400">Status</th>
                <th className="px-4 py-3 text-right font-medium text-gray-600 dark:text-gray-400">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
              {loading ? (
                Array.from({ length: 6 }).map((_, i) => (
                  <tr key={i} className="animate-pulse">
                    <td className="px-4 py-3"><div className="flex items-center gap-3"><div className="w-10 h-10 bg-gray-200 dark:bg-gray-700 rounded-full" /><div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-32" /></div></td>
                    {[1,2,3,4].map(j => <td key={j} className="px-4 py-3"><div className="h-4 bg-gray-100 dark:bg-gray-800 rounded w-20" /></td>)}
                  </tr>
                ))
              ) : data?.results.length === 0 ? (
                <tr><td colSpan={5} className="px-4 py-12 text-center text-gray-400">No users found</td></tr>
              ) : data?.results.map(u => (
                <tr key={u.user_id} className="hover:bg-gray-50 dark:hover:bg-gray-800/40 transition-colors">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <Avatar name={u.full_name} />
                      <div>
                        <p className="font-medium text-gray-800 dark:text-white">{u.full_name}</p>
                        {u.email && <p className="text-xs text-gray-400">{u.email}</p>}
                        {(u as any).skills?.length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-1">
                            {(u as any).skills.slice(0, 3).map((s: Skill) => (
                              <span key={s.skill_id} className="px-1.5 py-0.5 text-[10px] rounded bg-brand-50 dark:bg-brand-500/10 text-brand-600 dark:text-brand-400">
                                {s.name}
                              </span>
                            ))}
                            {(u as any).skills.length > 3 && (
                              <span className="text-[10px] text-gray-400">+{(u as any).skills.length - 3} more</span>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-gray-600 dark:text-gray-400">{u.username}</td>
                  <td className="px-4 py-3">
                    <span className={`px-2.5 py-0.5 text-xs font-medium rounded-full ${ROLE_STYLES[u.role] ?? 'bg-gray-100 text-gray-600'}`}>
                      {u.role}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`px-2.5 py-0.5 text-xs font-medium rounded-full ${u.status === 'active' ? 'bg-green-100 text-green-700 dark:bg-green-500/20 dark:text-green-400' : 'bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-400'}`}>
                      {u.status}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-1">
                      <button onClick={() => { setSelected(u as any); setModal('edit'); }}
                        className="px-2.5 py-1 text-xs text-brand-600 dark:text-brand-400 hover:bg-brand-50 dark:hover:bg-brand-500/10 rounded-md">Edit</button>
                      <button onClick={() => { setSelected(u as any); setModal('reset'); }}
                        className="px-2.5 py-1 text-xs text-orange-600 dark:text-orange-400 hover:bg-orange-50 dark:hover:bg-orange-500/10 rounded-md">Reset PW</button>
                      {me?.user_id !== u.user_id && (
                        <button onClick={() => { setSelected(u as any); setModal('delete'); }}
                          className="px-2.5 py-1 text-xs text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-md">Delete</button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {data && data.totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-gray-200 dark:border-gray-700">
            <p className="text-sm text-gray-500 dark:text-gray-400">Page {data.page} of {data.totalPages}</p>
            <div className="flex gap-2">
              <button onClick={() => setPage(p => p - 1)} disabled={page === 1}
                className="px-3 py-1.5 text-sm rounded-lg border border-gray-300 dark:border-gray-700 disabled:opacity-40">Previous</button>
              <button onClick={() => setPage(p => p + 1)} disabled={page === data.totalPages}
                className="px-3 py-1.5 text-sm rounded-lg border border-gray-300 dark:border-gray-700 disabled:opacity-40">Next</button>
            </div>
          </div>
        )}
      </div>

      <Modal isOpen={modal === 'create'} onClose={() => setModal(null)} title="Create New User" size="md">
        <UserForm allSkills={allSkills} onSaved={load} onClose={() => setModal(null)} />
      </Modal>

      <Modal isOpen={modal === 'edit' && !!selected} onClose={() => setModal(null)} title="Edit User" size="md">
        {selected && <UserForm user={selected} allSkills={allSkills} onSaved={load} onClose={() => setModal(null)} />}
      </Modal>

      <Modal isOpen={modal === 'reset' && !!selected} onClose={() => setModal(null)} title="Reset Password" size="sm">
        {selected && <ResetPasswordForm user={selected} onClose={() => setModal(null)} />}
      </Modal>

      <Modal isOpen={modal === 'delete' && !!selected} onClose={() => setModal(null)} title="Deactivate User" size="sm">
        <div className="space-y-4">
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Deactivate <strong className="text-gray-800 dark:text-white">"{selected?.full_name}"</strong>? They will no longer be able to log in.
          </p>
          <div className="flex justify-end gap-3">
            <button onClick={() => setModal(null)} className="px-4 py-2 text-sm border border-gray-300 dark:border-gray-700 rounded-lg text-gray-600">Cancel</button>
            <button onClick={handleDelete} disabled={deleting} className="px-4 py-2 text-sm bg-red-500 text-white rounded-lg hover:bg-red-600 disabled:opacity-50">
              {deleting ? 'Deactivating...' : 'Deactivate'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
