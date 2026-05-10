import { useEffect, useState, useCallback } from 'react';
import { useParams, Link, useNavigate } from 'react-router';
import { projectsApi, objectivesApi, targetsApi, activitiesApi, budgetApi, lookupsApi } from '../../api';
import type { Project, Objective, Target, Activity, ProjectBudgetSummary } from '../../types';
import StatusBadge from '../../components/tpfcs/StatusBadge';
import BudgetBar from '../../components/tpfcs/BudgetBar';
import BulletList from '../../components/tpfcs/BulletList';
import FilePreview from '../../components/tpfcs/FilePreview';
import { documentsApi } from '../../api';
import Modal from '../../components/tpfcs/Modal';
import { FormInput, FormSelect, FormTextArea } from '../../components/tpfcs/FormField';

type Tab = 'details' | 'objectives' | 'targets' | 'activities' | 'documents';

// ── Objective Form ────────────────────────────────────────────────────────────
function ObjectiveForm({ projectId, onSaved, onClose }: { projectId: number; onSaved: () => void; onClose: () => void }) {
  const [form, setForm] = useState({ title: '', description: '', priority: 'medium', status: 'pending' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }));

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title.trim()) { setError('Title is required'); return; }
    setSaving(true);
    try {
      await objectivesApi.create({ ...form, project_id: projectId, priority: form.priority as 'low'|'medium'|'high', status: form.status as any });
      onSaved();
      onClose();
    } catch (err: any) {
      setError(err?.response?.data?.message ?? 'Failed to save');
    } finally { setSaving(false); }
  };

  return (
    <form onSubmit={save} className="space-y-4">
      {error && <p className="text-sm text-red-500 bg-red-50 dark:bg-red-500/10 p-3 rounded-lg">{error}</p>}
      <FormInput label="Title" required value={form.title} onChange={e => set('title', e.target.value)} placeholder="Objective title" />
      <FormTextArea label="Description" value={form.description} onChange={e => set('description', e.target.value)} placeholder="Describe this objective..." />
      <div className="grid grid-cols-2 gap-3">
        <FormSelect label="Priority" value={form.priority} onChange={e => set('priority', e.target.value)}>
          <option value="low">Low</option>
          <option value="medium">Medium</option>
          <option value="high">High</option>
        </FormSelect>
        <FormSelect label="Status" value={form.status} onChange={e => set('status', e.target.value)}>
          <option value="pending">Pending</option>
          <option value="in_progress">In Progress</option>
          <option value="completed">Completed</option>
          <option value="cancelled">Cancelled</option>
        </FormSelect>
      </div>
      <div className="flex justify-end gap-3 pt-2">
        <button type="button" onClick={onClose} className="px-4 py-2 text-sm border border-gray-300 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 text-gray-600 dark:text-gray-400">Cancel</button>
        <button type="submit" disabled={saving} className="px-4 py-2 text-sm bg-brand-500 text-white rounded-lg hover:bg-brand-600 disabled:opacity-50">{saving ? 'Saving...' : 'Create Objective'}</button>
      </div>
    </form>
  );
}

// ── Target Form ───────────────────────────────────────────────────────────────
function TargetForm({ objectives, onSaved, onClose }: { objectives: Objective[]; onSaved: () => void; onClose: () => void }) {
  const [form, setForm] = useState({ objective_id: objectives[0]?.objective_id?.toString() ?? '', name: '', metric_type: 'count', unit: '', target_value: '', deadline: '', status: 'on_track' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }));

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim() || !form.objective_id || !form.target_value) { setError('Objective, name and target value are required'); return; }
    setSaving(true);
    try {
      await targetsApi.create({ ...form, objective_id: Number(form.objective_id), target_value: Number(form.target_value), metric_type: form.metric_type as any, status: form.status as any });
      onSaved();
      onClose();
    } catch (err: any) {
      setError(err?.response?.data?.message ?? 'Failed to save');
    } finally { setSaving(false); }
  };

  return (
    <form onSubmit={save} className="space-y-4">
      {error && <p className="text-sm text-red-500 bg-red-50 dark:bg-red-500/10 p-3 rounded-lg">{error}</p>}
      <FormSelect label="Objective" required value={form.objective_id} onChange={e => set('objective_id', e.target.value)}>
        <option value="">Select objective...</option>
        {objectives.map(o => <option key={o.objective_id} value={o.objective_id}>{o.title}</option>)}
      </FormSelect>
      <FormInput label="Target Name" required value={form.name} onChange={e => set('name', e.target.value)} placeholder="e.g. Number of boreholes constructed" />
      <div className="grid grid-cols-2 gap-3">
        <FormSelect label="Metric Type" value={form.metric_type} onChange={e => set('metric_type', e.target.value)}>
          <option value="count">Count</option>
          <option value="percentage">Percentage</option>
          <option value="amount">Amount</option>
          <option value="other">Other</option>
        </FormSelect>
        <FormInput label="Unit" value={form.unit} onChange={e => set('unit', e.target.value)} placeholder="e.g. boreholes, km, %" />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <FormInput label="Target Value" required type="number" value={form.target_value} onChange={e => set('target_value', e.target.value)} placeholder="50" />
        <FormInput label="Deadline" type="date" value={form.deadline} onChange={e => set('deadline', e.target.value)} />
      </div>
      <FormSelect label="Status" value={form.status} onChange={e => set('status', e.target.value)}>
        <option value="on_track">On Track</option>
        <option value="at_risk">At Risk</option>
        <option value="off_track">Off Track</option>
        <option value="achieved">Achieved</option>
        <option value="missed">Missed</option>
      </FormSelect>
      <div className="flex justify-end gap-3 pt-2">
        <button type="button" onClick={onClose} className="px-4 py-2 text-sm border border-gray-300 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 text-gray-600 dark:text-gray-400">Cancel</button>
        <button type="submit" disabled={saving} className="px-4 py-2 text-sm bg-brand-500 text-white rounded-lg hover:bg-brand-600 disabled:opacity-50">{saving ? 'Saving...' : 'Create Target'}</button>
      </div>
    </form>
  );
}

// ── Activity Form ─────────────────────────────────────────────────────────────

// ── Allocate Budget Form ─────────────────────────────────────────────────────────
function AllocateBudgetForm({ target, projectBudget, onSaved, onClose }: {
  target: Target;
  projectBudget: number;
  onSaved: () => void;
  onClose: () => void;
}) {
  const [amount,  setAmount]  = useState(target.allocated_budget?.toString() ?? '');
  const [saving,  setSaving]  = useState(false);
  const [error,   setError]   = useState('');

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!amount || Number(amount) <= 0) { setError('Amount must be greater than 0'); return; }
    setSaving(true); setError('');
    try {
      await budgetApi.allocateTarget(target.target_id, Number(amount));
      onSaved();
      onClose();
    } catch (err: any) {
      setError(err?.response?.data?.message ?? 'Failed to allocate budget');
    } finally { setSaving(false); }
  };

  return (
    <form onSubmit={save} className="space-y-4">
      {error && <p className="text-sm text-red-500 bg-red-50 dark:bg-red-500/10 p-3 rounded-lg">{error}</p>}
      <div className="p-3 rounded-lg bg-blue-50 dark:bg-blue-500/10 text-sm text-blue-700 dark:text-blue-400">
        <p className="font-medium">{target.name}</p>
        <p className="text-xs mt-0.5">Project total budget: TZS {Number(projectBudget).toLocaleString()}</p>
        {target.allocated_budget > 0 && (
          <p className="text-xs mt-0.5">Currently allocated: TZS {Number(target.allocated_budget).toLocaleString()}</p>
        )}
      </div>
      <FormInput
        label="Allocated Budget (TZS)"
        required
        type="number"
        value={amount}
        onChange={e => setAmount(e.target.value)}
        placeholder="e.g. 2000000"
      />
      <div className="flex justify-end gap-3 pt-2">
        <button type="button" onClick={onClose} className="px-4 py-2 text-sm border border-gray-300 dark:border-gray-700 rounded-lg text-gray-600 dark:text-gray-400">Cancel</button>
        <button type="submit" disabled={saving} className="px-4 py-2 text-sm bg-brand-500 text-white rounded-lg hover:bg-brand-600 disabled:opacity-50">{saving ? 'Allocating...' : 'Allocate Budget'}</button>
      </div>
    </form>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function ProjectDetail() {
  const { id } = useParams<{ id: string }>();
  const pid      = Number(id);
  const navigate = useNavigate();

  const [project,      setProject]      = useState<Project | null>(null);
  const [objectives,   setObjectives]   = useState<Objective[]>([]);
  const [targets,      setTargets]      = useState<Target[]>([]);
  const [activities,   setActivities]   = useState<Activity[]>([]);
  const [budget,       setBudget]       = useState<ProjectBudgetSummary | null>(null);
  const [loading,      setLoading]      = useState(true);
  const [tab,          setTab]          = useState<Tab>('details');
  const [modal,        setModal]        = useState<'objective' | 'target' | 'allocate' | null>(null);
  const [documents,     setDocuments]     = useState<any[]>([]);
  const [previewDoc,    setPreviewDoc]    = useState<{url:string;name:string;mime?:string}|null>(null);
  const [uploadingDoc,  setUploadingDoc]  = useState(false);
  const [allocateTarget, setAllocateTarget] = useState<Target | null>(null);

  const loadAll = useCallback(async () => {
    setLoading(true);
    try {
      const [pRes, oRes] = await Promise.all([
        projectsApi.get(pid),
        objectivesApi.listByProject(pid),
      ]);
      setProject(pRes.data);
      setObjectives(oRes.data);
      budgetApi.projectSummary(pid).then(r => setBudget(r.data)).catch(() => {});
      documentsApi.listByProject(pid).then(r => setDocuments(r.data)).catch(() => {});

      // Load targets across all objectives
      const allTargets: Target[] = [];
      for (const obj of oRes.data) {
        const tRes = await targetsApi.listByObjective(obj.objective_id);
        allTargets.push(...tRes.data);
      }
      setTargets(allTargets);

      // Load activities
      const aRes = await activitiesApi.list({ page: 1, limit: 100 });
      // Filter to this project's targets
      const targetIds = new Set(allTargets.map(t => t.target_id));
      setActivities(aRes.data.results.filter(a => targetIds.has(a.target_id)));
    } finally {
      setLoading(false);
    }
  }, [pid]);

  useEffect(() => { loadAll(); }, [loadAll]);

  const fmt = (n?: number | string | null) => (n != null && n !== '') ? `TZS ${Number(n).toLocaleString()}` : '—';
  const dt  = (s?: string) => s ? new Date(s).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';

  const TABS: { key: Tab; label: string; count?: number }[] = [
    { key: 'details',    label: 'Details' },
    { key: 'objectives', label: 'Objectives', count: objectives.length },
    { key: 'targets',    label: 'Targets',    count: targets.length },
    { key: 'activities', label: 'Activities', count: activities.length },
  ];


  const fileUrl = (doc: any) => {
    const base = (import.meta.env.VITE_API_URL ?? '').replace('/api', '');
    const filePath = doc.file_path ?? '';
    // file_path stored as "uploads/filename.pdf" or just "filename.pdf"
    const filename = filePath.includes('/') ? filePath.split('/').pop() : filePath;
    return `${base}/uploads/${filename}`;
  };

  if (loading) return (
    <div className="p-6 space-y-4 animate-pulse">
      <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded w-64" />
      <div className="h-32 bg-gray-200 dark:bg-gray-700 rounded" />
      <div className="h-64 bg-gray-200 dark:bg-gray-700 rounded" />
    </div>
  );

  if (!project) return <div className="p-6 text-center text-gray-400">Project not found</div>;

  return (
    <div className="p-4 sm:p-6 space-y-5">

      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
        <Link to="/projects" className="hover:text-brand-500">Projects</Link>
        <span>/</span>
        <span className="text-gray-700 dark:text-gray-300 font-medium truncate">{project.name}</span>
      </div>

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-gray-800 dark:text-white">{project.name}</h1>
          <div className="flex items-center gap-3 mt-1 flex-wrap text-sm text-gray-500 dark:text-gray-400">
            {project.project_reference && <span>Ref: {project.project_reference}</span>}
            {project.sector_name && <span>· {project.sector_name}</span>}
            {project.project_manager_name && <span>· PM: {project.project_manager_name}</span>}
          </div>
        </div>
        <Link to={`/projects/${pid}/edit`}
          className="flex-shrink-0 px-4 py-2 text-sm border border-gray-300 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 text-gray-700 dark:text-gray-300">
          Edit Project
        </Link>
      </div>

      {/* Budget bar */}
      {budget && (
        <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-4">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-3 text-sm">
            {[
              { label: 'Total Budget',    value: fmt(budget.total_budget) },
              { label: 'Allocated',       value: fmt(budget.allocated_to_targets) },
              { label: 'Spent',           value: fmt(budget.total_spent) },
              { label: 'Remaining',       value: fmt(budget.remaining_budget) },
            ].map(i => (
              <div key={i.label}>
                <p className="text-xs text-gray-400 mb-0.5">{i.label}</p>
                <p className="font-semibold text-gray-800 dark:text-white">{i.value}</p>
              </div>
            ))}
          </div>
          <BudgetBar value={budget.spent_percentage} label="Budget Utilisation" />
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 border-b border-gray-200 dark:border-gray-700">
        {TABS.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
              tab === t.key
                ? 'border-brand-500 text-brand-600 dark:text-brand-400'
                : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
            }`}>
            {t.label}
            {t.count !== undefined && (
              <span className={`px-1.5 py-0.5 text-xs rounded-full ${tab === t.key ? 'bg-brand-100 text-brand-700 dark:bg-brand-500/20 dark:text-brand-400' : 'bg-gray-100 dark:bg-gray-800 text-gray-500'}`}>
                {t.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* ── DETAILS TAB ── */}
      {tab === 'details' && (
        <div className="space-y-4">
          {/* Info grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {[
              { label: 'Programme',            value: project.programme_name },
              { label: 'Nature',               value: project.project_nature },
              { label: 'Sub Sector',           value: project.sub_sector },
              { label: 'Start Date',           value: dt(project.start_date) },
              { label: 'End Date',             value: dt(project.end_date) },
              { label: 'Life Span',            value: project.project_life_span ? `${project.project_life_span} years` : null },
              { label: 'Estimated Cost',       value: fmt(project.estimated_cost) },
              { label: 'Fund Structure',       value: project.fund_structure },
              { label: 'Funding Source',       value: project.funding },
              { label: 'Cost Center',          value: project.cost_center },
              { label: 'Implementation',       value: project.implementation_modality },
              { label: 'Relevancy (FYDP)',     value: project.relevancy_fypds },
              { label: 'Jobs Created',         value: project.job_created_no },
              { label: 'Compensation',         value: project.compensation },
              { label: 'Has Land',             value: project.has_land === 1 ? 'Yes' : project.has_land === 0 ? 'No' : null },
            ].filter(i => i.value).map(i => (
              <div key={i.label} className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-3">
                <p className="text-xs text-gray-400 dark:text-gray-500">{i.label}</p>
                <p className="text-sm font-medium text-gray-800 dark:text-white mt-0.5">{i.value}</p>
              </div>
            ))}
          </div>

          {/* Financing Modality table */}
          {(project.financing?.length ?? 0) > 0 && (
            <div className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-4">
              <p className="text-xs text-gray-400 dark:text-gray-500 mb-3">Financing Modality</p>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-gray-100 dark:border-gray-800 text-gray-400">
                      {['#','Fund Source','Modality','Category','Financier','Committed','Rate','Currency','Amount (TZS)'].map(h => (
                        <th key={h} className="text-left py-1.5 pr-3 font-medium last:pr-0">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50 dark:divide-gray-800">
                    {project.financing!.map((f, idx) => (
                      <tr key={f.financing_id ?? idx}>
                        <td className="py-2 pr-3 text-gray-400">{idx + 1}</td>
                        <td className="py-2 pr-3 font-medium text-gray-700 dark:text-gray-300">{f.fund_source ?? '—'}</td>
                        <td className="py-2 pr-3 text-gray-500">{f.financial_modality ?? '—'}</td>
                        <td className="py-2 pr-3 text-gray-500">{f.financial_category ?? '—'}</td>
                        <td className="py-2 pr-3 text-gray-500">{f.financier ?? '—'}</td>
                        <td className="py-2 pr-3 text-gray-500">{f.committed_amount != null ? Number(f.committed_amount).toLocaleString() : '—'}</td>
                        <td className="py-2 pr-3 text-gray-500">{f.exchange_rate != null ? Number(f.exchange_rate).toLocaleString() : '—'}</td>
                        <td className="py-2 pr-3 text-gray-500">{f.currency ?? '—'}</td>
                        <td className="py-2 font-medium text-gray-700 dark:text-gray-300">
                          {f.amount_tzs != null
                            ? `TZS ${Number(f.amount_tzs).toLocaleString()}`
                            : f.committed_amount && f.exchange_rate
                              ? `TZS ${(Number(f.committed_amount) * Number(f.exchange_rate)).toLocaleString()}`
                              : '—'}
                        </td>
                      </tr>
                    ))}
                    {/* Total row */}
                    {project.financing!.length > 1 && (
                      <tr className="border-t-2 border-gray-200 dark:border-gray-700 font-semibold">
                        <td colSpan={8} className="py-2 pr-3 text-gray-600 dark:text-gray-400">Total</td>
                        <td className="py-2 text-brand-600 dark:text-brand-400">
                          TZS {project.financing!
                            .reduce((sum, f) => {
                              const tzs = f.amount_tzs
                                ?? (f.committed_amount && f.exchange_rate
                                  ? Number(f.committed_amount) * Number(f.exchange_rate)
                                  : 0);
                              return sum + Number(tzs);
                            }, 0)
                            .toLocaleString()}
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Narrative fields with bullet list support */}
          {[
            { label: 'Project Background',    value: project.project_background,      bullets: false },
            { label: 'Project Objectives',    value: project.project_objectives,      bullets: true  },
            { label: 'Main Activities',       value: project.project_main_activities, bullets: true  },
            { label: 'Beneficiaries',         value: project.project_beneficiaries,   bullets: true  },
            { label: 'Project Use Capacity',  value: project.project_use_capacity,    bullets: false },
            { label: 'Project Scope',         value: project.project_scope,           bullets: true  },
          ].filter(i => i.value).map(i => (
            <div key={i.label} className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-4">
              <p className="text-xs text-gray-400 mb-2">{i.label}</p>
              {i.bullets ? <BulletList value={i.value} /> : <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed">{i.value}</p>}
            </div>
          ))}

          {/* Regions */}
          {(project.regions?.length ?? 0) > 0 && (
            <div className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-4">
              <p className="text-xs text-gray-400 mb-2">Regions</p>
              <div className="flex flex-wrap gap-2">
                {project.regions!.map(r => (
                  <span key={r.region_id} className="px-3 py-1 text-xs rounded-full bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-400">
                    {r.region_name}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Implementers table */}
          {(project.implementers?.length ?? 0) > 0 && (
            <div className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-4">
              <p className="text-xs text-gray-400 mb-3">Project Implementers</p>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead><tr className="border-b border-gray-100 dark:border-gray-800 text-gray-400">
                    {['#','Vote Name','Vote Code','Sub Vote','Sub Vote Name','Implementer','Cost Center','Involvement','Role'].map(h => <th key={h} className="text-left py-1.5 pr-3 font-medium">{h}</th>)}
                  </tr></thead>
                  <tbody className="divide-y divide-gray-50 dark:divide-gray-800">
                    {project.implementers!.map((imp, idx) => (
                      <tr key={imp.link_id}>
                        <td className="py-1.5 pr-3 text-gray-400">{idx + 1}</td>
                        <td className="py-1.5 pr-3 font-medium text-gray-700 dark:text-gray-300">{imp.vote_name ?? '—'}</td>
                        <td className="py-1.5 pr-3 text-gray-500">{imp.vote_code ?? '—'}</td>
                        <td className="py-1.5 pr-3 text-gray-500">{imp.sub_vote_code ?? '—'}</td>
                        <td className="py-1.5 pr-3 text-gray-500">{imp.sub_vote_name ?? '—'}</td>
                        <td className="py-1.5 pr-3 text-gray-700 dark:text-gray-300">{imp.name}</td>
                        <td className="py-1.5 pr-3 text-gray-500">{imp.cost_center ?? '—'}</td>
                        <td className="py-1.5 pr-3 text-gray-500">{imp.involvement ?? '—'}</td>
                        <td className="py-1.5 text-gray-500 capitalize">{(imp as any).role_type ?? 'implementer'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Coordinators */}
          {(project.coordinators?.length ?? 0) > 0 && (
            <div className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-4">
              <p className="text-xs text-gray-400 mb-3">Project Coordinators</p>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead><tr className="border-b border-gray-100 dark:border-gray-800 text-gray-400">
                    {['#','Name','Email','Phone','Address'].map(h => <th key={h} className="text-left py-1.5 pr-3 font-medium">{h}</th>)}
                  </tr></thead>
                  <tbody className="divide-y divide-gray-50 dark:divide-gray-800">
                    {project.coordinators!.map((c, idx) => (
                      <tr key={c.coordinator_id}>
                        <td className="py-1.5 pr-3 text-gray-400">{idx + 1}</td>
                        <td className="py-1.5 pr-3 font-medium text-gray-700 dark:text-gray-300">{c.full_name}</td>
                        <td className="py-1.5 pr-3 text-gray-500">{c.email ?? '—'}</td>
                        <td className="py-1.5 pr-3 text-gray-500">{c.phone_number ?? '—'}</td>
                        <td className="py-1.5 text-gray-500">{c.address ?? '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Employment */}
          {(project.employment?.length ?? 0) > 0 && (
            <div className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-4">
              <p className="text-xs text-gray-400 mb-3">Employment Category</p>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead><tr className="border-b border-gray-100 dark:border-gray-800 text-gray-400">
                    {['#','Category','Type','Foreign','Domestic','Sub Total'].map(h => <th key={h} className="text-left py-1.5 pr-3 font-medium">{h}</th>)}
                  </tr></thead>
                  <tbody className="divide-y divide-gray-50 dark:divide-gray-800">
                    {project.employment!.map((e, idx) => (
                      <tr key={e.employment_id}>
                        <td className="py-1.5 pr-3 text-gray-400">{idx + 1}</td>
                        <td className="py-1.5 pr-3 font-medium text-gray-700 dark:text-gray-300">{e.category}</td>
                        <td className="py-1.5 pr-3 text-gray-500">{e.type}</td>
                        <td className="py-1.5 pr-3 text-gray-500">{e.foreign_count}</td>
                        <td className="py-1.5 pr-3 text-gray-500">{e.domestic_count}</td>
                        <td className="py-1.5 font-medium text-gray-700 dark:text-gray-300">{(e.foreign_count + e.domestic_count).toLocaleString()}</td>
                      </tr>
                    ))}
                    <tr className="border-t-2 border-gray-200 dark:border-gray-700 font-semibold">
                      <td colSpan={3} className="py-2 pr-3 text-gray-600 dark:text-gray-400">Total</td>
                      <td className="py-2 pr-3 text-gray-700 dark:text-gray-300">{project.employment!.reduce((s,e) => s + e.foreign_count, 0)}</td>
                      <td className="py-2 pr-3 text-gray-700 dark:text-gray-300">{project.employment!.reduce((s,e) => s + e.domestic_count, 0)}</td>
                      <td className="py-2 text-brand-600 dark:text-brand-400">{project.employment!.reduce((s,e) => s + e.foreign_count + e.domestic_count, 0).toLocaleString()}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── OBJECTIVES TAB ── */}
      {tab === 'objectives' && (
        <div className="space-y-3">
          <div className="flex justify-end">
            <button onClick={() => setModal('objective')}
              className="flex items-center gap-2 px-4 py-2 text-sm bg-brand-500 text-white rounded-lg hover:bg-brand-600">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
              Add Objective
            </button>
          </div>
          {objectives.length === 0 ? (
            <div className="text-center py-16 text-gray-400">No objectives yet. Add the first one.</div>
          ) : objectives.map(o => (
            <div key={o.objective_id} className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="text-sm font-semibold text-gray-800 dark:text-white">{o.title}</h3>
                    <StatusBadge status={o.status} />
                    <span className={`px-2 py-0.5 text-xs rounded-full ${
                      o.priority === 'high' ? 'bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-400' :
                      o.priority === 'medium' ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-500/20 dark:text-yellow-400' :
                      'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400'
                    }`}>{o.priority}</span>
                  </div>
                  {o.description && <p className="text-xs text-gray-500 mt-1.5 line-clamp-2">{o.description}</p>}
                </div>
                <p className="text-xs text-gray-400 flex-shrink-0">
                  {targets.filter(t => t.objective_id === o.objective_id).length} targets
                </p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── TARGETS TAB ── */}
      {tab === 'targets' && (
        <div className="space-y-3">
          <div className="flex justify-end">
            <button onClick={() => setModal('target')} disabled={objectives.length === 0}
              className="flex items-center gap-2 px-4 py-2 text-sm bg-brand-500 text-white rounded-lg hover:bg-brand-600 disabled:opacity-50 disabled:cursor-not-allowed"
              title={objectives.length === 0 ? 'Add an objective first' : ''}>
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
              Add Target
            </button>
          </div>
          {targets.length === 0 ? (
            <div className="text-center py-16 text-gray-400">No targets yet.</div>
          ) : targets.map(t => {
            const obj = objectives.find(o => o.objective_id === t.objective_id);
            const progress = t.target_value > 0 ? (t.current_value / t.target_value) * 100 : 0;
            return (
              <div key={t.target_id} className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-4">
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div>
                    <h3 className="text-sm font-semibold text-gray-800 dark:text-white">{t.name}</h3>
                    {obj && <p className="text-xs text-gray-400 mt-0.5">↳ {obj.title}</p>}
                  </div>
                  <StatusBadge status={t.status} />
                </div>
                {/* Compute paid total for this target */}
                {(() => {
                  const tActs    = activities.filter(a => a.target_id === t.target_id);
                  const totalPaid = tActs.reduce((s, a) => s + Number((a as any).total_paid || 0), 0);
                  return (
                    <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 text-xs mb-3">
                      <div><p className="text-gray-400">Target</p><p className="font-medium text-gray-700 dark:text-gray-300">{t.target_value} {t.unit}</p></div>
                      <div><p className="text-gray-400">Current</p><p className="font-medium text-gray-700 dark:text-gray-300">{t.current_value} {t.unit}</p></div>
                      <div><p className="text-gray-400">Activities</p><p className="font-medium text-gray-700 dark:text-gray-300">{tActs.length}</p></div>
                      <div>
                        <p className="text-gray-400">Paid</p>
                        <p className={`font-medium ${totalPaid > 0 ? 'text-green-600 dark:text-green-400' : 'text-gray-400'}`}>
                          {totalPaid > 0 ? fmt(totalPaid) : '—'}
                        </p>
                      </div>
                      <div>
                        <p className="text-gray-400">Budget</p>
                        <div className="flex items-center gap-1.5">
                          <p className={`font-medium text-xs ${t.allocated_budget > 0 ? 'text-gray-700 dark:text-gray-300' : 'text-orange-500'}`}>
                            {t.allocated_budget > 0 ? fmt(t.allocated_budget) : 'Not set'}
                          </p>
                          <button onClick={() => { setAllocateTarget(t); setModal('allocate'); }}
                            className="text-brand-500 hover:text-brand-600 underline text-[10px] flex-shrink-0">
                            {t.allocated_budget > 0 ? 'Edit' : 'Set'}
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })()}
                <BudgetBar value={progress} label="Progress" />
              </div>
            );
          })}
        </div>
      )}

      {/* ── ACTIVITIES TAB ── */}
      {tab === 'activities' && (
        <div className="space-y-3">
          <div className="flex justify-end">
            <button
              onClick={() => targets.length > 0 ? navigate(`/activities/new?project_id=${pid}`) : undefined}
              disabled={targets.length === 0}
              className="flex items-center gap-2 px-4 py-2 text-sm bg-brand-500 text-white rounded-lg hover:bg-brand-600 disabled:opacity-50 disabled:cursor-not-allowed"
              title={targets.length === 0 ? 'Add a target first' : 'Create a new activity'}>
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
              Add Activity
            </button>
          </div>
          {activities.length === 0 ? (
            <div className="text-center py-16 text-gray-400">No activities yet.</div>
          ) : activities.map(a => (
            <div key={a.activity_id} className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-4">
              <div className="flex items-start justify-between gap-3 mb-2">
                <div className="flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="text-sm font-semibold text-gray-800 dark:text-white">{a.name}</h3>
                    <StatusBadge status={a.status} />
                  </div>
                  <div className="flex gap-3 mt-1 text-xs text-gray-400 flex-wrap">
                    {a.region_name && <span><svg className="w-3 h-3 inline-block flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" /><path strokeLinecap="round" strokeLinejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" /></svg> {a.region_name}</span>}
                    {a.assigned_user_name && <span><svg className="w-3 h-3 inline-block flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg> {a.assigned_user_name}</span>}
                    {a.council && <span><svg className="w-3 h-3 inline-block flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" /></svg> {a.council}</span>}
                  </div>
                </div>
                <Link to={`/activities/${a.activity_id}`}
                  className="text-xs text-brand-500 hover:text-brand-600 flex-shrink-0">View →</Link>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs mb-2">
                <div>
                  <p className="text-gray-400">Budget</p>
                  <p className="font-medium text-gray-700 dark:text-gray-300">
                    {fmt((a as any).effective_budget ?? (a as any).budgeted_amount)}
                  </p>
                </div>
                <div>
                  <p className="text-gray-400">Paid</p>
                  <p className={`font-medium ${Number((a as any).total_paid) > 0 ? 'text-green-600 dark:text-green-400' : 'text-gray-400'}`}>
                    {Number((a as any).total_paid) > 0 ? fmt((a as any).total_paid) : '—'}
                  </p>
                </div>
                <div>
                  <p className="text-gray-400">Progress</p>
                  <p className="font-medium text-gray-700 dark:text-gray-300">{a.progress}%</p>
                </div>
                <div>
                  <p className="text-gray-400">End Date</p>
                  <p className="font-medium text-gray-700 dark:text-gray-300">{dt(a.end_date)}</p>
                </div>
              </div>
              <BudgetBar value={a.progress} status={a.status} />
            </div>
          ))}
        </div>
      )}

      {/* ── DOCUMENTS TAB ── */}
      {tab === 'documents' && (
        <div className="space-y-4">
          {/* Upload */}
          <div className="rounded-xl border border-dashed border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 p-5 text-center">
            <label className="cursor-pointer block">
              <input type="file" className="hidden"
                onChange={async (e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  setUploadingDoc(true);
                  const fd = new FormData();
                  fd.append('file', file);
                  fd.append('name', file.name);
                  try {
                    const res = await documentsApi.upload(pid, fd);
                    setDocuments(prev => [res.data, ...prev]);
                  } catch { /* silent */ }
                  finally { setUploadingDoc(false); e.target.value = ''; }
                }}
              />
              {uploadingDoc ? (
                <div className="flex items-center justify-center gap-2 text-sm text-gray-500">
                  <div className="w-4 h-4 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
                  Uploading...
                </div>
              ) : (
                <>
                  <svg className="w-8 h-8 text-gray-400 mx-auto mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                  </svg>
                  <p className="text-sm text-gray-500 dark:text-gray-400">Click to upload project document</p>
                  <p className="text-xs text-gray-400 mt-1">PDF, JPG, PNG, DOCX up to 50MB</p>
                </>
              )}
            </label>
          </div>

          {/* Document list */}
          {documents.length === 0 ? (
            <p className="text-center py-8 text-sm text-gray-400">No documents uploaded yet</p>
          ) : (
            <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 overflow-hidden">
              {documents.map((doc: any) => (
                <div key={doc.document_id}
                  className="flex items-center gap-4 px-4 py-3 border-b border-gray-100 dark:border-gray-800 last:border-0 hover:bg-gray-50 dark:hover:bg-gray-800/50">
                  <div className="w-9 h-9 rounded-lg bg-gray-100 dark:bg-gray-800 flex items-center justify-center flex-shrink-0">
                    <svg className="w-4 h-4 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-800 dark:text-white truncate">{doc.name}</p>
                    <p className="text-xs text-gray-400">
                      {doc.uploaded_by_name ?? doc.created_by}
                      {doc.size ? ` · ${(doc.size / 1024).toFixed(1)} KB` : ''}
                      {doc.version_number ? ` · v${doc.version_number}` : ''}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <button
                      onClick={() => setPreviewDoc({ url: fileUrl(doc), name: doc.name, mime: doc.mime_type })}
                      className="px-2.5 py-1 text-xs text-brand-600 dark:text-brand-400 hover:bg-brand-50 dark:hover:bg-brand-500/10 rounded-md"
                    >Preview</button>
                    <a href={fileUrl(doc)} download={doc.name}
                      className="px-2.5 py-1 text-xs text-gray-500 hover:text-brand-600 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-md">
                      Download
                    </a>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* File Preview */}
      {previewDoc && (
        <FilePreview url={previewDoc.url} name={previewDoc.name} mimeType={previewDoc.mime} onClose={() => setPreviewDoc(null)} />
      )}

      {/* ── Modals ── */}
      <Modal isOpen={modal === 'objective'} onClose={() => setModal(null)} title="Add Objective" size="md">
        <ObjectiveForm projectId={pid} onSaved={loadAll} onClose={() => setModal(null)} />
      </Modal>

      <Modal isOpen={modal === 'target'} onClose={() => setModal(null)} title="Add Target" size="md">
        <TargetForm objectives={objectives} onSaved={loadAll} onClose={() => setModal(null)} />
      </Modal>

      {/* Activity creation uses the full standalone form at /activities/new */}

      <Modal isOpen={modal === 'allocate' && !!allocateTarget} onClose={() => setModal(null)} title="Allocate Budget to Target" size="sm">
        {allocateTarget && (
          <AllocateBudgetForm
            target={allocateTarget}
            projectBudget={project?.estimated_cost ?? 0}
            onSaved={loadAll}
            onClose={() => setModal(null)}
          />
        )}
      </Modal>

    </div>
  );
}
