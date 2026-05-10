import { useEffect, useState, useCallback } from 'react';
import { logisticsApi } from '../../api';
import Modal from '../../components/tpfcs/Modal';
import { toast } from '../../components/tpfcs/Toast';
import { useAuth } from '../../store/authStore';
import CompanyForm from './CompanyForm';

const COMPANY_TYPES = ['External Logistics Provider','Courier Service','Freight Forwarder','Internal Fleet','Air Cargo','Sea Freight','Ground Transport'];

const TYPE_STYLES: Record<string,string> = {
  'External Logistics Provider': 'bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-400',
  'Courier Service':             'bg-green-100 text-green-700 dark:bg-green-500/20 dark:text-green-400',
  'Freight Forwarder':           'bg-purple-100 text-purple-700 dark:bg-purple-500/20 dark:text-purple-400',
  'Internal Fleet':              'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300',
  'Air Cargo':                   'bg-sky-100 text-sky-700 dark:bg-sky-500/20 dark:text-sky-400',
  'Sea Freight':                 'bg-cyan-100 text-cyan-700 dark:bg-cyan-500/20 dark:text-cyan-400',
  'Ground Transport':            'bg-orange-100 text-orange-700 dark:bg-orange-500/20 dark:text-orange-400',
};

export default function LogisticsCompaniesPage() {
  const { user }  = useAuth();
  const canManage = ['admin','manager'].includes(user?.role ?? '');
  const [data,     setData]     = useState<any>(null);
  const [loading,  setLoading]  = useState(true);
  const [search,   setSearch]   = useState('');
  const [typeF,    setTypeF]    = useState('');
  const [statusF,  setStatusF]  = useState('');
  const [page,     setPage]     = useState(1);
  const [modal,    setModal]    = useState<'create'|'edit'|'delete'|null>(null);
  const [selected, setSelected] = useState<any>(null);
  const [deleting, setDeleting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await logisticsApi.listCompanies({ page, limit:15, search:search||undefined, company_type:typeF||undefined, status:statusF||undefined });
      setData(res.data);
    } finally { setLoading(false); }
  }, [page, search, typeF, statusF]);

  useEffect(() => { load(); }, [load]);

  const handleDelete = async () => {
    setDeleting(true);
    try { await logisticsApi.deleteCompany(selected.logistics_company_id); toast.success('Deleted'); load(); setModal(null); }
    catch (err: any) { toast.error('Failed', err?.response?.data?.message); }
    finally { setDeleting(false); }
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-800 dark:text-white">Logistics Companies</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">{data?.totalResults ?? 0} companies</p>
        </div>
        {canManage && (
          <button onClick={() => { setSelected(null); setModal('create'); }}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium bg-brand-500 text-white rounded-lg hover:bg-brand-600">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4"/></svg>
            Add Company
          </button>
        )}
      </div>
      <div className="flex gap-3 flex-wrap">
        <input value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} placeholder="Search company, contact, city..."
          className="flex-1 min-w-[200px] rounded-lg border border-gray-300 dark:border-gray-700 px-3 py-2 text-sm dark:bg-gray-900 dark:text-white focus:outline-none focus:border-brand-400"/>
        <select value={typeF} onChange={e => { setTypeF(e.target.value); setPage(1); }} className="rounded-lg border border-gray-300 dark:border-gray-700 px-3 py-2 text-sm dark:bg-gray-900 dark:text-white">
          <option value="">All Types</option>{COMPANY_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
        </select>
        <select value={statusF} onChange={e => { setStatusF(e.target.value); setPage(1); }} className="rounded-lg border border-gray-300 dark:border-gray-700 px-3 py-2 text-sm dark:bg-gray-900 dark:text-white">
          <option value="">All Statuses</option><option value="active">Active</option><option value="inactive">Inactive</option><option value="suspended">Suspended</option>
        </select>
      </div>
      <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 overflow-hidden">
        <table className="w-full text-sm">
          <thead><tr className="border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
            {['Company','Type','Contact','Location','Shipments','Status',''].map(h =>
              <th key={h} className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400">{h}</th>)}
          </tr></thead>
          <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
            {loading ? Array.from({length:5}).map((_,i) => (
              <tr key={i} className="animate-pulse">{Array.from({length:7}).map((_,j) => <td key={j} className="px-4 py-3"><div className="h-4 bg-gray-100 dark:bg-gray-800 rounded"/></td>)}</tr>
            )) : data?.results.length === 0 ? (
              <tr><td colSpan={7} className="px-4 py-12 text-center text-gray-400">No companies found</td></tr>
            ) : data?.results.map((co: any) => (
              <tr key={co.logistics_company_id} className="hover:bg-gray-50 dark:hover:bg-gray-800/40">
                <td className="px-4 py-3">
                  <p className="font-medium text-gray-800 dark:text-white">{co.company_name}</p>
                  {co.website && <a href={co.website} target="_blank" rel="noreferrer" className="text-xs text-brand-500 hover:underline">{co.website.replace(/https?:\/\//,'')}</a>}
                </td>
                <td className="px-4 py-3"><span className={`px-2 py-0.5 text-xs font-medium rounded-full ${TYPE_STYLES[co.company_type] ?? 'bg-gray-100 text-gray-600'}`}>{co.company_type}</span></td>
                <td className="px-4 py-3">
                  <p className="text-sm text-gray-700 dark:text-gray-300">{co.contact_person ?? '—'}</p>
                  {co.phone_number && <p className="text-xs text-gray-400">{co.phone_number}</p>}
                </td>
                <td className="px-4 py-3 text-xs text-gray-500">{[co.city, co.country].filter(Boolean).join(', ') || '—'}</td>
                <td className="px-4 py-3 text-center text-gray-600 dark:text-gray-400 font-medium">{co.shipment_count ?? 0}</td>
                <td className="px-4 py-3">
                  <span className={`px-2.5 py-0.5 text-xs font-medium rounded-full capitalize ${co.status === 'active' ? 'bg-green-100 text-green-700 dark:bg-green-500/20 dark:text-green-400' : co.status === 'suspended' ? 'bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-400' : 'bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-400'}`}>{co.status}</span>
                </td>
                <td className="px-4 py-3">
                  <div className="flex justify-end gap-1">
                    {canManage && <button onClick={() => { setSelected(co); setModal('edit'); }} className="px-2.5 py-1 text-xs text-brand-600 dark:text-brand-400 hover:bg-brand-50 dark:hover:bg-brand-500/10 rounded-md">Edit</button>}
                    {canManage && <button onClick={() => { setSelected(co); setModal('delete'); }} className="px-2.5 py-1 text-xs text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-md">Delete</button>}
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
      <Modal isOpen={modal==='create'} onClose={() => setModal(null)} title="Add Logistics Company" size="lg">
        <CompanyForm onSaved={load} onClose={() => setModal(null)}/>
      </Modal>
      <Modal isOpen={modal==='edit' && !!selected} onClose={() => setModal(null)} title="Edit Company" size="lg">
        {selected && <CompanyForm key={selected.logistics_company_id} company={selected} onSaved={load} onClose={() => setModal(null)}/>}
      </Modal>
      <Modal isOpen={modal==='delete' && !!selected} onClose={() => setModal(null)} title="Delete Company" size="sm">
        <div className="space-y-4">
          <p className="text-sm text-gray-600 dark:text-gray-400">Delete <strong>"{selected?.company_name}"</strong>? This cannot be undone.</p>
          <div className="flex justify-end gap-3">
            <button onClick={() => setModal(null)} className="px-4 py-2 text-sm border border-gray-300 dark:border-gray-700 rounded-lg text-gray-600">Cancel</button>
            <button onClick={handleDelete} disabled={deleting} className="px-4 py-2 text-sm bg-red-500 text-white rounded-lg hover:bg-red-600 disabled:opacity-50">{deleting ? 'Deleting...' : 'Delete'}</button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
