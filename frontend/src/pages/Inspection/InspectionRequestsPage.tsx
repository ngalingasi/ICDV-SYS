import { useEffect, useState, useCallback } from 'react';
import { Link, useNavigate } from 'react-router';
import { inspectionApi } from '../../api';
import { toast } from '../../components/tpfcs/Toast';
import { useAuth } from '../../store/authStore';

const STATUS_STYLES: Record<string,string> = {
  draft:               'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400',
  pending_acceptance:  'bg-yellow-100 text-yellow-700 dark:bg-yellow-500/20 dark:text-yellow-400',
  scheduled:           'bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-400',
  active:              'bg-indigo-100 text-indigo-700 dark:bg-indigo-500/20 dark:text-indigo-400',
  completed:           'bg-green-100 text-green-700 dark:bg-green-500/20 dark:text-green-400',
  cancelled:           'bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-400',
};

export default function InspectionRequestsPage() {
  const { user }   = useAuth();
  const navigate   = useNavigate();
  const canManage  = ['admin','manager'].includes(user?.role ?? '');

  const [data,     setData]     = useState<any>(null);
  const [loading,  setLoading]  = useState(true);
  const [search,   setSearch]   = useState('');
  const [typeF,    setTypeF]    = useState('');
  const [statusF,  setStatusF]  = useState('');
  const [page,     setPage]     = useState(1);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await inspectionApi.listRequests({ page, limit:15, search:search||undefined, inspection_type:typeF||undefined, status:statusF||undefined });
      setData(res.data);
    } finally { setLoading(false); }
  }, [page, search, typeF, statusF]);

  useEffect(() => { load(); }, [load]);

  const handleCancel = async (id: number) => {
    if (!confirm('Cancel this inspection request?')) return;
    try { await inspectionApi.cancelRequest(id); toast.success('Cancelled'); load(); }
    catch (err: any) { toast.error('Failed', err?.response?.data?.message); }
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-800 dark:text-white">Inspection Requests</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">{data?.totalResults ?? 0} requests</p>
        </div>
        {canManage && (
          <Link to="/inspection/requests/new"
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium bg-brand-500 text-white rounded-lg hover:bg-brand-600">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
            New Request
          </Link>
        )}
      </div>

      <div className="flex gap-3 flex-wrap">
        <input value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} placeholder="Search request number, location..."
          className="flex-1 min-w-[200px] rounded-lg border border-gray-300 dark:border-gray-700 px-3 py-2 text-sm dark:bg-gray-900 dark:text-white focus:outline-none focus:border-brand-400" />
        <select value={typeF} onChange={e => { setTypeF(e.target.value); setPage(1); }} className="rounded-lg border border-gray-300 dark:border-gray-700 px-3 py-2 text-sm dark:bg-gray-900 dark:text-white">
          <option value="">All Types</option>
          <option value="FA">Factory Assessment</option>
          <option value="GRI">Goods Receiving</option>
        </select>
        <select value={statusF} onChange={e => { setStatusF(e.target.value); setPage(1); }} className="rounded-lg border border-gray-300 dark:border-gray-700 px-3 py-2 text-sm dark:bg-gray-900 dark:text-white">
          <option value="">All Statuses</option>
          {Object.keys(STATUS_STYLES).map(s => <option key={s} value={s}>{s.replace(/_/g,' ')}</option>)}
        </select>
      </div>

      <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
                {['Request #','Type','Source','Reference','Location','Date','Status',''].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
              {loading ? Array.from({length:5}).map((_,i) => (
                <tr key={i} className="animate-pulse">
                  {Array.from({length:9}).map((_,j) => <td key={j} className="px-4 py-3"><div className="h-4 bg-gray-100 dark:bg-gray-800 rounded" /></td>)}
                </tr>
              )) : data?.results.length === 0 ? (
                <tr><td colSpan={9} className="px-4 py-12 text-center text-gray-400">No inspection requests found</td></tr>
              ) : data?.results.map((ir: any) => (
                <tr key={ir.inspection_request_id} className="hover:bg-gray-50 dark:hover:bg-gray-800/40">
                  <td className="px-4 py-3">
                    <span className="font-mono text-xs font-semibold text-brand-600 dark:text-brand-400">{ir.request_number}</span>
                  </td>
                  {/* Type badge */}
                  <td className="px-4 py-3">
                    <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${ir.inspection_type === 'FA' ? 'bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-400' : 'bg-green-100 text-green-700 dark:bg-green-500/20 dark:text-green-400'}`}>
                      {ir.inspection_type}
                    </span>
                  </td>

                  {/* Source type */}
                  <td className="px-4 py-3">
                    {ir.source_type === 'TRANSFER' ? (
                      <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-orange-100 text-orange-700 dark:bg-orange-500/20 dark:text-orange-400 flex items-center gap-1 w-fit">
                        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4"/></svg>
                        Transfer
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400 flex items-center gap-1 w-fit">
                        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"/></svg>
                        Order
                      </span>
                    )}
                  </td>

                  {/* Reference — order number or transfer number */}
                  <td className="px-4 py-3">
                    {ir.source_type === 'TRANSFER' ? (
                      <div>
                        <p className="font-mono text-xs font-semibold text-orange-600 dark:text-orange-400">{ir.transfer_number ?? '—'}</p>
                        {ir.source_store_name && <p className="text-[10px] text-gray-400">{ir.source_store_name} → {ir.destination_store_name}</p>}
                      </div>
                    ) : (
                      <div>
                        <p className="font-mono text-xs font-semibold text-brand-600 dark:text-brand-400">{ir.order_number ?? '—'}</p>
                        {ir.supplier_name && <p className="text-[10px] text-gray-400">{ir.supplier_name}</p>}
                      </div>
                    )}
                  </td>

                  {/* Location */}
                  <td className="px-4 py-3">
                    <p className="font-medium text-gray-700 dark:text-gray-300 text-xs">{ir.location_name}</p>
                    {ir.location_country && <p className="text-xs text-gray-400">{ir.location_country}</p>}
                  </td>

                  {/* Date */}
                  <td className="px-4 py-3 text-xs text-gray-600 dark:text-gray-400">
                    {new Date(ir.inspection_date).toLocaleDateString('en-GB',{day:'2-digit',month:'short',year:'numeric'})}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`px-2.5 py-0.5 text-xs font-medium rounded-full capitalize ${STATUS_STYLES[ir.status]}`}>
                      {ir.status.replace(/_/g,' ')}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-1 flex-wrap">
                      {/* Execute — for accepted assignees */}
                      {(ir.accepted_user_ids ?? []).includes(user?.user_id) &&
                       ['scheduled','active'].includes(ir.status) && (
                        <button onClick={() => navigate(`/inspection/requests/${ir.inspection_request_id}/execute`)}
                          className="px-2.5 py-1 text-xs font-medium bg-brand-500 text-white rounded-md hover:bg-brand-600">
                          Execute
                        </button>
                      )}
                      {/* Approve — for managers */}
                      {canManage && ir.status === 'pending_approval' && (
                        <button onClick={() => navigate(`/inspection/requests/${ir.inspection_request_id}/approve`)}
                          className="px-2.5 py-1 text-xs font-medium bg-green-500 text-white rounded-md hover:bg-green-600">
                          Approve
                        </button>
                      )}
                      <button onClick={() => navigate(`/inspection/requests/${ir.inspection_request_id}`)}
                        className="px-2.5 py-1 text-xs text-brand-600 dark:text-brand-400 hover:bg-brand-50 dark:hover:bg-brand-500/10 rounded-md">View</button>
                      {canManage && !['cancelled','completed','approved'].includes(ir.status) && (
                        <>
                          <button onClick={() => navigate(`/inspection/requests/${ir.inspection_request_id}/edit`)}
                            className="px-2.5 py-1 text-xs text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-md">Edit</button>
                          <button onClick={() => handleCancel(ir.inspection_request_id)}
                            className="px-2.5 py-1 text-xs text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-md">Cancel</button>
                        </>
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
            <p className="text-sm text-gray-500">Page {data.page} of {data.totalPages}</p>
            <div className="flex gap-2">
              <button onClick={() => setPage(p=>p-1)} disabled={page===1} className="px-3 py-1.5 text-sm rounded-lg border border-gray-300 dark:border-gray-700 disabled:opacity-40">Prev</button>
              <button onClick={() => setPage(p=>p+1)} disabled={page===data.totalPages} className="px-3 py-1.5 text-sm rounded-lg border border-gray-300 dark:border-gray-700 disabled:opacity-40">Next</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
