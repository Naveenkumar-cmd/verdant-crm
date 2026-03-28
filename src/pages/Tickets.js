import usePageTitle from '../hooks/usePageTitle';
// src/pages/Tickets.js
import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { Modal, ConfirmDialog, TicketStatusBadge, PriorityBadge, Spinner, EmptyState, FormGroup, FormRow, formatDate } from '../components/ui/index';
import RecordDrawer from '../components/modules/RecordDrawer';
import toast from 'react-hot-toast';
import { Plus, Search, Pencil, Trash2, Headphones } from 'lucide-react';

const STATUSES   = ['open','in_progress','pending_customer','resolved','closed'];
const PRIORITIES = ['low','medium','high','critical'];
const EMPTY = {
  subject:'', description:'', status:'open', priority:'medium',
  category:'', contact_id:'', account_id:'', owner_id:'',
  assigned_to_id:'', due_date:'',
};

export default function Tickets() {
  const { profile } = useAuth();
  const orgId = profile?.org_id;
  usePageTitle('Support Tickets');
  const [tickets, setTickets]           = useState([]);
  const [contacts, setContacts]         = useState([]);
  const [accounts, setAccounts]         = useState([]);
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
  const [selectedTicket, setSelectedTicket] = useState(null);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (orgId) {
      fetchTickets(); fetchContacts(); fetchAccounts(); fetchUsers();
    } else {
      setLoading(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orgId]);

  const fetchTickets = useCallback(async () => {
    setLoading(true);
    let q = supabase.from('tickets').select(`
      id, ticket_number, subject, description, status, priority,
      category, due_date, created_at, contact_id, account_id,
      contacts(first_name, last_name, email),
      accounts(name),
      user_profiles!tickets_assigned_to_id_fkey(first_name, last_name)
    `).eq('org_id', orgId).order('created_at', { ascending: false });
    if (statusFilter)   q = q.eq('status', statusFilter);
    if (priorityFilter) q = q.eq('priority', priorityFilter);
    const { data, error } = await q;
    if (error) toast.error('Failed to load tickets');
    else setTickets(data || []);
    setLoading(false);
  }, [orgId, statusFilter, priorityFilter]);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (orgId) {
      fetchTickets();
    } else {
      setLoading(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fetchTickets]);

  const fetchContacts = async () => { const { data } = await supabase.from('contacts').select('id,first_name,last_name').eq('org_id', orgId).is('deleted_at', null); setContacts(data || []); };
  const fetchAccounts = async () => { const { data } = await supabase.from('accounts').select('id,name').eq('org_id', orgId).is('deleted_at', null); setAccounts(data || []); };
  const fetchUsers    = async () => { const { data } = await supabase.from('user_profiles').select('id,first_name,last_name').eq('org_id', orgId); setUsers(data || []); };

  const openCreate = () => { setEditing(null); setForm(EMPTY); setShowModal(true); };
  const openEdit   = t  => { setEditing(t); setForm({ ...EMPTY, ...t, contact_id: t.contact_id||'', account_id: t.account_id||'' }); setShowModal(true); };
  const set = k => e => setForm(f => ({ ...f, [k]: e.target.value }));

  const handleSave = async () => {
    if (!form.subject.trim()) { toast.error('Subject is required'); return; }
    setSaving(true);
    const payload = {
      ...form, org_id: orgId, created_by: profile.id,
      contact_id:    form.contact_id    || null,
      account_id:    form.account_id    || null,
      owner_id:      form.owner_id      || null,
      assigned_to_id:form.assigned_to_id|| null,
      due_date:      form.due_date      || null,
    };
    const { error } = editing
      ? await supabase.from('tickets').update(payload).eq('id', editing.id)
      : await supabase.from('tickets').insert(payload);
    setSaving(false);
    if (error) toast.error(error.message);
    else { toast.success(editing ? 'Ticket updated' : 'Ticket created'); setShowModal(false); fetchTickets(); }
  };

  const handleDelete = async () => {
    const { error } = await supabase.from('tickets').delete().eq('id', deleteTarget.id);
    if (error) toast.error(error.message);
    else { toast.success('Ticket deleted'); setSelectedTicket(null); fetchTickets(); }
  };

  const filtered = tickets.filter(t =>
    `${t.ticket_number||''} ${t.subject} ${t.category||''}`.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="page-container">
      <div className="page-header">
        <div><h1>Support Tickets</h1><p className="page-subtitle">{tickets.filter(t => t.status === 'open').length} open</p></div>
        <button className="btn btn-primary" onClick={openCreate}><Plus size={16} /> New Ticket</button>
      </div>

      <div className="card" style={{ marginBottom: 20, padding: '12px 16px' }}>
        <div className="filter-bar">
          <div className="search-wrap">
            <Search size={14} className="search-icon" />
            <input className="form-input" placeholder="Search tickets..." value={search} onChange={e => setSearch(e.target.value)} />
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
          <EmptyState icon={Headphones} title="No tickets found"
            action={<button className="btn btn-primary" onClick={openCreate}><Plus size={14} /> New Ticket</button>} />
        ) : (
          <div className="table-container" style={{ border: 'none', borderRadius: 0 }}>
            <table>
              <thead><tr>
                <th className="hide-mobile">Ticket #</th>
                <th>Subject</th>
                <th className="hide-mobile">Contact</th>
                <th className="hide-mobile">Account</th>
                <th>Status</th>
                <th>Priority</th>
                <th className="hide-mobile">Assigned To</th>
                <th className="hide-mobile">Due</th>
                <th style={{ width: 80 }}>Actions</th>
              </tr></thead>
              <tbody>
                {filtered.map(t => (
                  <tr key={t.id}>
                    <td className="hide-mobile" style={{ fontSize: 12, fontWeight: 600, color: 'var(--green-700)' }}>{t.ticket_number || '—'}</td>
                    <td>
                      <div
                        style={{ fontWeight: 600, fontSize: 13, color: 'var(--green-700)', cursor: 'pointer', textDecoration: 'underline', textDecorationStyle: 'dotted', textUnderlineOffset: 3 }}
                        onClick={() => setSelectedTicket(t)}
                      >
                        {t.subject}
                      </div>
                      {t.category && <div style={{ fontSize: 11, color: 'var(--gray-500)' }}>{t.category}</div>}
                      <div className="show-mobile" style={{ fontSize: 11, color: 'var(--gray-400)', marginTop: 2 }}>
                        {t.ticket_number || ''}{t.contacts ? ` · ${t.contacts.first_name} ${t.contacts.last_name}` : ''}
                      </div>
                    </td>
                    <td className="hide-mobile" style={{ fontSize: 12 }}>{t.contacts ? `${t.contacts.first_name} ${t.contacts.last_name}` : '—'}</td>
                    <td className="hide-mobile" style={{ fontSize: 12 }}>{t.accounts?.name || '—'}</td>
                    <td><TicketStatusBadge status={t.status} /></td>
                    <td><PriorityBadge priority={t.priority} /></td>
                    <td className="hide-mobile" style={{ fontSize: 12 }}>{t.user_profiles ? `${t.user_profiles.first_name} ${t.user_profiles.last_name}` : '—'}</td>
                    <td className="hide-mobile" style={{ fontSize: 12 }}>{formatDate(t.due_date)}</td>
                    <td>
                      <div style={{ display: 'flex', gap: 4 }}>
                        <button className="btn btn-ghost btn-sm" onClick={() => openEdit(t)} style={{ padding: 5 }}><Pencil size={13} /></button>
                        <button className="btn btn-ghost btn-sm" onClick={() => setDeleteTarget(t)} style={{ padding: 5, color: 'var(--red-500)' }}><Trash2 size={13} /></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Detail drawer with notes */}
      <RecordDrawer
        isOpen={!!selectedTicket}
        onClose={() => setSelectedTicket(null)}
        title={selectedTicket ? `${selectedTicket.ticket_number || ''} · ${selectedTicket.subject}` : ''}
        subtitle={[selectedTicket?.category, selectedTicket?.accounts?.name].filter(Boolean).join(' · ')}
        badgeEl={selectedTicket ? <TicketStatusBadge status={selectedTicket.status} /> : null}
        relatedType="ticket"
        relatedId={selectedTicket?.id}
        emailTo={selectedTicket?.contacts?.email || null}
        emailName={selectedTicket?.contacts ? `${selectedTicket.contacts.first_name} ${selectedTicket.contacts.last_name}` : null}
        onEdit={() => { openEdit(selectedTicket); setSelectedTicket(null); }}
        fields={selectedTicket ? [
          { label: 'Priority',    value: selectedTicket.priority },
          { label: 'Category',    value: selectedTicket.category },
          { label: 'Contact',     value: selectedTicket.contacts ? `${selectedTicket.contacts.first_name} ${selectedTicket.contacts.last_name}` : null },
          { label: 'Account',     value: selectedTicket.accounts?.name },
          { label: 'Assigned To', value: selectedTicket.user_profiles ? `${selectedTicket.user_profiles.first_name} ${selectedTicket.user_profiles.last_name}` : null },
          { label: 'Due Date',    value: formatDate(selectedTicket.due_date) },
          { label: 'Created',     value: formatDate(selectedTicket.created_at) },
        ].filter(f => f.value) : []}
      />

      <Modal isOpen={showModal} onClose={() => setShowModal(false)} title={editing ? 'Edit Ticket' : 'New Support Ticket'} size="md"
        footer={<>
          <button className="btn btn-secondary" onClick={() => setShowModal(false)}>Cancel</button>
          <button className="btn btn-primary" onClick={handleSave} disabled={saving}>{saving ? 'Saving...' : editing ? 'Update' : 'Create Ticket'}</button>
        </>}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <FormGroup label="Subject" required>
            <input className="form-input" value={form.subject} onChange={set('subject')} placeholder="Describe the issue..." />
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
            <FormGroup label="Category"><input className="form-input" value={form.category} onChange={set('category')} placeholder="e.g. Billing, Technical" /></FormGroup>
            <FormGroup label="Due Date"><input type="date" className="form-input" value={form.due_date} onChange={set('due_date')} /></FormGroup>
          </FormRow>
          <FormRow>
            <FormGroup label="Contact">
              <select className="form-input form-select" value={form.contact_id} onChange={set('contact_id')}>
                <option value="">Select contact</option>
                {contacts.map(c => <option key={c.id} value={c.id}>{c.first_name} {c.last_name}</option>)}
              </select>
            </FormGroup>
            <FormGroup label="Account">
              <select className="form-input form-select" value={form.account_id} onChange={set('account_id')}>
                <option value="">Select account</option>
                {accounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
              </select>
            </FormGroup>
          </FormRow>
          <FormGroup label="Assigned To">
            <select className="form-input form-select" value={form.assigned_to_id} onChange={set('assigned_to_id')}>
              <option value="">Unassigned</option>
              {users.map(u => <option key={u.id} value={u.id}>{u.first_name} {u.last_name}</option>)}
            </select>
          </FormGroup>
          <FormGroup label="Description">
            <textarea className="form-input form-textarea" value={form.description} onChange={set('description')} rows={4} placeholder="Detailed description..." />
          </FormGroup>
        </div>
      </Modal>

      <ConfirmDialog isOpen={!!deleteTarget} onClose={() => setDeleteTarget(null)} onConfirm={handleDelete}
        title="Delete Ticket" message={`Delete ticket "${deleteTarget?.ticket_number}"?`} confirmText="Delete" />
    </div>
  );
}
