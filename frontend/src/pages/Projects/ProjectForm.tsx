import { useEffect, useState } from 'react';
import { useNavigate, useParams, Link } from 'react-router';
import { projectsApi, lookupsApi, usersApi } from '../../api';
import type {
  Sector, Region, Implementer, UserRecord,
  ProjectCoordinator, ProjectEmployment, ProjectFinancing,
} from '../../types';
import { FormInput, FormSelect, FormTextArea, FormDateInput } from '../../components/tpfcs/FormField';
import { toast } from '../../components/tpfcs/Toast';
import BackButton from '../../components/tpfcs/BackButton';

// ── All helper components defined OUTSIDE to prevent remount → focus loss ─────

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-5 space-y-4">
      <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 pb-2 border-b border-gray-100 dark:border-gray-800">{title}</h2>
      {children}
    </div>
  );
}

function Row({ children, onRemove }: { children: React.ReactNode; onRemove: () => void }) {
  return (
    <div className="relative p-4 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
      {children}
      <button type="button" onClick={onRemove}
        className="absolute top-2 right-2 w-6 h-6 flex items-center justify-center rounded-full text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 text-xl leading-none">
        ×
      </button>
    </div>
  );
}

// Stable unique key generator — prevents React key collision on add/remove
let _uid = 0;
const uid = () => `r${++_uid}`;

// ─────────────────────────────────────────────────────────────────────────────

const EMPTY_FORM = () => ({
  name: '', programme_name: '', project_nature: '', sector_id: '', sub_sector: '',
  start_date: '', end_date: '',
  fund_structure: '', funding: '', estimated_cost: '', project_life_span: '',
  project_background: '', project_objectives: '', project_main_activities: '',
  project_beneficiaries: '', project_use_capacity: '', project_scope: '',
  cost_center: '', project_reference: '', relevancy_fypds: '',
  implementation_modality: '', compensation: '',
  has_land: '0', job_created_no: '',
  project_manager_id: '',
  regions:      [] as number[],
  implementers: [] as any[],
  coordinators: [] as ProjectCoordinator[],
  employment:   [] as ProjectEmployment[],
  financing:    [] as ProjectFinancing[],
});

export default function ProjectForm() {
  const { id }   = useParams<{ id: string }>();
  const navigate = useNavigate();
  const isEdit   = !!id;

  const [form,         setForm]         = useState(EMPTY_FORM);
  const [sectors,      setSectors]      = useState<Sector[]>([]);
  const [regions,      setRegions]      = useState<Region[]>([]);
  const [implementers, setImplementers] = useState<Implementer[]>([]);
  const [managers,     setManagers]     = useState<UserRecord[]>([]);
  const [loading,      setLoading]      = useState(false);
  const [saving,       setSaving]       = useState(false);
  const [error,        setError]        = useState('');

  const set = (k: string, v: any) => setForm(f => ({ ...f, [k]: v }));

  // Reset form when route changes (fixes cache from edit → new)
  useEffect(() => {
    setForm(EMPTY_FORM());
    setError('');
  }, [id]);

  useEffect(() => {
    setLoading(true);
    Promise.all([
      lookupsApi.sectors(),
      lookupsApi.regions(),
      lookupsApi.implementers(),
      usersApi.list({ limit: 200, status: 'active' }),
    ]).then(([s, r, i, u]) => {
      setSectors(s.data); setRegions(r.data);
      setImplementers(i.data); setManagers(u.data.results);
    }).finally(() => setLoading(false));
  }, []);

  // Load existing project for edit
  useEffect(() => {
    if (!isEdit) return;
    projectsApi.get(Number(id)).then(res => {
      const p = res.data;
      setForm({
        name: p.name ?? '', programme_name: p.programme_name ?? '',
        project_nature: p.project_nature ?? '', sector_id: p.sector_id?.toString() ?? '',
        sub_sector: p.sub_sector ?? '',
        start_date: p.start_date?.slice(0, 10) ?? '',
        end_date: p.end_date?.slice(0, 10) ?? '',
        fund_structure: p.fund_structure ?? '',
        funding: p.funding ?? '',
        estimated_cost: p.estimated_cost?.toString() ?? '',
        project_life_span: p.project_life_span?.toString() ?? '',
        project_background: p.project_background ?? '',
        project_objectives: p.project_objectives ?? '',
        project_main_activities: p.project_main_activities ?? '',
        project_beneficiaries: p.project_beneficiaries ?? '',
        project_use_capacity: p.project_use_capacity ?? '',
        project_scope: p.project_scope ?? '',
        cost_center: p.cost_center ?? '', project_reference: p.project_reference ?? '',
        relevancy_fypds: p.relevancy_fypds ?? '',
        implementation_modality: p.implementation_modality ?? '',
        compensation: p.compensation ?? '',
        has_land: p.has_land?.toString() ?? '0',
        job_created_no: p.job_created_no ?? '',
        project_manager_id: p.project_manager_id?.toString() ?? '',
        regions: p.regions?.map(r => r.region_id) ?? [],
        implementers: p.implementers ?? [],
        coordinators: p.coordinators ?? [],
        employment: p.employment ?? [],
        financing: p.financing ?? [],
      });
    });
  }, [id]);

  const toggleRegion = (rid: number) =>
    setForm(f => ({
      ...f,
      regions: f.regions.includes(rid) ? f.regions.filter(r => r !== rid) : [...f.regions, rid],
    }));

  // Implementer helpers
  const addImpl = () => setForm(f => ({ ...f, implementers: [...f.implementers, { _key: uid(), implementer_id: '', vote_name: '', vote_code: '', sub_vote_code: '', sub_vote_name: '', cost_center: '', involvement: 'Lead', role_type: 'implementer' }] }));
  const setImpl = (i: number, k: string, v: string) => setForm(f => { const a = [...f.implementers]; a[i] = { ...a[i], [k]: v }; return { ...f, implementers: a }; });
  const removeImpl = (i: number) => setForm(f => ({ ...f, implementers: f.implementers.filter((_, idx) => idx !== i) }));

  // Coordinator helpers
  const addCoord = () => setForm(f => ({ ...f, coordinators: [...f.coordinators, { _key: uid(), full_name: '', email: '', phone_number: '', address: '' }] }));
  const setCoord = (i: number, k: string, v: string) => setForm(f => { const a = [...f.coordinators]; a[i] = { ...a[i], [k]: v }; return { ...f, coordinators: a }; });
  const removeCoord = (i: number) => setForm(f => ({ ...f, coordinators: f.coordinators.filter((_, idx) => idx !== i) }));

  // Employment helpers
  const addEmp = () => setForm(f => ({ ...f, employment: [...f.employment, { _key: uid(), category: '', type: '', foreign_count: 0, domestic_count: 0 }] }));
  const setEmp = (i: number, k: string, v: any) => setForm(f => { const a = [...f.employment]; a[i] = { ...a[i], [k]: v }; return { ...f, employment: a }; });
  const removeEmp = (i: number) => setForm(f => ({ ...f, employment: f.employment.filter((_, idx) => idx !== i) }));

  // Financing helpers
  const addFin = () => setForm(f => ({ ...f, financing: [...f.financing, { _key: uid(), fund_source: '', financial_modality: '', financial_category: '', financier: '', committed_amount: undefined, exchange_rate: undefined, currency: 'TZS' }] }));
  const setFin = (i: number, k: string, v: any) => setForm(f => { const a = [...f.financing]; a[i] = { ...a[i], [k]: v }; return { ...f, financing: a }; });
  const removeFin = (i: number) => setForm(f => ({ ...f, financing: f.financing.filter((_, idx) => idx !== i) }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) { setError('Project name is required'); return; }
    setSaving(true); setError('');
    try {
      const payload = {
        ...form,
        sector_id:          form.sector_id          ? Number(form.sector_id)          : null,
        estimated_cost:     form.estimated_cost     ? Number(form.estimated_cost)     : null,
        project_life_span:  form.project_life_span  ? Number(form.project_life_span)  : null,
        project_manager_id: form.project_manager_id ? Number(form.project_manager_id) : null,
        has_land: Number(form.has_land),
        implementers: form.implementers.filter(i => i.implementer_id),
        financing: form.financing.map(f => ({
          ...f,
          committed_amount: f.committed_amount ? Number(f.committed_amount) : null,
          exchange_rate:    f.exchange_rate    ? Number(f.exchange_rate)    : null,
        })),
      };
      if (isEdit) {
        await projectsApi.update(Number(id), payload as any);
        toast.success('Project updated', 'Changes saved successfully');
        navigate(`/projects/${id}`);
      } else {
        const res = await projectsApi.create(payload as any);
        toast.success('Project created', res.data.name);
        navigate(`/projects/${res.data.project_id}`);
      }
    } catch (err: any) {
      const msg = err?.response?.data?.message ?? 'Failed to save project';
      toast.error('Save failed', msg);
      setError(msg);
    } finally { setSaving(false); }
  };

  if (loading) return (
    <div className="animate-pulse max-w-4xl mx-auto space-y-4">
      {Array.from({length:4}).map((_,i) => <div key={i} className="h-32 bg-gray-200 dark:bg-gray-700 rounded-xl" />)}
    </div>
  );

  return (
    <div className="max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
          <Link to="/projects" className="hover:text-brand-500">Projects</Link>
          <span>/</span>
          <span className="text-gray-700 dark:text-gray-300">{isEdit ? 'Edit Project' : 'New Project'}</span>
        </div>
        <BackButton to="/projects" />
      </div>

      <h1 className="text-xl font-bold text-gray-800 dark:text-white mb-6">
        {isEdit ? 'Edit Project' : 'Create New Project'}
      </h1>

      {error && (
        <div className="mb-5 p-3 rounded-lg bg-red-50 dark:bg-red-500/10 text-red-700 dark:text-red-400 text-sm border border-red-200 dark:border-red-500/20">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">

        {/* Basic Info */}
        <Section title="Basic Information">
          <FormInput label="Project Name" required value={form.name} onChange={e => set('name', e.target.value)} placeholder="e.g. SAFER CITIES" />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <FormInput label="Programme Name" value={form.programme_name} onChange={e => set('programme_name', e.target.value)} placeholder="e.g. Urban Development Programme" />
            <FormInput label="Project Reference" value={form.project_reference} onChange={e => set('project_reference', e.target.value)} placeholder="e.g. 026-TR220-19114" />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <FormSelect label="Sector" value={form.sector_id} onChange={e => set('sector_id', e.target.value)}>
              <option value="">Select sector...</option>
              {sectors.map(s => <option key={s.sector_id} value={s.sector_id}>{s.name}</option>)}
            </FormSelect>
            <FormInput label="Sub Sector" value={form.sub_sector} onChange={e => set('sub_sector', e.target.value)} placeholder="e.g. Human Development" />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <FormInput label="Project Nature" value={form.project_nature} onChange={e => set('project_nature', e.target.value)} placeholder="e.g. Strategic / Infrastructure" />
            <FormSelect label="Project Manager" value={form.project_manager_id} onChange={e => set('project_manager_id', e.target.value)}>
              <option value="">Select manager...</option>
              {managers.map(u => <option key={u.user_id} value={u.user_id}>{u.full_name}</option>)}
            </FormSelect>
          </div>
        </Section>

        {/* Timeline */}
        <Section title="Timeline">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <FormDateInput label="Expected Start Date" id="proj-start" value={form.start_date} onChange={v => set('start_date', v)} />
            <FormDateInput label="Expected Completion Date" id="proj-end" value={form.end_date} onChange={v => set('end_date', v)} />
            <FormInput label="Project Life Span (Years)" type="number" value={form.project_life_span} onChange={e => set('project_life_span', e.target.value)} placeholder="30" />
          </div>
        </Section>

        {/* Financing Modality (multiple sources) */}
        <Section title="Financing Modality">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <FormSelect label="Fund Structure" value={form.fund_structure} onChange={e => set('fund_structure', e.target.value)}>
              <option value="">Select...</option>
              {['Single','Multiple','Foreign','Domestic','Mixed'].map(o => <option key={o} value={o}>{o}</option>)}
            </FormSelect>
            <FormInput label="General Funding Source" value={form.funding} onChange={e => set('funding', e.target.value)} placeholder="e.g. Ministry of Finance" />
          </div>
          <div>
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">Financing Sources (add one row per financier)</p>
            <div className="space-y-3">
              {form.financing.map((fin, i) => (
                <Row key={fin._key ?? fin.financing_id ?? i} onRemove={() => removeFin(i)}>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    <FormInput label="Fund Source" value={fin.fund_source ?? ''} onChange={e => setFin(i, 'fund_source', e.target.value)} placeholder="e.g. Foreign" />
                    <FormInput label="Financial Modality" value={fin.financial_modality ?? ''} onChange={e => setFin(i, 'financial_modality', e.target.value)} placeholder="e.g. Concession Loan" />
                    <FormInput label="Financial Category" value={fin.financial_category ?? ''} onChange={e => setFin(i, 'financial_category', e.target.value)} placeholder="e.g. Development Projects Fund" />
                    <FormInput label="Financier" value={fin.financier ?? ''} onChange={e => setFin(i, 'financier', e.target.value)} placeholder="e.g. IFD, World Bank" />
                    <FormInput label="Committed Amount" type="number" value={fin.committed_amount?.toString() ?? ''} onChange={e => setFin(i, 'committed_amount', e.target.value)} placeholder="145.20" />
                    <div className="grid grid-cols-2 gap-2">
                      <FormInput label="Exchange Rate" type="number" value={fin.exchange_rate?.toString() ?? ''} onChange={e => setFin(i, 'exchange_rate', e.target.value)} placeholder="2700" />
                      <FormInput label="Currency" value={fin.currency ?? 'TZS'} onChange={e => setFin(i, 'currency', e.target.value)} placeholder="USD" />
                    </div>
                  </div>
                </Row>
              ))}
            </div>
            <button type="button" onClick={addFin}
              className="mt-3 flex items-center gap-2 text-sm text-brand-500 hover:text-brand-600">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
              Add Financing Source
            </button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <FormInput label="Estimated Total Cost (TZS)" type="number" value={form.estimated_cost} onChange={e => set('estimated_cost', e.target.value)} placeholder="5000000" />
          </div>
        </Section>

        {/* Narrative */}
        <Section title="Project Narrative">
          <FormTextArea label="Project Background" value={form.project_background} onChange={e => set('project_background', e.target.value)} placeholder="Describe the project background..." />
          <div>
            <FormTextArea label="Project Objectives (comma-separated)" value={form.project_objectives} onChange={e => set('project_objectives', e.target.value)} placeholder="Improve security delivery, Transform Police culture, Enhance technology" />
            <p className="text-xs text-gray-400 mt-1">Separate with commas — shown as bullet list in preview</p>
          </div>
          <div>
            <FormTextArea label="Project Main Activities (comma-separated)" value={form.project_main_activities} onChange={e => set('project_main_activities', e.target.value)} placeholder="Dedicated Cloud Platform, Center of Excellence for AI, Safer city platform" />
            <p className="text-xs text-gray-400 mt-1">Separate with commas — shown as bullet list in preview</p>
          </div>
          <FormTextArea label="Project Beneficiaries (comma-separated)" value={form.project_beneficiaries} onChange={e => set('project_beneficiaries', e.target.value)} placeholder="Public, Women, Youth, Police Officers" />
          <FormTextArea label="Project Use Capacity" value={form.project_use_capacity} onChange={e => set('project_use_capacity', e.target.value)} />
          <div>
            <FormTextArea label="Project Scope / Coverage (comma-separated)" value={form.project_scope} onChange={e => set('project_scope', e.target.value)} placeholder="Dar es Salaam, Arusha, Dodoma" />
            <p className="text-xs text-gray-400 mt-1">Separate with commas — shown as bullet list in preview</p>
          </div>
        </Section>

        {/* Admin Fields */}
        <Section title="Administrative Details">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <FormInput label="Cost Center" value={form.cost_center} onChange={e => set('cost_center', e.target.value)} placeholder="CC-001" />
            <FormInput label="Relevancy to FYPDs" value={form.relevancy_fypds} onChange={e => set('relevancy_fypds', e.target.value)} placeholder="FYDP III" />
            <FormInput label="Implementation Modality" value={form.implementation_modality} onChange={e => set('implementation_modality', e.target.value)} placeholder="Contractor / Direct" />
            <FormInput label="Number of Jobs to be Created" value={form.job_created_no} onChange={e => set('job_created_no', e.target.value)} placeholder="2012" />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <FormSelect label="Compensation" value={form.compensation} onChange={e => set('compensation', e.target.value)}>
              <option value="">Select...</option>
              <option value="Yes">Yes</option>
              <option value="No">No</option>
            </FormSelect>
            <FormSelect label="Has Land / Lot" value={form.has_land} onChange={e => set('has_land', e.target.value)}>
              <option value="0">No</option>
              <option value="1">Yes</option>
            </FormSelect>
          </div>
        </Section>

        {/* Regions */}
        <Section title="Locations / Regions">
          <div className="flex flex-wrap gap-2">
            {regions.map(r => (
              <button key={r.region_id} type="button" onClick={() => toggleRegion(r.region_id)}
                className={`px-3 py-1.5 text-xs rounded-lg border transition-colors ${
                  form.regions.includes(r.region_id)
                    ? 'bg-brand-500 text-white border-brand-500'
                    : 'border-gray-300 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:border-brand-400'
                }`}>
                {r.region_name}
              </button>
            ))}
          </div>
          {form.regions.length === 0 && <p className="text-xs text-gray-400">No regions selected</p>}
        </Section>

        {/* Implementers */}
        <Section title="Project Implementers">
          <div className="space-y-3">
            {form.implementers.map((impl, i) => (
              <Row key={impl._key ?? impl.implementer_id ?? i} onRemove={() => removeImpl(i)}>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  <FormSelect label="Implementer" value={impl.implementer_id} onChange={e => setImpl(i, 'implementer_id', e.target.value)}>
                    <option value="">Select...</option>
                    {implementers.map(imp => <option key={imp.implementer_id} value={imp.implementer_id}>{imp.name}</option>)}
                  </FormSelect>
                  <FormSelect label="Role Type" value={impl.role_type ?? 'implementer'} onChange={e => setImpl(i, 'role_type', e.target.value)}>
                    <option value="implementer">Implementer</option>
                    <option value="consultant">Consultant</option>
                    <option value="contractor">Contractor</option>
                  </FormSelect>
                  <FormInput label="Vote Name" value={impl.vote_name ?? ''} onChange={e => setImpl(i, 'vote_name', e.target.value)} placeholder="e.g. Ministry of Water" />
                  <FormInput label="Vote Code" value={impl.vote_code ?? ''} onChange={e => setImpl(i, 'vote_code', e.target.value)} placeholder="49" />
                  <FormInput label="Sub Vote Code" value={impl.sub_vote_code ?? ''} onChange={e => setImpl(i, 'sub_vote_code', e.target.value)} placeholder="4901" />
                  <FormInput label="Sub Vote Name" value={impl.sub_vote_name ?? ''} onChange={e => setImpl(i, 'sub_vote_name', e.target.value)} placeholder="Water Resources" />
                  <FormInput label="Cost Center" value={impl.cost_center ?? ''} onChange={e => setImpl(i, 'cost_center', e.target.value)} />
                  <FormInput label="Involvement" value={impl.involvement ?? ''} onChange={e => setImpl(i, 'involvement', e.target.value)} placeholder="Lead / Operations" />
                </div>
              </Row>
            ))}
          </div>
          <button type="button" onClick={addImpl} className="flex items-center gap-2 text-sm text-brand-500 hover:text-brand-600">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
            Add Implementer
          </button>
        </Section>

        {/* Project Coordinators */}
        <Section title="Project Coordinators">
          <div className="space-y-3">
            {form.coordinators.map((coord, i) => (
              <Row key={coord._key ?? coord.coordinator_id ?? i} onRemove={() => removeCoord(i)}>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <FormInput label="Full Name" required value={coord.full_name} onChange={e => setCoord(i, 'full_name', e.target.value)} placeholder="e.g. John Doe" />
                  <FormInput label="Email" type="email" value={coord.email ?? ''} onChange={e => setCoord(i, 'email', e.target.value)} placeholder="e.g. john@tpfcs.go.tz" />
                  <FormInput label="Phone Number" value={coord.phone_number ?? ''} onChange={e => setCoord(i, 'phone_number', e.target.value)} placeholder="255762000000" />
                  <FormInput label="Address" value={coord.address ?? ''} onChange={e => setCoord(i, 'address', e.target.value)} placeholder="Dar es Salaam" />
                </div>
              </Row>
            ))}
          </div>
          <button type="button" onClick={addCoord} className="flex items-center gap-2 text-sm text-brand-500 hover:text-brand-600">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
            Add Coordinator
          </button>
        </Section>

        {/* Employment Category */}
        <Section title="Employment Category">
          <div className="space-y-3">
            {form.employment.map((emp, i) => (
              <Row key={emp._key ?? emp.employment_id ?? i} onRemove={() => removeEmp(i)}>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <FormInput label="Category" value={emp.category} onChange={e => setEmp(i, 'category', e.target.value)} placeholder="Direct Employment" />
                  <FormInput label="Type" value={emp.type} onChange={e => setEmp(i, 'type', e.target.value)} placeholder="Temporary / Permanent" />
                  <FormInput label="Foreign Count" type="number" value={emp.foreign_count?.toString() ?? '0'} onChange={e => setEmp(i, 'foreign_count', Number(e.target.value))} />
                  <FormInput label="Domestic Count" type="number" value={emp.domestic_count?.toString() ?? '0'} onChange={e => setEmp(i, 'domestic_count', Number(e.target.value))} />
                </div>
              </Row>
            ))}
          </div>
          <button type="button" onClick={addEmp} className="flex items-center gap-2 text-sm text-brand-500 hover:text-brand-600">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
            Add Employment Category
          </button>
        </Section>

        {/* Actions */}
        <div className="flex items-center justify-between pb-8">
          <Link to={isEdit ? `/projects/${id}` : '/projects'}
            className="px-5 py-2.5 text-sm border border-gray-300 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 text-gray-700 dark:text-gray-300">
            Cancel
          </Link>
          <button type="submit" disabled={saving}
            className="px-6 py-2.5 text-sm font-medium bg-brand-500 text-white rounded-lg hover:bg-brand-600 disabled:opacity-50">
            {saving ? 'Saving...' : isEdit ? 'Update Project' : 'Create Project'}
          </button>
        </div>

      </form>
    </div>
  );
}
