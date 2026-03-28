import usePageTitle from '../hooks/usePageTitle';
// src/pages/Tasks.js
import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { Modal, ConfirmDialog, PriorityBadge, Spinner, EmptyState, FormGroup, FormRow, formatDate } from '../components/ui/index';
import NotesPanel from '../components/modules/NotesPanel';
import toast from 'react-hot-toast';
import { Plus, Search, Pencil, Trash2, CheckSquare, CheckCircle2, StickyNote } from 'lucide-react';

const STATUSES      = ['not_started','in_progress','completed','deferred','cancelled'];
const PRIORITIES    = ['low','medium','high','urgent'];
const RELATED_TYPES = ['lead','contact','account','deal'];
const STATUS_COLORS = {
  not_started: { bg: 'var(--gray-100)',  color: 'var(--gray-600)'  },
  in_progress:  { bg: '#dbeafe',          color: '#1d4ed8'          },
  completed:    { bg: 'var(--green-100)', color: 'var(--green-700)' },
  deferred:     { bg: '#fef3c7',          color: '#b45309'          },
  cancelled:    { bg: '#fee2e2',          color: 'var(--red-500)'   },
};
const EMPTY = {
  title:'', description:'', status:'not_started', priority:'medium',
  due_date:'', due_time:'', related_to_type:'', related_to_id:'',
  owner_id:'', assigned_to_id:'',
};

export default function Tasks() {
  const { profile } = useAuth();
  const orgId = profile?.org_id;
  usePageTitle('Tasks');
  const [tasks, setTasks]               = useState([]);
  const [users, setUsers]               = useState([]);
  const [loading, setLoading]           = useState(true);
  const [search, setSearch]             = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [priorityFilter, setPriorityFilter] = useState('');
  const [showModal, setShowModal]       = useState(false);
  const [editing, setEditing]           = useState(null);
  const [form, setForm]                 = useState(EMPTY);
  const [saving, setSaving]             = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [expandedNotes, setExpandedNotes] = useState(null); // task id with notes open

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (orgId) {
      fetchTasks(); fetchUsers();
    } else {
      setLoading(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orgId]);

  const fetchTasks = useCallback(async () => {
    setLoading(true);
    let q = supabase.from('tasks').select(`
      id, title, description, status, priority, due_date, due_time,
      related_to_type, owner_id, assigned_to_id, completed_at,
      user_profiles!tasks_owner_id_fkey(first_name, last_name),
      assigned:user_profiles!tasks_assigned_to_id_fkey(first_name, last_name)
    `).eq('org_id', orgId).order('due_date', { ascending: true, nullsFirst: false });
    if (statusFilter)   q = q.eq('status', statusFilter);
    if (priorityFilter) q = q.eq('priority', priorityFilter);
    const { data, error } = await q;
    if (error) toast.error('Failed to load tasks');
    else setTasks(data || []);
    setLoading(false);
  }, [orgId, statusFilter, priorityFilter]);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (orgId) {
      fetchTasks();
    } else {
      setLoading(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fetchTasks]);

  const fetchUsers = async () => {
    const { data } = await supabase.from('user_profiles').select('id,first_name,last_name').eq('org_id', orgId);
    setUsers(data || []);
  };

  const openCreate = () => { setEditing(null); setForm(EMPTY); setShowModal(true); };
  const openEdit   = t  => { setEditing(t); setForm({ ...EMPTY, ...t }); setShowModal(true); };
  const set = k => e => setForm(f => ({ ...f, [k]: e.target.value }));

  const toggleComplete = async task => {
    const newStatus = task.status === 'completed' ? 'not_started' : 'completed';
    const { error } = await supabase.from('tasks').update({
      status: newStatus,
      completed_at: newStatus === 'completed' ? new Date().toISOString() : null,
    }).eq('id', task.id);
    if (error) toast.error(error.message); else fetchTasks();
  };

  const handleSave = async () => {
    if (!form.title.trim()) { toast.error('Title is required'); return; }
    setSaving(true);
    const payload = {
      ...form, org_id: orgId, created_by: profile.id,
      owner_id:        form.owner_id        || null,
      assigned_to_id:  form.assigned_to_id  || null,
      related_to_type: form.related_to_type || null,
      due_date:        form.due_date        || null,
    };
    const { error } = editing
      ? await supabase.from('tasks').update(payload).eq('id', editing.id)
      : await supabase.from('tasks').insert(payload);
    setSaving(false);
    if (error) toast.error(error.message);
    else { toast.success(editing ? 'Task updated' : 'Task created'); setShowModal(false); fetchTasks(); }
  };

  const handleDelete = async () => {
    const { error } = await supabase.from('tasks').delete().eq('id', deleteTarget.id);
    if (error) toast.error(error.message);
    else { toast.success('Task deleted'); setExpandedNotes(null); fetchTasks(); }
  };

  const filtered  = tasks.filter(t => t.title.toLowerCase().includes(search.toLowerCase()));
  const isOverdue = t => t.due_date && t.status !== 'completed' && new Date(t.due_date) < new Date();

  return (
    <div className="page-container">
      <div className="page-header">
        <div><h1>Tasks</h1><p className="page-subtitle">{tasks.filter(t => t.status !== 'completed').length} open</p></div>
        <button className="btn btn-primary" onClick={openCreate}><Plus size={16} /> Add Task</button>
      </div>

      <div className="card" style={{ marginBottom: 20, padding: '12px 16px' }}>
        <div className="filter-bar">
          <div className="search-wrap">
            <Search size={14} className="search-icon" />
            <input className="form-input" placeholder="Search tasks..." value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          <select className="form-input form-select" value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
            <option value="">All Statuses</option>
            {STATUSES.map(s => <option key={s} value={s}>{s.replace(/_/g,' ').replace(/\b\w/g,c=>c.toUpperCase())}</option>)}
          </select>
          <select className="form-input form-select" value={priorityFilter} onChange={e => setPriorityFilter(e.target.value)}>
            <option value="">All Priorities</option>
            {PRIORITIES.map(p => <option key={p} value={p}>{p.charAt(0).toUpperCase()+p.slice(1)}</option>)}
          </select>
        </div>
      </div>

      <div className="card">
        {loading ? <Spinner /> : filtered.length === 0 ? (
          <EmptyState icon={CheckSquare} title="No tasks found"
            action={<button className="btn btn-primary" onClick={openCreate}><Plus size={14} /> Add Task</button>} />
        ) : (
          filtered.map(task => {
            const overdue   = isOverdue(task);
            const sc        = STATUS_COLORS[task.status] || STATUS_COLORS.not_started;
            const notesOpen = expandedNotes === task.id;
            return (
              <div key={task.id}>
                {/* Task row */}
                <div className="task-item" style={{ background: task.status === 'completed' ? 'var(--gray-50)' : 'white' }}>
                  {/* Complete toggle */}
                  <button onClick={() => toggleComplete(task)} style={{
                    background: 'none', border: 'none', cursor: 'pointer', marginTop: 1, flexShrink: 0,
                    color: task.status === 'completed' ? 'var(--green-600)' : 'var(--gray-300)',
                  }}>
                    <CheckCircle2 size={20} />
                  </button>

                  {/* Title + meta */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, flexWrap: 'wrap' }}>
                      <span style={{
                        fontSize: 14, fontWeight: 500,
                        textDecoration: task.status === 'completed' ? 'line-through' : 'none',
                        color: task.status === 'completed' ? 'var(--gray-400)' : 'var(--gray-900)',
                      }}>
                        {task.title}
                      </span>
                      <PriorityBadge priority={task.priority} />
                    </div>
                    {task.description && (
                      <p style={{ fontSize: 12, color: 'var(--gray-500)', marginTop: 3, lineHeight: 1.4 }}>{task.description}</p>
                    )}
                    <div style={{ display: 'flex', gap: 12, marginTop: 6, flexWrap: 'wrap' }}>
                      {task.due_date && (
                        <span style={{ fontSize: 12, color: overdue ? 'var(--red-500)' : 'var(--gray-500)', fontWeight: overdue ? 600 : 400 }}>
                          📅 {overdue ? 'Overdue · ' : ''}{formatDate(task.due_date)}
                        </span>
                      )}
                      {task.assigned && (
                        <span style={{ fontSize: 12, color: 'var(--gray-500)' }}>
                          👤 {task.assigned.first_name} {task.assigned.last_name}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="task-item-actions" style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
                    <span className="hide-mobile" style={{ fontSize: 11, fontWeight: 600, padding: '3px 8px', borderRadius: 100, background: sc.bg, color: sc.color, whiteSpace: 'nowrap' }}>
                      {task.status.replace(/_/g,' ')}
                    </span>
                    {/* Notes toggle */}
                    <button
                      className="btn btn-ghost btn-sm"
                      title="View notes"
                      onClick={() => setExpandedNotes(notesOpen ? null : task.id)}
                      style={{ padding: 5, color: notesOpen ? 'var(--green-600)' : 'var(--gray-400)' }}
                    >
                      <StickyNote size={13} />
                    </button>
                    <button className="btn btn-ghost btn-sm" onClick={() => openEdit(task)} style={{ padding: 5 }}><Pencil size={13} /></button>
                    <button className="btn btn-ghost btn-sm" onClick={() => setDeleteTarget(task)} style={{ padding: 5, color: 'var(--red-500)' }}><Trash2 size={13} /></button>
                  </div>
                </div>

                {/* Inline notes panel — expands below the task row */}
                {notesOpen && (
                  <div className="task-notes-panel">
                    <NotesPanel relatedType="task" relatedId={task.id} />
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      <Modal isOpen={showModal} onClose={() => setShowModal(false)} title={editing ? 'Edit Task' : 'New Task'} size="md"
        footer={<>
          <button className="btn btn-secondary" onClick={() => setShowModal(false)}>Cancel</button>
          <button className="btn btn-primary" onClick={handleSave} disabled={saving}>{saving ? 'Saving...' : editing ? 'Update' : 'Create Task'}</button>
        </>}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <FormGroup label="Title" required>
            <input className="form-input" value={form.title} onChange={set('title')} placeholder="Task title..." autoFocus />
          </FormGroup>
          <FormGroup label="Description">
            <textarea className="form-input form-textarea" value={form.description} onChange={set('description')} rows={2} />
          </FormGroup>
          <FormRow>
            <FormGroup label="Status">
              <select className="form-input form-select" value={form.status} onChange={set('status')}>
                {STATUSES.map(s => <option key={s} value={s}>{s.replace(/_/g,' ').replace(/\b\w/g,c=>c.toUpperCase())}</option>)}
              </select>
            </FormGroup>
            <FormGroup label="Priority">
              <select className="form-input form-select" value={form.priority} onChange={set('priority')}>
                {PRIORITIES.map(p => <option key={p} value={p}>{p.charAt(0).toUpperCase()+p.slice(1)}</option>)}
              </select>
            </FormGroup>
          </FormRow>
          <FormRow>
            <FormGroup label="Due Date"><input type="date" className="form-input" value={form.due_date} onChange={set('due_date')} /></FormGroup>
            <FormGroup label="Due Time"><input type="time" className="form-input" value={form.due_time} onChange={set('due_time')} /></FormGroup>
          </FormRow>
          <FormRow>
            <FormGroup label="Assign To">
              <select className="form-input form-select" value={form.assigned_to_id} onChange={set('assigned_to_id')}>
                <option value="">Unassigned</option>
                {users.map(u => <option key={u.id} value={u.id}>{u.first_name} {u.last_name}</option>)}
              </select>
            </FormGroup>
            <FormGroup label="Related To">
              <select className="form-input form-select" value={form.related_to_type} onChange={set('related_to_type')}>
                <option value="">Select type</option>
                {RELATED_TYPES.map(t => <option key={t} value={t}>{t.charAt(0).toUpperCase()+t.slice(1)}</option>)}
              </select>
            </FormGroup>
          </FormRow>
        </div>
      </Modal>

      <ConfirmDialog isOpen={!!deleteTarget} onClose={() => setDeleteTarget(null)} onConfirm={handleDelete}
        title="Delete Task" message={`Delete "${deleteTarget?.title}"?`} confirmText="Delete Task" />
    </div>
  );
}
