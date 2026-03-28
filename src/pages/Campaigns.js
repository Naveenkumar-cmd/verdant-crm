import usePageTitle from '../hooks/usePageTitle';
// src/pages/Campaigns.js
import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { Modal, ConfirmDialog, Badge, Spinner, EmptyState, FormGroup, FormRow, formatCurrency, formatDate } from '../components/ui/index';
import toast from 'react-hot-toast';
import { Plus, Search, Pencil, Trash2, Megaphone } from 'lucide-react';
import RecordDrawer from '../components/modules/RecordDrawer';

const STATUSES = ['draft','active','paused','completed','cancelled'];
const TYPES    = ['email','social_media','event','webinar','content','paid_ads','other'];
const STATUS_COLORS = { draft:'gray', active:'green', paused:'amber', completed:'blue', cancelled:'red' };
const EMPTY = { name:'', type:'email', status:'draft', description:'', start_date:'', end_date:'', budget:'', actual_cost:'', expected_revenue:'', owner_id:'' };

export default function Campaigns() {
  const { profile } = useAuth();
  const orgId = profile?.org_id;
  usePageTitle('Campaigns');
  const [campaigns, setCampaigns] = useState([]);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(EMPTY);
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [selectedCampaign, setSelectedCampaign] = useState(null);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (orgId) {
      fetchCampaigns(); fetchUsers();
    } else {
      setLoading(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orgId]);

  const fetchCampaigns = async () => {
    setLoading(true);
    const { data, error } = await supabase.from('campaigns')
      .select(`*, user_profiles!campaigns_owner_id_fkey(first_name, last_name)`)
      .eq('org_id', orgId).order('created_at', { ascending: false });
    if (error) toast.error('Failed to load campaigns'); else setCampaigns(data || []);
    setLoading(false);
  };

  const fetchUsers = async () => {
    const { data } = await supabase.from('user_profiles').select('id,first_name,last_name').eq('org_id', orgId);
    setUsers(data || []);
  };

  const openCreate = () => { setEditing(null); setForm(EMPTY); setShowModal(true); };
  const openEdit = c => { setEditing(c); setForm({ ...EMPTY, ...c }); setShowModal(true); };
  const set = k => e => setForm(f => ({ ...f, [k]: e.target.value }));

  const handleSave = async () => {
    if (!form.name.trim()) { toast.error('Campaign name is required'); return; }
    setSaving(true);
    const payload = {
      ...form,
      org_id: orgId, created_by: profile.id,
      owner_id: form.owner_id || null,
      start_date: form.start_date || null, end_date: form.end_date || null,
      budget: form.budget === '' ? null : Number(form.budget) || null,
      actual_cost: form.actual_cost === '' ? null : Number(form.actual_cost) || null,
      expected_revenue: form.expected_revenue === '' ? null : Number(form.expected_revenue) || null,
    };
    const { error } = editing
      ? await supabase.from('campaigns').update(payload).eq('id', editing.id)
      : await supabase.from('campaigns').insert(payload);
    setSaving(false);
    if (error) toast.error(error.message); else { toast.success(editing ? 'Campaign updated' : 'Campaign created'); setShowModal(false); fetchCampaigns(); }
  };

  const handleDelete = async () => {
    const { error } = await supabase.from('campaigns').delete().eq('id', deleteTarget.id);
    if (error) toast.error(error.message); else { toast.success('Campaign deleted'); fetchCampaigns(); }
  };

  const filtered = campaigns.filter(c => c.name.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="page-container">
      <div className="page-header">
        <div><h1>Campaigns</h1><p className="page-subtitle">{campaigns.length} campaigns</p></div>
        <button className="btn btn-primary" onClick={openCreate}><Plus size={16} /> New Campaign</button>
      </div>

      <div className="card" style={{ marginBottom: 20, padding: '12px 16px' }}>
        <div className="filter-bar">
          <div className="search-wrap">
            <Search size={14} className="search-icon" />
            <input className="form-input" placeholder="Search campaigns..." value={search} onChange={e => setSearch(e.target.value)} />
          </div>
        </div>
      </div>

      <div className="card">
        {loading ? <Spinner /> : filtered.length === 0 ? (
          <EmptyState icon={Megaphone} title="No campaigns yet"
            action={<button className="btn btn-primary" onClick={openCreate}><Plus size={14} /> New Campaign</button>} />
        ) : (
          <div className="table-container" style={{ border: 'none', borderRadius: 0 }}>
            <table>
              <thead><tr>
                <th>Campaign</th>
                <th className="hide-mobile">Type</th>
                <th>Status</th>
                <th className="hide-mobile">Start Date</th>
                <th className="hide-mobile">End Date</th>
                <th className="hide-mobile">Budget</th>
                <th className="hide-mobile">Leads</th>
                <th style={{ width: 80 }}>Actions</th>
              </tr></thead>
              <tbody>
                {filtered.map(c => (
                  <tr key={c.id}>
                    <td>
                      <div style={{ fontWeight: 600, color: 'var(--green-700)', cursor: 'pointer', textDecoration: 'underline', textDecorationStyle: 'dotted', textUnderlineOffset: 3 }} onClick={() => setSelectedCampaign(c)}>{c.name}</div>
                      {c.description && <div style={{ fontSize: 11, color: 'var(--gray-500)' }}>{c.description.slice(0,50)}{c.description.length > 50 ? '...' : ''}</div>}
                      <div className="show-mobile" style={{ fontSize: 11, color: 'var(--gray-400)', marginTop: 2, textTransform: 'capitalize' }}>
                        {c.type?.replace(/_/g,' ')}{c.start_date ? ` · ${formatDate(c.start_date)}` : ''}
                      </div>
                    </td>
                    <td className="hide-mobile" style={{ fontSize: 12, textTransform: 'capitalize' }}>{c.type?.replace(/_/g,' ')}</td>
                    <td><Badge variant={STATUS_COLORS[c.status] || 'gray'}>{c.status}</Badge></td>
                    <td className="hide-mobile" style={{ fontSize: 13 }}>{formatDate(c.start_date)}</td>
                    <td className="hide-mobile" style={{ fontSize: 13 }}>{formatDate(c.end_date)}</td>
                    <td className="hide-mobile" style={{ fontWeight: 500 }}>{formatCurrency(c.budget)}</td>
                    <td className="hide-mobile" style={{ fontSize: 13 }}>{c.leads_generated || 0}</td>
                    <td>
                      <div style={{ display: 'flex', gap: 4 }}>
                        <button className="btn btn-ghost btn-sm" onClick={() => openEdit(c)} style={{ padding: 5 }}><Pencil size={13} /></button>
                        <button className="btn btn-ghost btn-sm" onClick={() => setDeleteTarget(c)} style={{ padding: 5, color: 'var(--red-500)' }}><Trash2 size={13} /></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <Modal isOpen={showModal} onClose={() => setShowModal(false)} title={editing ? 'Edit Campaign' : 'New Campaign'} size="md"
        footer={<>
          <button className="btn btn-secondary" onClick={() => setShowModal(false)}>Cancel</button>
          <button className="btn btn-primary" onClick={handleSave} disabled={saving}>{saving ? 'Saving...' : editing ? 'Update' : 'Create'}</button>
        </>}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <FormGroup label="Campaign Name" required><input className="form-input" value={form.name} onChange={set('name')} /></FormGroup>
          <FormRow>
            <FormGroup label="Type">
              <select className="form-input form-select" value={form.type} onChange={set('type')}>
                {TYPES.map(t => <option key={t} value={t}>{t.replace(/_/g,' ').replace(/\b\w/g,c=>c.toUpperCase())}</option>)}
              </select>
            </FormGroup>
            <FormGroup label="Status">
              <select className="form-input form-select" value={form.status} onChange={set('status')}>
                {STATUSES.map(s => <option key={s} value={s}>{s.charAt(0).toUpperCase()+s.slice(1)}</option>)}
              </select>
            </FormGroup>
          </FormRow>
          <FormRow>
            <FormGroup label="Start Date"><input type="date" className="form-input" value={form.start_date} onChange={set('start_date')} /></FormGroup>
            <FormGroup label="End Date"><input type="date" className="form-input" value={form.end_date} onChange={set('end_date')} /></FormGroup>
          </FormRow>
          <FormRow>
            <FormGroup label="Budget ($)"><input type="number" className="form-input" value={form.budget} onChange={set('budget')} /></FormGroup>
            <FormGroup label="Expected Revenue ($)"><input type="number" className="form-input" value={form.expected_revenue} onChange={set('expected_revenue')} /></FormGroup>
          </FormRow>
          <FormGroup label="Assigned To">
            <select className="form-input form-select" value={form.owner_id} onChange={set('owner_id')}>
              <option value="">Unassigned</option>
              {users.map(u => <option key={u.id} value={u.id}>{u.first_name} {u.last_name}</option>)}
            </select>
          </FormGroup>
          <FormGroup label="Description"><textarea className="form-input form-textarea" value={form.description} onChange={set('description')} rows={3} /></FormGroup>
        </div>
      </Modal>

      <RecordDrawer
        isOpen={!!selectedCampaign}
        onClose={() => setSelectedCampaign(null)}
        title={selectedCampaign?.name || ''}
        subtitle={[selectedCampaign?.type?.replace(/_/g,' '), selectedCampaign?.status].filter(Boolean).join(' · ')}
        relatedType="campaign"
        relatedId={selectedCampaign?.id}
        onEdit={() => { openEdit(selectedCampaign); setSelectedCampaign(null); }}
        fields={selectedCampaign ? [
          { label: 'Type',             value: selectedCampaign.type?.replace(/_/g,' ') },
          { label: 'Status',           value: selectedCampaign.status },
          { label: 'Start Date',       value: formatDate(selectedCampaign.start_date) },
          { label: 'End Date',         value: formatDate(selectedCampaign.end_date) },
          { label: 'Budget',           value: selectedCampaign.budget ? formatCurrency(selectedCampaign.budget) : null },
          { label: 'Expected Revenue', value: selectedCampaign.expected_revenue ? formatCurrency(selectedCampaign.expected_revenue) : null, highlight: true },
          { label: 'Actual Cost',      value: selectedCampaign.actual_cost ? formatCurrency(selectedCampaign.actual_cost) : null },
          { label: 'Leads Generated',  value: selectedCampaign.leads_generated != null ? String(selectedCampaign.leads_generated) : null },
        ].filter(f => f.value) : []}
      />

      <ConfirmDialog isOpen={!!deleteTarget} onClose={() => setDeleteTarget(null)} onConfirm={handleDelete}
        title="Delete Campaign" message={`Delete "${deleteTarget?.name}"?`} confirmText="Delete" />
    </div>
  );
}
