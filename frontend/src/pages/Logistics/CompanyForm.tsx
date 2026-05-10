import { useState } from 'react';
import { logisticsApi } from '../../api';
import { toast } from '../../components/tpfcs/Toast';

const COMPANY_TYPES = [
  'External Logistics Provider','Courier Service','Freight Forwarder',
  'Internal Fleet','Air Cargo','Sea Freight','Ground Transport',
];

const inputCls = "w-full rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2.5 text-sm text-gray-800 dark:text-white focus:outline-none focus:border-brand-400";

interface Props { company?: any; onSaved: ()=>void; onClose: ()=>void; }

export default function CompanyForm({ company, onSaved, onClose }: Props) {
  const isEdit = !!company;
  const [form, setForm] = useState({
    company_name:   company?.company_name   ?? '',
    company_type:   company?.company_type   ?? 'Courier Service',
    contact_person: company?.contact_person ?? '',
    phone_number:   company?.phone_number   ?? '',
    email:          company?.email          ?? '',
    address:        company?.address        ?? '',
    city:           company?.city           ?? '',
    country:        company?.country        ?? 'Tanzania',
    website:        company?.website        ?? '',
    tracking_url:   company?.tracking_url   ?? '',
    notes:          company?.notes          ?? '',
    status:         company?.status         ?? 'active',
  });
  const [saving, setSaving] = useState(false);
  const [error,  setError]  = useState('');
  const set = (k: string, v: string) => setForm(p => ({ ...p, [k]: v }));

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.company_name.trim()) { setError('Company name required'); return; }
    setSaving(true); setError('');
    try {
      const payload = Object.fromEntries(Object.entries(form).map(([k,v]) => [k, v || null]));
      payload.company_name = form.company_name;
      payload.company_type = form.company_type;
      payload.status       = form.status;
      if (isEdit) await logisticsApi.updateCompany(company.logistics_company_id, payload);
      else        await logisticsApi.createCompany(payload);
      toast.success(isEdit ? 'Company updated' : 'Company created');
      onSaved(); onClose();
    } catch (err: any) {
      const m = err?.response?.data?.message ?? 'Failed'; setError(m); toast.error('Failed', m);
    } finally { setSaving(false); }
  };

  return (
    <form onSubmit={save} className="space-y-4">
      {error && <p className="text-sm text-red-500 bg-red-50 dark:bg-red-500/10 p-3 rounded-lg">{error}</p>}

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1.5">
            Company Name <span className="text-red-500">*</span>
          </label>
          <input value={form.company_name} onChange={e => set('company_name', e.target.value)}
            placeholder="e.g. DHL Tanzania" required className={inputCls}/>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1.5">
            Company Type <span className="text-red-500">*</span>
          </label>
          <select value={form.company_type} onChange={e => set('company_type', e.target.value)} className={inputCls}>
            {COMPANY_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1.5">Contact Person</label>
          <input value={form.contact_person} onChange={e => set('contact_person', e.target.value)} placeholder="Name" className={inputCls}/>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1.5">Phone Number</label>
          <input value={form.phone_number} onChange={e => set('phone_number', e.target.value)} placeholder="+255 7XX XXX XXX" className={inputCls}/>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1.5">Email</label>
          <input type="email" value={form.email} onChange={e => set('email', e.target.value)} placeholder="logistics@company.com" className={inputCls}/>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1.5">City</label>
          <input value={form.city} onChange={e => set('city', e.target.value)} placeholder="Dar es Salaam" className={inputCls}/>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1.5">Country</label>
          <input value={form.country} onChange={e => set('country', e.target.value)} placeholder="Tanzania" className={inputCls}/>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1.5">Status</label>
          <select value={form.status} onChange={e => set('status', e.target.value)} className={inputCls}>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
            <option value="suspended">Suspended</option>
          </select>
        </div>
      </div>

      <div>
        <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1.5">Website</label>
        <input value={form.website} onChange={e => set('website', e.target.value)} placeholder="https://www.company.com" className={inputCls}/>
      </div>

      <div>
        <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1.5">
          Tracking URL
          <span className="ml-1 text-[10px] font-normal text-gray-400">(tracking # will be appended to this URL)</span>
        </label>
        <input value={form.tracking_url} onChange={e => set('tracking_url', e.target.value)}
          placeholder="https://track.company.com?ref=" className={inputCls}/>
      </div>

      <div>
        <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1.5">Address</label>
        <input value={form.address} onChange={e => set('address', e.target.value)} placeholder="Street address" className={inputCls}/>
      </div>

      <div>
        <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1.5">Notes</label>
        <textarea rows={2} value={form.notes} onChange={e => set('notes', e.target.value)}
          placeholder="Additional notes..." className={inputCls + ' resize-none'}/>
      </div>

      <div className="flex justify-end gap-3 pt-2">
        <button type="button" onClick={onClose}
          className="px-4 py-2 text-sm border border-gray-300 dark:border-gray-700 rounded-lg text-gray-600 dark:text-gray-400">
          Cancel
        </button>
        <button type="submit" disabled={saving}
          className="px-5 py-2 text-sm font-medium bg-brand-500 text-white rounded-lg hover:bg-brand-600 disabled:opacity-50">
          {saving ? 'Saving...' : isEdit ? 'Update' : 'Create'}
        </button>
      </div>
    </form>
  );
}
