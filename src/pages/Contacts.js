import usePageTitle from '../hooks/usePageTitle';
// src/pages/Contacts.js
import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { Modal, ConfirmDialog, Badge, Spinner, EmptyState, FormGroup, FormRow, formatDate } from '../components/ui/index';
import toast from 'react-hot-toast';
import { Plus, Search, Pencil, Trash2, UserCircle } from 'lucide-react';
import RecordDrawer from '../components/modules/RecordDrawer';

const CONTACT_TYPES = ['customer','prospect','partner','vendor','other'];
const SOURCES = ['website','referral','social_media','email_campaign','cold_call','event','partner','advertisement','other'];
const TYPE_COLORS = { customer:'green', prospect:'blue', partner:'purple', vendor:'amber', other:'gray' };

const EMPTY = {
  salutation:'', first_name:'', last_name:'', title:'', department:'',
  email:'', secondary_email:'', phone:'', mobile:'', fax:'',
  linkedin_url:'', twitter_handle:'', website:'',
  street:'', city:'', state:'', zip:'', country:'',
  type:'prospect', lead_source:'', account_id:'',
  description:'', do_not_call:false, do_not_email:false, owner_id:'',
};

export default function Contacts() {
  const { profile } = useAuth();
  const orgId = profile?.org_id;
  usePageTitle('Contacts');
  const [contacts, setContacts] = useState([]);
  const [accounts, setAccounts] = useState([]);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(EMPTY);
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [selectedContact, setSelectedContact] = useState(null);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (orgId) {
      fetchContacts(); fetchAccounts(); fetchUsers();
    } else {
      setLoading(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orgId]);

  const fetchContacts = useCallback(async () => {
    setLoading(true);
    let q = supabase.from('contacts').select(`
      id, first_name, last_name, email, phone, title, type, lead_source,
      created_at, account_id, owner_id,
      accounts(name),
      user_profiles!contacts_owner_id_fkey(first_name, last_name)
    `).eq('org_id', orgId).is('deleted_at', null).order('created_at', { ascending: false });
    if (typeFilter) q = q.eq('type', typeFilter);
    const { data, error } = await q;
    if (error) toast.error('Failed to load contacts');
    else setContacts(data || []);
    setLoading(false);
  }, [orgId, typeFilter]);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (orgId) {
      fetchContacts();
    } else {
      setLoading(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fetchContacts]);

  const fetchAccounts = async () => {
    const { data } = await supabase.from('accounts').select('id,name').eq('org_id', orgId).is('deleted_at', null).order('name');
    setAccounts(data || []);
  };
  const fetchUsers = async () => {
    const { data } = await supabase.from('user_profiles').select('id,first_name,last_name').eq('org_id', orgId);
    setUsers(data || []);
  };

  const openCreate = () => { setEditing(null); setForm(EMPTY); setShowModal(true); };
  const openEdit = c => { setEditing(c); setForm({ ...EMPTY, ...c, account_id: c.account_id || '' }); setShowModal(true); };
  const set = k => e => { const v = e.target.type === 'checkbox' ? e.target.checked : e.target.value; setForm(f => ({ ...f, [k]: v })); };

  const handleSave = async () => {
    if (!form.first_name.trim() || !form.last_name.trim()) { toast.error('Name is required'); return; }
    setSaving(true);
    const payload = {
      ...form,
      org_id: orgId,
      created_by: profile.id,
      account_id: form.account_id || null,
      owner_id: form.owner_id || null,
      lead_source: form.lead_source || null,
    };
    const { error } = editing
      ? await supabase.from('contacts').update(payload).eq('id', editing.id)
      : await supabase.from('contacts').insert(payload);
    setSaving(false);
    if (error) toast.error(error.message);
    else { toast.success(editing ? 'Contact updated' : 'Contact created'); setShowModal(false); fetchContacts(); }
  };

  const handleDelete = async () => {
    const { error } = await supabase.from('contacts').update({ deleted_at: new Date().toISOString() }).eq('id', deleteTarget.id);
    if (error) toast.error(error.message); else { toast.success('Contact deleted'); fetchContacts(); }
  };

  const filtered = contacts.filter(c =>
    `${c.first_name} ${c.last_name} ${c.email || ''} ${c.accounts?.name || ''}`.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="page-container">
      <div className="page-header">
        <div><h1>Contacts</h1><p className="page-subtitle">{contacts.length} total</p></div>
        <button className="btn btn-primary" onClick={openCreate}><Plus size={16} /> Add Contact</button>
      </div>

      <div className="card" style={{ marginBottom: 20, padding: '12px 16px' }}>
        <div className="filter-bar">
          <div className="search-wrap">
            <Search size={14} className="search-icon" />
            <input className="form-input" placeholder="Search contacts..." value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          <select className="form-input form-select" value={typeFilter} onChange={e => setTypeFilter(e.target.value)}>
            <option value="">All Types</option>
            {CONTACT_TYPES.map(t => <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>)}
          </select>
          <span className="hide-mobile" style={{ marginLeft: 'auto', fontSize: 13, color: 'var(--gray-500)' }}>{filtered.length} results</span>
        </div>
      </div>

      <div className="card">
        {loading ? <Spinner /> : filtered.length === 0 ? (
          <EmptyState icon={UserCircle} title="No contacts yet"
            action={<button className="btn btn-primary" onClick={openCreate}><Plus size={14} /> Add Contact</button>} />
        ) : (
          <div className="table-container" style={{ border: 'none', borderRadius: 0 }}>
            <table>
              <thead><tr>
                <th>Name</th>
                <th className="hide-mobile">Account</th>
                <th className="hide-mobile">Email</th>
                <th className="hide-mobile">Phone</th>
                <th>Type</th>
                <th className="hide-mobile">Owner</th>
                <th className="hide-mobile">Created</th>
                <th style={{ width: 80 }}>Actions</th>
              </tr></thead>
              <tbody>
                {filtered.map(c => (
                  <tr key={c.id}>
                    <td>
                      <div style={{ fontWeight: 600, color: 'var(--green-700)', cursor: 'pointer', textDecoration: 'underline', textDecorationStyle: 'dotted', textUnderlineOffset: 3 }} onClick={() => setSelectedContact(c)}>{c.first_name} {c.last_name}</div>
                      {c.title && <div style={{ fontSize: 11, color: 'var(--gray-500)' }}>{c.title}</div>}
                      <div className="show-mobile" style={{ fontSize: 12, color: 'var(--gray-500)', marginTop: 2 }}>
                        {c.email || c.accounts?.name || '—'}
                      </div>
                    </td>
                    <td className="hide-mobile" style={{ color: 'var(--gray-600)' }}>{c.accounts?.name || '—'}</td>
                    <td className="hide-mobile" style={{ color: 'var(--gray-600)' }}>{c.email || '—'}</td>
                    <td className="hide-mobile" style={{ color: 'var(--gray-600)' }}>{c.phone || '—'}</td>
                    <td><Badge variant={TYPE_COLORS[c.type] || 'gray'}>{c.type}</Badge></td>
                    <td className="hide-mobile" style={{ fontSize: 12 }}>
                      {c.user_profiles ? `${c.user_profiles.first_name} ${c.user_profiles.last_name}`.trim() : '—'}
                    </td>
                    <td className="hide-mobile" style={{ fontSize: 12, color: 'var(--gray-500)' }}>{formatDate(c.created_at)}</td>
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

      <Modal isOpen={showModal} onClose={() => setShowModal(false)} title={editing ? 'Edit Contact' : 'New Contact'} size="lg"
        footer={<>
          <button className="btn btn-secondary" onClick={() => setShowModal(false)}>Cancel</button>
          <button className="btn btn-primary" onClick={handleSave} disabled={saving}>{saving ? 'Saving...' : editing ? 'Update' : 'Create Contact'}</button>
        </>}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--gray-400)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 12 }}>Personal Info</div>
            <FormRow cols={3}>
              <FormGroup label="Salutation">
                <select className="form-input form-select" value={form.salutation} onChange={set('salutation')}>
                  <option value="">—</option>
                  {['Mr.','Mrs.','Ms.','Dr.','Prof.'].map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </FormGroup>
              <FormGroup label="First Name" required><input className="form-input" value={form.first_name} onChange={set('first_name')} placeholder="Jane" /></FormGroup>
              <FormGroup label="Last Name" required><input className="form-input" value={form.last_name} onChange={set('last_name')} placeholder="Smith" /></FormGroup>
            </FormRow>
            <div style={{ marginTop: 12 }}><FormRow>
              <FormGroup label="Title"><input className="form-input" value={form.title} onChange={set('title')} /></FormGroup>
              <FormGroup label="Department"><input className="form-input" value={form.department} onChange={set('department')} /></FormGroup>
            </FormRow></div>
          </div>
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--gray-400)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 12 }}>Contact Details</div>
            <FormRow>
              <FormGroup label="Email"><input type="email" className="form-input" value={form.email} onChange={set('email')} /></FormGroup>
              <FormGroup label="Phone"><input className="form-input" value={form.phone} onChange={set('phone')} /></FormGroup>
            </FormRow>
            <div style={{ marginTop: 12 }}><FormRow>
              <FormGroup label="Mobile"><input className="form-input" value={form.mobile} onChange={set('mobile')} /></FormGroup>
              <FormGroup label="LinkedIn URL"><input className="form-input" value={form.linkedin_url} onChange={set('linkedin_url')} /></FormGroup>
            </FormRow></div>
          </div>
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--gray-400)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 12 }}>Classification</div>
            <FormRow cols={3}>
              <FormGroup label="Type">
                <select className="form-input form-select" value={form.type} onChange={set('type')}>
                  {CONTACT_TYPES.map(t => <option key={t} value={t}>{t.charAt(0).toUpperCase()+t.slice(1)}</option>)}
                </select>
              </FormGroup>
              <FormGroup label="Lead Source">
                <select className="form-input form-select" value={form.lead_source} onChange={set('lead_source')}>
                  <option value="">Select source</option>
                  {SOURCES.map(s => <option key={s} value={s}>{s.replace(/_/g,' ').replace(/\b\w/g,c=>c.toUpperCase())}</option>)}
                </select>
              </FormGroup>
              <FormGroup label="Assigned To">
                <select className="form-input form-select" value={form.owner_id} onChange={set('owner_id')}>
                  <option value="">Unassigned</option>
                  {users.map(u => <option key={u.id} value={u.id}>{u.first_name} {u.last_name}</option>)}
                </select>
              </FormGroup>
            </FormRow>
            <div style={{ marginTop: 12 }}>
              <FormGroup label="Account">
                <select className="form-input form-select" value={form.account_id} onChange={set('account_id')}>
                  <option value="">No account</option>
                  {accounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                </select>
              </FormGroup>
            </div>
          </div>
          <FormGroup label="Description">
            <textarea className="form-input form-textarea" value={form.description} onChange={set('description')} rows={3} />
          </FormGroup>
          <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap' }}>
            <label style={{ display: 'flex', gap: 8, alignItems: 'center', cursor: 'pointer', fontSize: 13 }}><input type="checkbox" checked={form.do_not_call} onChange={set('do_not_call')} /> Do Not Call</label>
            <label style={{ display: 'flex', gap: 8, alignItems: 'center', cursor: 'pointer', fontSize: 13 }}><input type="checkbox" checked={form.do_not_email} onChange={set('do_not_email')} /> Do Not Email</label>
          </div>
        </div>
      </Modal>

      <RecordDrawer
        isOpen={!!selectedContact}
        onClose={() => setSelectedContact(null)}
        title={selectedContact ? `${selectedContact.first_name} ${selectedContact.last_name}` : ''}
        subtitle={[selectedContact?.title, selectedContact?.accounts?.name].filter(Boolean).join(' · ')}
        relatedType="contact"
        relatedId={selectedContact?.id}
        emailTo={selectedContact?.email || null}
        emailName={selectedContact ? `${selectedContact.first_name} ${selectedContact.last_name}` : null}
        onEdit={() => { openEdit(selectedContact); setSelectedContact(null); }}
        fields={selectedContact ? [
          { label: 'Email',   value: selectedContact.email },
          { label: 'Phone',   value: selectedContact.phone },
          { label: 'Mobile',  value: selectedContact.mobile },
          { label: 'Title',   value: selectedContact.title },
          { label: 'Account', value: selectedContact.accounts?.name },
          { label: 'Type',    value: selectedContact.type },
          { label: 'Source',  value: selectedContact.lead_source?.replace(/_/g,' ') },
        ] : []}
      />

      <ConfirmDialog isOpen={!!deleteTarget} onClose={() => setDeleteTarget(null)} onConfirm={handleDelete}
        title="Delete Contact" message={`Delete ${deleteTarget?.first_name} ${deleteTarget?.last_name}?`} confirmText="Delete Contact" />
    </div>
  );
}
