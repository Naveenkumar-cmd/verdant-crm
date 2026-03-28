import usePageTitle from '../hooks/usePageTitle';
// src/pages/Settings.js
import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { Modal, ConfirmDialog, Badge, FormGroup, FormRow, Spinner } from '../components/ui/index';
import toast from 'react-hot-toast';
import { Plus, Pencil, Trash2, GripVertical, Save } from 'lucide-react';

/* ============================================================
   ORGANIZATION SETTINGS — full company profile
   ============================================================ */
const ORG_INDUSTRIES = [
  'technology','finance','healthcare','education','retail','manufacturing',
  'real_estate','consulting','media','legal','hospitality','nonprofit','government','other',
];

export function OrganizationSettings() {
  const { organization, refreshProfile } = useAuth();
  usePageTitle('Organisation');
  const [form, setForm] = useState({
    name:'', website:'', phone:'', email:'', industry:'',
    billing_street:'', billing_city:'', billing_state:'', billing_zip:'', billing_country:'',
    timezone:'UTC', currency:'USD',
  });
  const [saving, setSaving] = useState(false);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (organization) setForm({
      name:             organization.name     || '',
      website:          organization.website  || '',
      phone:            organization.phone    || '',
      email:            organization.email    || '',
      industry:         organization.industry || '',
      billing_street:   organization.billing_street  || '',
      billing_city:     organization.billing_city    || '',
      billing_state:    organization.billing_state   || '',
      billing_zip:      organization.billing_zip     || '',
      billing_country:  organization.billing_country || '',
      timezone:         organization.timezone || 'UTC',
      currency:         organization.currency || 'USD',
    });
  }, [organization]);

  const set = k => e => setForm(f => ({ ...f, [k]: e.target.value }));

  const handleSave = async () => {
    if (!form.name.trim()) { toast.error('Company name is required'); return; }
    setSaving(true);
    const payload = {
      ...form,
      industry: form.industry || null,
    };
    const { error } = await supabase.from('organizations').update(payload).eq('id', organization.id);
    setSaving(false);
    if (error) toast.error(error.message);
    else { toast.success('Organisation updated'); refreshProfile(); }
  };

  if (!organization) return <Spinner />;

  return (
    <div className="page-container">
      <div className="page-header">
        <div><h1>Organisation</h1><p className="page-subtitle">Your company profile and workspace settings</p></div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 20, maxWidth: 680, width: '100%' }}>

        {/* Company Details */}
        <div className="card">
          <div className="card-header"><h3 style={{ fontSize: 15 }}>Company Details</h3></div>
          <div className="card-body">
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <FormGroup label="Company Name" required>
                <input className="form-input" value={form.name} onChange={set('name')} placeholder="Acme Inc." />
              </FormGroup>
              <FormRow>
                <FormGroup label="Website">
                  <input className="form-input" value={form.website} onChange={set('website')} placeholder="https://acme.com" />
                </FormGroup>
                <FormGroup label="Phone">
                  <input className="form-input" value={form.phone} onChange={set('phone')} placeholder="+1 555 0000" />
                </FormGroup>
              </FormRow>
              <FormRow>
                <FormGroup label="Email">
                  <input type="email" className="form-input" value={form.email} onChange={set('email')} placeholder="hello@acme.com" />
                </FormGroup>
                <FormGroup label="Industry">
                  <select className="form-input form-select" value={form.industry} onChange={set('industry')}>
                    <option value="">Select industry</option>
                    {ORG_INDUSTRIES.map(i => <option key={i} value={i}>{i.replace(/_/g,' ').replace(/\b\w/g,c=>c.toUpperCase())}</option>)}
                  </select>
                </FormGroup>
              </FormRow>
            </div>
          </div>
        </div>

        {/* Address */}
        <div className="card">
          <div className="card-header"><h3 style={{ fontSize: 15 }}>Company Address</h3></div>
          <div className="card-body">
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <FormGroup label="Street">
                <input className="form-input" value={form.billing_street} onChange={set('billing_street')} placeholder="123 Main Street" />
              </FormGroup>
              <FormRow cols={3}>
                <FormGroup label="City">
                  <input className="form-input" value={form.billing_city} onChange={set('billing_city')} />
                </FormGroup>
                <FormGroup label="State / Region">
                  <input className="form-input" value={form.billing_state} onChange={set('billing_state')} />
                </FormGroup>
                <FormGroup label="ZIP / Postcode">
                  <input className="form-input" value={form.billing_zip} onChange={set('billing_zip')} />
                </FormGroup>
              </FormRow>
              <FormGroup label="Country">
                <input className="form-input" value={form.billing_country} onChange={set('billing_country')} placeholder="United States" />
              </FormGroup>
            </div>
          </div>
        </div>

        {/* Preferences */}
        <div className="card">
          <div className="card-header"><h3 style={{ fontSize: 15 }}>Workspace Preferences</h3></div>
          <div className="card-body">
            <FormRow>
              <FormGroup label="Timezone">
                <select className="form-input form-select" value={form.timezone} onChange={set('timezone')}>
                  {['UTC','America/New_York','America/Chicago','America/Denver','America/Los_Angeles','Europe/London','Europe/Paris','Asia/Kolkata','Asia/Tokyo','Australia/Sydney'].map(tz =>
                    <option key={tz} value={tz}>{tz}</option>
                  )}
                </select>
              </FormGroup>
              <FormGroup label="Currency">
                <select className="form-input form-select" value={form.currency} onChange={set('currency')}>
                  {['USD','EUR','GBP','INR','CAD','AUD','JPY'].map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </FormGroup>
            </FormRow>
          </div>
        </div>

        <div>
          <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
            <Save size={14} /> {saving ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ============================================================
   PIPELINE STAGES SETTINGS
   ============================================================ */
export function PipelineSettings() {
  const { profile } = useAuth();
  usePageTitle('Pipeline Stages');
  const orgId = profile?.org_id;
  const [stages, setStages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({ name:'', description:'', probability:20, color:'#16a34a', is_won:false, is_lost:false });
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);

  useEffect(() => {
    if (orgId) {
      fetchStages();
    } else {
      setLoading(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orgId]);

  const fetchStages = async () => {
    setLoading(true);
    const { data } = await supabase.from('pipeline_stages').select('*').eq('org_id', orgId).order('display_order');
    setStages(data || []);
    setLoading(false);
  };

  const openCreate = () => { setEditing(null); setForm({ name:'', description:'', probability:20, color:'#16a34a', is_won:false, is_lost:false }); setShowModal(true); };
  const openEdit   = s => { setEditing(s); setForm({ ...s }); setShowModal(true); };
  const set = k => e => { const v = e.target.type === 'checkbox' ? e.target.checked : e.target.type === 'number' ? parseInt(e.target.value) : e.target.value; setForm(f => ({ ...f, [k]: v })); };

  const handleSave = async () => {
    if (!form.name.trim()) { toast.error('Stage name required'); return; }
    setSaving(true);
    const payload = { ...form, org_id: orgId, display_order: editing?.display_order ?? stages.length };
    const { error } = editing
      ? await supabase.from('pipeline_stages').update(payload).eq('id', editing.id)
      : await supabase.from('pipeline_stages').insert(payload);
    setSaving(false);
    if (error) toast.error(error.message); else { toast.success(editing ? 'Stage updated' : 'Stage created'); setShowModal(false); fetchStages(); }
  };

  const handleDelete = async () => {
    const { error } = await supabase.from('pipeline_stages').delete().eq('id', deleteTarget.id);
    if (error) toast.error(error.message); else { toast.success('Stage deleted'); fetchStages(); }
  };

  return (
    <div className="page-container">
      <div className="page-header">
        <div><h1>Pipeline Stages</h1><p className="page-subtitle">Customize your sales pipeline</p></div>
        <button className="btn btn-primary" onClick={openCreate}><Plus size={16} /> Add Stage</button>
      </div>
      <div className="card">
        {loading ? <Spinner /> : (
          <div>
            {stages.map(stage => (
              <div key={stage.id} className="pipeline-stage-row">
                <GripVertical size={16} color="var(--gray-300)" style={{ flexShrink: 0 }} />
                <div style={{ width: 12, height: 12, borderRadius: '50%', background: stage.color, flexShrink: 0 }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 600, fontSize: 14 }}>{stage.name}</div>
                  {stage.description && <div style={{ fontSize: 12, color: 'var(--gray-500)' }}>{stage.description}</div>}
                </div>
                <div style={{ fontSize: 13, color: 'var(--gray-600)', flexShrink: 0 }}>
                  <strong>{stage.probability}%</strong>
                </div>
                {stage.is_won  && <Badge variant="green">Won</Badge>}
                {stage.is_lost && <Badge variant="red">Lost</Badge>}
                <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
                  <button className="btn btn-ghost btn-sm" onClick={() => openEdit(stage)} style={{ padding: 5 }}><Pencil size={13} /></button>
                  <button className="btn btn-ghost btn-sm" onClick={() => setDeleteTarget(stage)} style={{ padding: 5, color: 'var(--red-500)' }}><Trash2 size={13} /></button>
                </div>
              </div>
            ))}
            {stages.length === 0 && <div className="empty-state"><p>No pipeline stages defined yet.</p></div>}
          </div>
        )}
      </div>

      <Modal isOpen={showModal} onClose={() => setShowModal(false)} title={editing ? 'Edit Stage' : 'New Stage'} size="sm"
        footer={<>
          <button className="btn btn-secondary" onClick={() => setShowModal(false)}>Cancel</button>
          <button className="btn btn-primary" onClick={handleSave} disabled={saving}>{saving ? 'Saving...' : 'Save'}</button>
        </>}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <FormGroup label="Stage Name" required><input className="form-input" value={form.name} onChange={set('name')} placeholder="e.g. Proposal" /></FormGroup>
          <FormGroup label="Description"><input className="form-input" value={form.description} onChange={set('description')} /></FormGroup>
          <FormRow>
            <FormGroup label="Win Probability (%)"><input type="number" min="0" max="100" className="form-input" value={form.probability} onChange={set('probability')} /></FormGroup>
            <FormGroup label="Color"><input type="color" className="form-input" value={form.color} onChange={set('color')} style={{ height: 40, padding: '4px 6px', cursor: 'pointer' }} /></FormGroup>
          </FormRow>
          <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap' }}>
            <label style={{ display: 'flex', gap: 8, alignItems: 'center', cursor: 'pointer', fontSize: 13 }}><input type="checkbox" checked={form.is_won} onChange={set('is_won')} /> Mark as Won</label>
            <label style={{ display: 'flex', gap: 8, alignItems: 'center', cursor: 'pointer', fontSize: 13 }}><input type="checkbox" checked={form.is_lost} onChange={set('is_lost')} /> Mark as Lost</label>
          </div>
        </div>
      </Modal>

      <ConfirmDialog isOpen={!!deleteTarget} onClose={() => setDeleteTarget(null)} onConfirm={handleDelete}
        title="Delete Stage" message={`Delete stage "${deleteTarget?.name}"? Deals in this stage will lose their stage.`} confirmText="Delete Stage" />
    </div>
  );
}

/* ============================================================
   CUSTOM FIELDS SETTINGS
   ============================================================ */
const MODULES     = ['leads','contacts','accounts','deals','tasks','products','tickets'];
const FIELD_TYPES = ['text','textarea','number','decimal','boolean','date','datetime','select','multiselect','email','phone','url','currency','percent'];

export function CustomFieldsSettings() {
  const { profile } = useAuth();
  usePageTitle('Custom Fields');
  const orgId = profile?.org_id;
  const [fields, setFields] = useState([]);
  const [loading, setLoading] = useState(true);
  const [moduleFilter, setModuleFilter] = useState('leads');
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({ module_name:'leads', field_name:'', field_label:'', field_type:'text', is_required:false, is_visible:true, default_value:'', options:'' });
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (orgId) {
      fetchFields();
    } else {
      setLoading(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orgId, moduleFilter]);

  const fetchFields = async () => {
    setLoading(true);
    const { data } = await supabase.from('custom_field_definitions').select('*').eq('org_id', orgId).eq('module_name', moduleFilter).order('display_order');
    setFields(data || []);
    setLoading(false);
  };

  const openCreate = () => { setEditing(null); setForm({ module_name: moduleFilter, field_name:'', field_label:'', field_type:'text', is_required:false, is_visible:true, default_value:'', options:'' }); setShowModal(true); };
  const openEdit   = f => { setEditing(f); setForm({ ...f, options: f.options ? JSON.stringify(f.options) : '' }); setShowModal(true); };
  const set = k => e => { const v = e.target.type === 'checkbox' ? e.target.checked : e.target.value; setForm(f => ({ ...f, [k]: v })); };

  const handleSave = async () => {
    if (!form.field_name.trim() || !form.field_label.trim()) { toast.error('Field name and label are required'); return; }
    const fieldNameClean = form.field_name.toLowerCase().replace(/\s+/g,'_').replace(/[^a-z0-9_]/g,'');
    setSaving(true);
    let parsedOptions = null;
    if (form.options && (form.field_type === 'select' || form.field_type === 'multiselect')) {
      try { parsedOptions = JSON.parse(form.options); }
      catch { parsedOptions = form.options.split('\n').filter(Boolean).map(o => ({ label: o.trim(), value: o.trim().toLowerCase().replace(/\s+/g,'_') })); }
    }
    const payload = { ...form, field_name: fieldNameClean, org_id: orgId, display_order: editing?.display_order ?? fields.length, options: parsedOptions };
    const { error } = editing
      ? await supabase.from('custom_field_definitions').update(payload).eq('id', editing.id)
      : await supabase.from('custom_field_definitions').insert(payload);
    setSaving(false);
    if (error) toast.error(error.message); else { toast.success(editing ? 'Field updated' : 'Field created'); setShowModal(false); fetchFields(); }
  };

  const handleDelete = async () => {
    const { error } = await supabase.from('custom_field_definitions').delete().eq('id', deleteTarget.id);
    if (error) toast.error(error.message); else { toast.success('Field deleted'); fetchFields(); }
  };

  return (
    <div className="page-container">
      <div className="page-header">
        <div><h1>Custom Fields</h1><p className="page-subtitle">Add custom fields to any module</p></div>
        <button className="btn btn-primary" onClick={openCreate}><Plus size={16} /> Add Field</button>
      </div>

      {/* Module tabs — horizontal scroll on mobile */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 20, flexWrap: 'wrap' }}>
        {MODULES.map(m => (
          <button key={m} className={`btn ${moduleFilter === m ? 'btn-primary' : 'btn-secondary'} btn-sm`}
            onClick={() => setModuleFilter(m)} style={{ textTransform: 'capitalize' }}>{m}</button>
        ))}
      </div>

      <div className="card">
        {loading ? <Spinner /> : fields.length === 0 ? (
          <div className="empty-state">
            <p>No custom fields for {moduleFilter} yet.</p>
            <button className="btn btn-primary btn-sm" onClick={openCreate} style={{ marginTop: 12 }}><Plus size={13} /> Add Field</button>
          </div>
        ) : (
          <div className="table-container" style={{ border: 'none', borderRadius: 0 }}>
            <table>
              <thead><tr>
                <th>Label</th>
                <th className="hide-mobile">Field Name</th>
                <th>Type</th>
                <th className="hide-mobile">Required</th>
                <th className="hide-mobile">Visible</th>
                <th style={{ width: 80 }}>Actions</th>
              </tr></thead>
              <tbody>
                {fields.map(f => (
                  <tr key={f.id}>
                    <td>
                      <div style={{ fontWeight: 600 }}>{f.field_label}</div>
                      <div className="show-mobile" style={{ fontSize: 11, color: 'var(--gray-400)', fontFamily: 'monospace', marginTop: 2 }}>{f.field_name}</div>
                    </td>
                    <td className="hide-mobile" style={{ fontSize: 12, color: 'var(--gray-500)', fontFamily: 'monospace' }}>{f.field_name}</td>
                    <td><Badge variant="gray">{f.field_type}</Badge></td>
                    <td className="hide-mobile">{f.is_required ? '✅' : '—'}</td>
                    <td className="hide-mobile">{f.is_visible ? '✅' : '—'}</td>
                    <td>
                      <div style={{ display: 'flex', gap: 4 }}>
                        <button className="btn btn-ghost btn-sm" onClick={() => openEdit(f)} style={{ padding: 5 }}><Pencil size={13} /></button>
                        <button className="btn btn-ghost btn-sm" onClick={() => setDeleteTarget(f)} style={{ padding: 5, color: 'var(--red-500)' }}><Trash2 size={13} /></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <Modal isOpen={showModal} onClose={() => setShowModal(false)} title={editing ? 'Edit Custom Field' : 'New Custom Field'} size="md"
        footer={<>
          <button className="btn btn-secondary" onClick={() => setShowModal(false)}>Cancel</button>
          <button className="btn btn-primary" onClick={handleSave} disabled={saving}>{saving ? 'Saving...' : 'Save Field'}</button>
        </>}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <FormGroup label="Module">
            <select className="form-input form-select" value={form.module_name} onChange={set('module_name')}>
              {MODULES.map(m => <option key={m} value={m}>{m.charAt(0).toUpperCase()+m.slice(1)}</option>)}
            </select>
          </FormGroup>
          <FormRow>
            <FormGroup label="Field Label" required><input className="form-input" value={form.field_label} onChange={set('field_label')} placeholder="e.g. LinkedIn Profile" /></FormGroup>
            <FormGroup label="Field Name (key)" required><input className="form-input" value={form.field_name} onChange={set('field_name')} placeholder="linkedin_profile" /></FormGroup>
          </FormRow>
          <FormGroup label="Field Type">
            <select className="form-input form-select" value={form.field_type} onChange={set('field_type')}>
              {FIELD_TYPES.map(t => <option key={t} value={t}>{t.charAt(0).toUpperCase()+t.slice(1)}</option>)}
            </select>
          </FormGroup>
          {(form.field_type === 'select' || form.field_type === 'multiselect') && (
            <FormGroup label="Options (one per line)" hint='e.g. Option A\nOption B'>
              <textarea className="form-input form-textarea" value={form.options} onChange={set('options')} rows={4} placeholder={"Option A\nOption B\nOption C"} />
            </FormGroup>
          )}
          <FormGroup label="Default Value"><input className="form-input" value={form.default_value} onChange={set('default_value')} /></FormGroup>
          <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap' }}>
            <label style={{ display: 'flex', gap: 8, alignItems: 'center', cursor: 'pointer', fontSize: 13 }}><input type="checkbox" checked={form.is_required} onChange={set('is_required')} /> Required</label>
            <label style={{ display: 'flex', gap: 8, alignItems: 'center', cursor: 'pointer', fontSize: 13 }}><input type="checkbox" checked={form.is_visible} onChange={set('is_visible')} /> Visible</label>
          </div>
        </div>
      </Modal>

      <ConfirmDialog isOpen={!!deleteTarget} onClose={() => setDeleteTarget(null)} onConfirm={handleDelete}
        title="Delete Field" message={`Delete field "${deleteTarget?.field_label}"?`} confirmText="Delete Field" />
    </div>
  );
}

/* ============================================================
   USERS SETTINGS
   ============================================================ */
const ROLES = ['admin','manager','sales_rep','viewer'];
const ROLE_COLORS = { admin:'red', manager:'purple', sales_rep:'green', viewer:'gray' };

export function UsersSettings() {
  const { profile } = useAuth();
  usePageTitle('Users & Roles');
  const orgId = profile?.org_id;
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({ first_name:'', last_name:'', email:'', role:'sales_rep', title:'', department:'', is_active:true });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (orgId) {
      fetchUsers();
    } else {
      setLoading(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orgId]);

  const fetchUsers = async () => {
    setLoading(true);
    const { data } = await supabase.from('user_profiles').select('*').eq('org_id', orgId).order('first_name');
    setUsers(data || []);
    setLoading(false);
  };

  const openEdit = u => { setEditing(u); setForm({ first_name: u.first_name||'', last_name: u.last_name||'', email: u.email, role: u.role, title: u.title||'', department: u.department||'', is_active: u.is_active }); setShowModal(true); };
  const set = k => e => { const v = e.target.type === 'checkbox' ? e.target.checked : e.target.value; setForm(f => ({ ...f, [k]: v })); };

  const handleSave = async () => {
    setSaving(true);
    const { error } = await supabase.from('user_profiles').update(form).eq('id', editing.id);
    setSaving(false);
    if (error) toast.error(error.message); else { toast.success('User updated'); setShowModal(false); fetchUsers(); }
  };

  return (
    <div className="page-container">
      <div className="page-header">
        <div><h1>Users & Roles</h1><p className="page-subtitle">{users.length} team members</p></div>
      </div>

      <div style={{ background: 'var(--green-50)', border: '1px solid var(--green-200)', borderRadius: 8, padding: '12px 16px', marginBottom: 20, fontSize: 13, color: 'var(--green-800)' }}>
        💡 <strong>To add new teammates</strong>, go to <a href="/invites" style={{ color: 'var(--green-700)', fontWeight: 600 }}>Team Invites</a>. Create an invite for their email, send them the link, and they sign up using that email. Once confirmed and signed in, they appear here automatically.
      </div>

      <div className="card">
        {loading ? <Spinner /> : (
          <div className="table-container" style={{ border: 'none', borderRadius: 0 }}>
            <table>
              <thead><tr>
                <th>Name</th>
                <th className="hide-mobile">Email</th>
                <th>Role</th>
                <th className="hide-mobile">Title</th>
                <th className="hide-mobile">Department</th>
                <th>Status</th>
                <th style={{ width: 60 }}>Edit</th>
              </tr></thead>
              <tbody>
                {users.map(u => (
                  <tr key={u.id}>
                    <td>
                      <div style={{ fontWeight: 600 }}>{u.first_name} {u.last_name}</div>
                      <div className="show-mobile" style={{ fontSize: 11, color: 'var(--gray-500)', marginTop: 2 }}>{u.email}</div>
                    </td>
                    <td className="hide-mobile" style={{ fontSize: 12 }}>{u.email}</td>
                    <td><Badge variant={ROLE_COLORS[u.role] || 'gray'}>{u.role?.replace('_',' ')}</Badge></td>
                    <td className="hide-mobile" style={{ fontSize: 12 }}>{u.title || '—'}</td>
                    <td className="hide-mobile" style={{ fontSize: 12 }}>{u.department || '—'}</td>
                    <td><Badge variant={u.is_active ? 'green' : 'gray'}>{u.is_active ? 'Active' : 'Inactive'}</Badge></td>
                    <td><button className="btn btn-ghost btn-sm" onClick={() => openEdit(u)} style={{ padding: 5 }}><Pencil size={13} /></button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <Modal isOpen={showModal} onClose={() => setShowModal(false)} title="Edit User" size="sm"
        footer={<>
          <button className="btn btn-secondary" onClick={() => setShowModal(false)}>Cancel</button>
          <button className="btn btn-primary" onClick={handleSave} disabled={saving}>{saving ? 'Saving...' : 'Update User'}</button>
        </>}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <FormRow>
            <FormGroup label="First Name"><input className="form-input" value={form.first_name} onChange={set('first_name')} /></FormGroup>
            <FormGroup label="Last Name"><input className="form-input" value={form.last_name} onChange={set('last_name')} /></FormGroup>
          </FormRow>
          <FormGroup label="Role">
            <select className="form-input form-select" value={form.role} onChange={set('role')}>
              {ROLES.map(r => <option key={r} value={r}>{r.replace('_',' ').replace(/\b\w/g,c=>c.toUpperCase())}</option>)}
            </select>
          </FormGroup>
          <FormRow>
            <FormGroup label="Title"><input className="form-input" value={form.title} onChange={set('title')} /></FormGroup>
            <FormGroup label="Department"><input className="form-input" value={form.department} onChange={set('department')} /></FormGroup>
          </FormRow>
          <label style={{ display: 'flex', gap: 8, alignItems: 'center', cursor: 'pointer', fontSize: 13 }}>
            <input type="checkbox" checked={form.is_active} onChange={set('is_active')} /> Active
          </label>
        </div>
      </Modal>
    </div>
  );
}
