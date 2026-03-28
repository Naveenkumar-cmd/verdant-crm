import usePageTitle from '../hooks/usePageTitle';
// src/pages/Activities.js
import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { Modal, ConfirmDialog, Badge, Spinner, EmptyState, FormGroup, FormRow } from '../components/ui/index';
import RecordDrawer from '../components/modules/RecordDrawer';
import toast from 'react-hot-toast';
import { Plus, Search, Pencil, Trash2, Activity, Phone, Mail, Users, FileText, Video } from 'lucide-react';

const ACTIVITY_TYPES = ['call','email','meeting','note','task','demo','follow_up'];
const TYPE_ICONS  = { call: Phone, email: Mail, meeting: Users, note: FileText, task: FileText, demo: Video, follow_up: Phone };
const TYPE_COLORS = { call:'green', email:'blue', meeting:'purple', note:'gray', task:'amber', demo:'purple', follow_up:'amber' };
const EMPTY = {
  type:'call', subject:'', description:'', outcome:'',
  activity_date: new Date().toISOString().slice(0,16),
  duration_mins:'', call_direction:'outbound', call_result:'',
  location:'', meeting_url:'', owner_id:'',
};

export default function Activities() {
  const { profile } = useAuth();
  const orgId = profile?.org_id;
  usePageTitle('Activities');
  const [activities, setActivities]   = useState([]);
  const [users, setUsers]             = useState([]);
  const [loading, setLoading]         = useState(true);
  const [search, setSearch]           = useState('');
  const [typeFilter, setTypeFilter]   = useState('');
  const [showModal, setShowModal]     = useState(false);
  const [editing, setEditing]         = useState(null);
  const [form, setForm]               = useState(EMPTY);
  const [saving, setSaving]           = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [selectedActivity, setSelectedActivity] = useState(null);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (orgId) {
      fetchActivities(); fetchUsers();
    } else {
      setLoading(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orgId]);

  const fetchActivities = useCallback(async () => {
    setLoading(true);
    let q = supabase.from('activities').select(`
      id, type, subject, description, outcome, activity_date,
      duration_mins, call_direction, call_result, location, meeting_url,
      email_to, email_from, email_cc, email_subject, email_body_text, email_status,
      created_at, owner_id,
      user_profiles!activities_owner_id_fkey(first_name, last_name)
    `).eq('org_id', orgId).order('activity_date', { ascending: false });
    if (typeFilter) q = q.eq('type', typeFilter);
    const { data, error } = await q;
    if (error) toast.error('Failed to load activities');
    else setActivities(data || []);
    setLoading(false);
  }, [orgId, typeFilter]);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (orgId) {
      fetchActivities();
    } else {
      setLoading(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fetchActivities]);

  const fetchUsers = async () => {
    const { data } = await supabase.from('user_profiles').select('id,first_name,last_name').eq('org_id', orgId);
    setUsers(data || []);
  };

  const openCreate = () => { setEditing(null); setForm(EMPTY); setShowModal(true); };
  const openEdit   = a  => { setEditing(a); setForm({ ...EMPTY, ...a, activity_date: a.activity_date?.slice(0,16) || '' }); setShowModal(true); };
  const set = k => e => setForm(f => ({ ...f, [k]: e.target.value }));

  const handleSave = async () => {
    if (!form.subject.trim()) { toast.error('Subject is required'); return; }
    setSaving(true);
    const payload = {
      ...form,
      org_id: orgId,
      created_by: profile.id,
      owner_id: form.owner_id || null,
      duration_mins: form.duration_mins === '' ? null : Number(form.duration_mins) || null,
      call_result: form.call_result || null,
    };
    const { error } = editing
      ? await supabase.from('activities').update(payload).eq('id', editing.id)
      : await supabase.from('activities').insert(payload);
    setSaving(false);
    if (error) toast.error(error.message);
    else { toast.success(editing ? 'Activity updated' : 'Activity logged'); setShowModal(false); fetchActivities(); }
  };

  const handleDelete = async () => {
    const { error } = await supabase.from('activities').delete().eq('id', deleteTarget.id);
    if (error) toast.error(error.message);
    else { toast.success('Deleted'); setSelectedActivity(null); fetchActivities(); }
  };

  const filtered = activities.filter(a =>
    `${a.subject} ${a.description || ''}`.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="page-container">
      <div className="page-header">
        <div><h1>Activities</h1><p className="page-subtitle">{activities.length} logged</p></div>
        <button className="btn btn-primary" onClick={openCreate}><Plus size={16} /> Log Activity</button>
      </div>

      <div className="card" style={{ marginBottom: 20, padding: '12px 16px' }}>
        <div className="filter-bar">
          <div className="search-wrap">
            <Search size={14} className="search-icon" />
            <input className="form-input" placeholder="Search activities..." value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          <select className="form-input form-select" value={typeFilter} onChange={e => setTypeFilter(e.target.value)}>
            <option value="">All Types</option>
            {ACTIVITY_TYPES.map(t => <option key={t} value={t}>{t.replace(/_/g,' ').replace(/\b\w/g,c=>c.toUpperCase())}</option>)}
          </select>
        </div>
      </div>

      <div className="card">
        {loading ? <Spinner /> : filtered.length === 0 ? (
          <EmptyState icon={Activity} title="No activities logged"
            action={<button className="btn btn-primary" onClick={openCreate}><Plus size={14} /> Log Activity</button>} />
        ) : (
          filtered.map(a => {
            const Icon = TYPE_ICONS[a.type] || Activity;
            return (
              <div key={a.id} className="activity-item">
                {/* Type icon */}
                <div style={{ width: 36, height: 36, borderRadius: '50%', background: 'var(--green-50)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 2 }}>
                  <Icon size={16} color="var(--green-600)" />
                </div>

                {/* Content — clicking subject opens drawer */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                    <span
                      style={{ fontWeight: 600, fontSize: 14, color: 'var(--green-700)', cursor: 'pointer', textDecoration: 'underline', textDecorationStyle: 'dotted', textUnderlineOffset: 3 }}
                      onClick={() => setSelectedActivity(a)}
                    >
                      {a.email_subject || a.subject}
                    </span>
                    <Badge variant={TYPE_COLORS[a.type] || 'gray'}>{a.type.replace(/_/g,' ')}</Badge>
                    {/* Email status badge */}
                    {a.type === 'email' && a.email_status && (
                      <span style={{ fontSize: 10, fontWeight: 700, padding: '1px 7px', borderRadius: 100, background: 'var(--green-50)', color: 'var(--green-700)' }}>
                        {a.email_status}
                      </span>
                    )}
                  </div>
                  {/* Email: show To line */}
                  {a.type === 'email' && a.email_to && (
                    <p style={{ fontSize: 12, color: 'var(--gray-500)', marginTop: 3 }}>To: {a.email_to}</p>
                  )}
                  {/* Email: show body preview */}
                  {a.type === 'email' && a.email_body_text && (
                    <p style={{ fontSize: 12, color: 'var(--gray-400)', marginTop: 3, lineHeight: 1.4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '100%' }}>
                      {a.email_body_text.slice(0, 120)}{a.email_body_text.length > 120 ? '…' : ''}
                    </p>
                  )}
                  {/* Non-email: description */}
                  {a.type !== 'email' && a.description && (
                    <p style={{ fontSize: 12, color: 'var(--gray-500)', marginTop: 4, lineHeight: 1.4 }}>{a.description}</p>
                  )}
                  {a.outcome && <p style={{ fontSize: 12, color: 'var(--green-700)', marginTop: 4 }}>Outcome: {a.outcome}</p>}
                  <div style={{ fontSize: 12, color: 'var(--gray-400)', marginTop: 6 }}>
                    {a.activity_date ? new Date(a.activity_date).toLocaleString() : ''}
                    {a.duration_mins ? ` · ${a.duration_mins} min` : ''}
                    {a.user_profiles ? ` · ${a.user_profiles.first_name} ${a.user_profiles.last_name}` : ''}
                  </div>
                </div>

                {/* Actions */}
                <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
                  <button className="btn btn-ghost btn-sm" onClick={() => openEdit(a)} style={{ padding: 5 }}><Pencil size={13} /></button>
                  <button className="btn btn-ghost btn-sm" onClick={() => setDeleteTarget(a)} style={{ padding: 5, color: 'var(--red-500)' }}><Trash2 size={13} /></button>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Detail drawer with notes */}
      <RecordDrawer
        isOpen={!!selectedActivity}
        onClose={() => setSelectedActivity(null)}
        title={selectedActivity?.subject || ''}
        subtitle={selectedActivity ? `${selectedActivity.type?.replace(/_/g,' ')} · ${selectedActivity.activity_date ? new Date(selectedActivity.activity_date).toLocaleDateString() : ''}` : ''}
        relatedType="activity"
        relatedId={selectedActivity?.id}
        onEdit={() => { openEdit(selectedActivity); setSelectedActivity(null); }}
        fields={selectedActivity ? [
          { label: 'Type',        value: selectedActivity.type?.replace(/_/g,' ') },
          { label: 'Date',        value: selectedActivity.activity_date ? new Date(selectedActivity.activity_date).toLocaleString() : null },
          // Email-specific fields
          ...(selectedActivity.type === 'email' ? [
            { label: 'To',          value: selectedActivity.email_to },
            { label: 'CC',          value: selectedActivity.email_cc },
            { label: 'Status',      value: selectedActivity.email_status, highlight: selectedActivity.email_status === 'sent' },
            { label: 'Subject',     value: selectedActivity.email_subject },
            { label: 'Message',     value: selectedActivity.email_body_text ? (selectedActivity.email_body_text.length > 300 ? selectedActivity.email_body_text.slice(0,300) + '…' : selectedActivity.email_body_text) : null },
          ] : [
            { label: 'Duration',    value: selectedActivity.duration_mins ? `${selectedActivity.duration_mins} min` : null },
            { label: 'Direction',   value: selectedActivity.call_direction },
            { label: 'Call Result', value: selectedActivity.call_result?.replace(/_/g,' ') },
            { label: 'Location',    value: selectedActivity.location },
            { label: 'Meeting URL', value: selectedActivity.meeting_url },
            { label: 'Outcome',     value: selectedActivity.outcome },
          ]),
          { label: 'Logged By',   value: selectedActivity.user_profiles ? `${selectedActivity.user_profiles.first_name} ${selectedActivity.user_profiles.last_name}` : null },
        ].filter(f => f.value) : []}
      />

      <Modal isOpen={showModal} onClose={() => setShowModal(false)} title={editing ? 'Edit Activity' : 'Log Activity'} size="md"
        footer={<>
          <button className="btn btn-secondary" onClick={() => setShowModal(false)}>Cancel</button>
          <button className="btn btn-primary" onClick={handleSave} disabled={saving}>{saving ? 'Saving...' : editing ? 'Update' : 'Log Activity'}</button>
        </>}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <FormRow>
            <FormGroup label="Activity Type">
              <select className="form-input form-select" value={form.type} onChange={set('type')}>
                {ACTIVITY_TYPES.map(t => <option key={t} value={t}>{t.replace(/_/g,' ').replace(/\b\w/g,c=>c.toUpperCase())}</option>)}
              </select>
            </FormGroup>
            <FormGroup label="Date & Time">
              <input type="datetime-local" className="form-input" value={form.activity_date} onChange={set('activity_date')} />
            </FormGroup>
          </FormRow>
          <FormGroup label="Subject" required>
            <input className="form-input" value={form.subject} onChange={set('subject')} placeholder="e.g. Discovery call with Acme" />
          </FormGroup>
          <FormGroup label="Description">
            <textarea className="form-input form-textarea" value={form.description} onChange={set('description')} rows={3} />
          </FormGroup>
          <FormGroup label="Outcome / Result">
            <textarea className="form-input form-textarea" value={form.outcome} onChange={set('outcome')} rows={2} placeholder="What was the result?" />
          </FormGroup>
          <FormRow>
            <FormGroup label="Duration (min)">
              <input type="number" className="form-input" value={form.duration_mins} onChange={set('duration_mins')} placeholder="30" />
            </FormGroup>
            <FormGroup label="Logged By">
              <select className="form-input form-select" value={form.owner_id} onChange={set('owner_id')}>
                <option value="">Select user</option>
                {users.map(u => <option key={u.id} value={u.id}>{u.first_name} {u.last_name}</option>)}
              </select>
            </FormGroup>
          </FormRow>
          {form.type === 'call' && (
            <FormRow>
              <FormGroup label="Call Direction">
                <select className="form-input form-select" value={form.call_direction} onChange={set('call_direction')}>
                  <option value="outbound">Outbound</option>
                  <option value="inbound">Inbound</option>
                </select>
              </FormGroup>
              <FormGroup label="Call Result">
                <select className="form-input form-select" value={form.call_result} onChange={set('call_result')}>
                  <option value="">Select...</option>
                  {['connected','voicemail','no_answer','busy','wrong_number'].map(r =>
                    <option key={r} value={r}>{r.replace(/_/g,' ').replace(/\b\w/g,c=>c.toUpperCase())}</option>)}
                </select>
              </FormGroup>
            </FormRow>
          )}
          {(form.type === 'meeting' || form.type === 'demo') && (
            <FormRow>
              <FormGroup label="Location"><input className="form-input" value={form.location} onChange={set('location')} placeholder="Office / Zoom" /></FormGroup>
              <FormGroup label="Meeting URL"><input className="form-input" value={form.meeting_url} onChange={set('meeting_url')} placeholder="https://zoom.us/..." /></FormGroup>
            </FormRow>
          )}
        </div>
      </Modal>

      <ConfirmDialog isOpen={!!deleteTarget} onClose={() => setDeleteTarget(null)} onConfirm={handleDelete}
        title="Delete Activity" message={`Delete "${deleteTarget?.subject}"?`} confirmText="Delete" />
    </div>
  );
}
