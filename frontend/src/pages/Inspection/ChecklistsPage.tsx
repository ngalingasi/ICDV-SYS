import { useEffect, useState, useCallback } from 'react';
import { inspectionApi } from '../../api';
import Modal from '../../components/tpfcs/Modal';
import { FormInput, FormSelect, FormTextArea } from '../../components/tpfcs/FormField';
import { toast } from '../../components/tpfcs/Toast';
import { useAuth } from '../../store/authStore';

const TYPE_LABELS: Record<string,string> = { FA: 'Factory Assessment', GRI: 'Goods Receiving' };
const RESPONSE_TYPES = ['pass_fail','yes_no','text','number','photo','file'];
const RESPONSE_LABELS: Record<string,string> = {
  pass_fail:'Pass/Fail', yes_no:'Yes/No', text:'Text', number:'Number', photo:'Photo Upload', file:'File Upload'
};

let _uid = 0; const uid = () => `ci_${++_uid}`;

interface CItem { _key:string; item_title:string; item_description:string; response_type:string; is_required:boolean; requires_comment:boolean; item_order:number; }

function ChecklistForm({ checklist, onSaved, onClose }: { checklist?: any; onSaved:()=>void; onClose:()=>void }) {
  const isEdit = !!checklist;
  const [name,   setName]   = useState(checklist?.checklist_name  ?? '');
  const [type,   setType]   = useState(checklist?.inspection_type ?? 'FA');
  const [desc,   setDesc]   = useState(checklist?.description     ?? '');
  const [status, setStatus] = useState(checklist?.status          ?? 'active');
  const [items,  setItems]  = useState<CItem[]>(
    checklist?.items?.length
      ? checklist.items.map((i: any) => ({ _key: uid(), ...i, is_required: !!i.is_required, requires_comment: !!i.requires_comment }))
      : [{ _key: uid(), item_title:'', item_description:'', response_type:'pass_fail', is_required:true, requires_comment:false, item_order:0 }]
  );
  const [saving, setSaving] = useState(false);
  const [error,  setError]  = useState('');

  const addItem = () => setItems(p => [...p, { _key: uid(), item_title:'', item_description:'', response_type:'pass_fail', is_required:true, requires_comment:false, item_order: p.length }]);
  const removeItem = (key: string) => setItems(p => p.filter(i => i._key !== key));
  const setItem = (key: string, field: keyof CItem, val: any) =>
    setItems(p => p.map(i => i._key === key ? { ...i, [field]: val } : i));

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) { setError('Checklist name required'); return; }
    if (!items.some(i => i.item_title.trim())) { setError('At least one item with a title required'); return; }
    setSaving(true); setError('');
    try {
      const payload = {
        checklist_name: name, inspection_type: type, description: desc || null, status,
        items: items.filter(i => i.item_title.trim()).map((i, idx) => ({
          item_title: i.item_title, item_description: i.item_description || null,
          response_type: i.response_type, is_required: i.is_required,
          requires_comment: i.requires_comment, item_order: idx,
        })),
      };
      if (isEdit) await inspectionApi.updateChecklist(checklist.checklist_id, payload);
      else        await inspectionApi.createChecklist(payload);
      toast.success(isEdit ? 'Checklist updated' : 'Checklist created');
      onSaved(); onClose();
    } catch (err: any) {
      const m = err?.response?.data?.message ?? 'Failed'; setError(m); toast.error('Failed', m);
    } finally { setSaving(false); }
  };

  return (
    <form onSubmit={save} className="space-y-4">
      {error && <p className="text-sm text-red-500 bg-red-50 dark:bg-red-500/10 p-3 rounded-lg">{error}</p>}
      <div className="grid grid-cols-2 gap-3">
        <FormInput label="Checklist Name" required value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Pre-shipment Quality Check" />
        <FormSelect label="Inspection Type" value={type} onChange={e => setType(e.target.value)}>
          <option value="FA">Factory Assessment (FA)</option>
          <option value="GRI">Goods Receiving (GRI)</option>
        </FormSelect>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <FormTextArea label="Description" value={desc} onChange={e => setDesc(e.target.value)} placeholder="Checklist purpose..." />
        <FormSelect label="Status" value={status} onChange={e => setStatus(e.target.value)}>
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
        </FormSelect>
      </div>

      {/* Checklist items */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <p className="text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wide">Checklist Items</p>
          <button type="button" onClick={addItem} className="flex items-center gap-1 text-xs text-brand-500 hover:text-brand-600">
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
            Add Item
          </button>
        </div>
        <div className="space-y-3 max-h-72 overflow-y-auto pr-1">
          {items.map((item, idx) => (
            <div key={item._key} className="p-3 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 relative">
              <div className="flex items-center gap-1 mb-2">
                <span className="text-xs text-gray-400 font-medium w-5">{idx+1}.</span>
                <input value={item.item_title} onChange={e => setItem(item._key, 'item_title', e.target.value)}
                  placeholder="Item title..." required
                  className="flex-1 rounded border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 px-2 py-1.5 text-xs text-gray-800 dark:text-white focus:outline-none focus:border-brand-400" />
                <select value={item.response_type} onChange={e => setItem(item._key, 'response_type', e.target.value)}
                  className="rounded border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 px-2 py-1.5 text-xs text-gray-800 dark:text-white focus:outline-none">
                  {RESPONSE_TYPES.map(rt => <option key={rt} value={rt}>{RESPONSE_LABELS[rt]}</option>)}
                </select>
                {items.length > 1 && (
                  <button type="button" onClick={() => removeItem(item._key)} className="text-red-400 hover:text-red-600 ml-1">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                  </button>
                )}
              </div>
              <div className="flex items-center gap-4 ml-5">
                <label className="flex items-center gap-1.5 text-xs text-gray-500 cursor-pointer">
                  <input type="checkbox" checked={item.is_required} onChange={e => setItem(item._key, 'is_required', e.target.checked)} className="rounded" />
                  Required
                </label>
                <label className="flex items-center gap-1.5 text-xs text-gray-500 cursor-pointer">
                  <input type="checkbox" checked={item.requires_comment} onChange={e => setItem(item._key, 'requires_comment', e.target.checked)} className="rounded" />
                  Requires comment
                </label>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="flex justify-end gap-3 pt-2">
        <button type="button" onClick={onClose} className="px-4 py-2 text-sm border border-gray-300 dark:border-gray-700 rounded-lg text-gray-600 dark:text-gray-400">Cancel</button>
        <button type="submit" disabled={saving} className="px-5 py-2 text-sm font-medium bg-brand-500 text-white rounded-lg hover:bg-brand-600 disabled:opacity-50">
          {saving ? 'Saving...' : isEdit ? 'Update' : 'Create'}
        </button>
      </div>
    </form>
  );
}

function DeleteConfirm({ name, onConfirm, onCancel, loading }: { name:string; onConfirm:()=>void; onCancel:()=>void; loading:boolean }) {
  return (
    <div className="space-y-4">
      <p className="text-sm text-gray-600 dark:text-gray-400">Delete checklist <strong className="text-gray-800 dark:text-white">"{name}"</strong>?</p>
      <div className="flex justify-end gap-3">
        <button onClick={onCancel} className="px-4 py-2 text-sm border border-gray-300 dark:border-gray-700 rounded-lg text-gray-600">Cancel</button>
        <button onClick={onConfirm} disabled={loading} className="px-4 py-2 text-sm bg-red-500 text-white rounded-lg hover:bg-red-600 disabled:opacity-50">
          {loading ? 'Deleting...' : 'Delete'}
        </button>
      </div>
    </div>
  );
}

export default function ChecklistsPage() {
  const { user } = useAuth();
  const canManage = ['admin','manager'].includes(user?.role ?? '');
  const [data,     setData]     = useState<any>(null);
  const [loading,  setLoading]  = useState(true);
  const [search,   setSearch]   = useState('');
  const [typeF,    setTypeF]    = useState('');
  const [statusF,  setStatusF]  = useState('');
  const [page,     setPage]     = useState(1);
  const [modal,    setModal]    = useState<'create'|'edit'|'delete'|null>(null);
  const [selected, setSelected] = useState<any>(null);
  const [deleting,    setDeleting]    = useState(false);
  const [loadingEdit, setLoadingEdit] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await inspectionApi.listChecklists({ page, limit:12, search:search||undefined, inspection_type:typeF||undefined, status:statusF||undefined });
      setData(res.data);
    } finally { setLoading(false); }
  }, [page, search, typeF, statusF]);

  useEffect(() => { load(); }, [load]);

  const handleDelete = async () => {
    if (!selected) return;
    setDeleting(true);
    try { await inspectionApi.deleteChecklist(selected.checklist_id); toast.success('Deleted'); await load(); setModal(null); }
    finally { setDeleting(false); }
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-800 dark:text-white">Inspection Checklists</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">{data?.totalResults ?? 0} checklists</p>
        </div>
        {canManage && (
          <button onClick={() => { setSelected(null); setModal('create'); }}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium bg-brand-500 text-white rounded-lg hover:bg-brand-600">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
            New Checklist
          </button>
        )}
      </div>

      <div className="flex gap-3 flex-wrap">
        <input value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} placeholder="Search checklists..."
          className="flex-1 min-w-[200px] rounded-lg border border-gray-300 dark:border-gray-700 px-3 py-2 text-sm dark:bg-gray-900 dark:text-white focus:outline-none focus:border-brand-400" />
        <select value={typeF} onChange={e => { setTypeF(e.target.value); setPage(1); }} className="rounded-lg border border-gray-300 dark:border-gray-700 px-3 py-2 text-sm dark:bg-gray-900 dark:text-white">
          <option value="">All Types</option>
          <option value="FA">Factory Assessment</option>
          <option value="GRI">Goods Receiving</option>
        </select>
        <select value={statusF} onChange={e => { setStatusF(e.target.value); setPage(1); }} className="rounded-lg border border-gray-300 dark:border-gray-700 px-3 py-2 text-sm dark:bg-gray-900 dark:text-white">
          <option value="">All Statuses</option>
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
        </select>
      </div>

      <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
              {['Name','Type','Items','Status','Created By',''].map(h => (
                <th key={h} className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
            {loading ? Array.from({length:4}).map((_, i) => (
              <tr key={i} className="animate-pulse">
                {Array.from({length:6}).map((_,j) => <td key={j} className="px-4 py-3"><div className="h-4 bg-gray-100 dark:bg-gray-800 rounded" /></td>)}
              </tr>
            )) : data?.results.length === 0 ? (
              <tr><td colSpan={6} className="px-4 py-12 text-center text-gray-400">No checklists found</td></tr>
            ) : data?.results.map((cl: any) => (
              <tr key={cl.checklist_id} className="hover:bg-gray-50 dark:hover:bg-gray-800/40">
                <td className="px-4 py-3">
                  <p className="font-medium text-gray-800 dark:text-white">{cl.checklist_name}</p>
                  {cl.description && <p className="text-xs text-gray-400 truncate max-w-[200px]">{cl.description}</p>}
                </td>
                <td className="px-4 py-3">
                  <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${cl.inspection_type === 'FA' ? 'bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-400' : 'bg-green-100 text-green-700 dark:bg-green-500/20 dark:text-green-400'}`}>
                    {TYPE_LABELS[cl.inspection_type]}
                  </span>
                </td>
                <td className="px-4 py-3 text-gray-600 dark:text-gray-400 font-medium">{cl.item_count}</td>
                <td className="px-4 py-3">
                  <span className={`px-2.5 py-0.5 text-xs font-medium rounded-full ${cl.status === 'active' ? 'bg-green-100 text-green-700 dark:bg-green-500/20 dark:text-green-400' : 'bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-400'}`}>{cl.status}</span>
                </td>
                <td className="px-4 py-3 text-gray-500 dark:text-gray-400 text-xs">{cl.created_by_name}</td>
                <td className="px-4 py-3">
                  <div className="flex justify-end gap-1">
                    <button
                        disabled={loadingEdit}
                        onClick={async () => {
                          setLoadingEdit(true);
                          try {
                            const res = await inspectionApi.getChecklist(cl.checklist_id);
                            setSelected(res.data);
                            setModal('edit');
                          } catch { toast.error('Failed', 'Could not load checklist'); }
                          finally { setLoadingEdit(false); }
                        }}
                        className="px-2.5 py-1 text-xs text-brand-600 dark:text-brand-400 hover:bg-brand-50 dark:hover:bg-brand-500/10 rounded-md disabled:opacity-50">
                        {loadingEdit ? '...' : canManage ? 'Edit' : 'View'}
                    </button>
                    {canManage && <button onClick={() => { setSelected(cl); setModal('delete'); }} className="px-2.5 py-1 text-xs text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-md">Delete</button>}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {data && data.totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-gray-200 dark:border-gray-700">
            <p className="text-sm text-gray-500">Page {data.page} of {data.totalPages}</p>
            <div className="flex gap-2">
              <button onClick={() => setPage(p=>p-1)} disabled={page===1} className="px-3 py-1.5 text-sm rounded-lg border border-gray-300 dark:border-gray-700 disabled:opacity-40">Prev</button>
              <button onClick={() => setPage(p=>p+1)} disabled={page===data.totalPages} className="px-3 py-1.5 text-sm rounded-lg border border-gray-300 dark:border-gray-700 disabled:opacity-40">Next</button>
            </div>
          </div>
        )}
      </div>

      <Modal isOpen={modal==='create'} onClose={() => setModal(null)} title="New Checklist" size="lg">
        <ChecklistForm onSaved={load} onClose={() => setModal(null)} />
      </Modal>
      <Modal isOpen={modal==='edit' && !!selected} onClose={() => setModal(null)} title="Edit Checklist" size="lg">
        {selected && <ChecklistForm key={`${selected.checklist_id}-${JSON.stringify(selected.items)}`} checklist={selected} onSaved={load} onClose={() => setModal(null)} />}
      </Modal>
      <Modal isOpen={modal==='delete' && !!selected} onClose={() => setModal(null)} title="Delete Checklist" size="sm">
        <DeleteConfirm name={selected?.checklist_name??''} onConfirm={handleDelete} onCancel={() => setModal(null)} loading={deleting} />
      </Modal>
    </div>
  );
}
