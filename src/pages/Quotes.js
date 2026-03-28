import usePageTitle from '../hooks/usePageTitle';
// src/pages/Quotes.js
import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { Modal, ConfirmDialog, Badge, Spinner, EmptyState, FormGroup, FormRow, formatCurrency, formatDate } from '../components/ui/index';
import toast from 'react-hot-toast';
import { Plus, Search, Pencil, Trash2, FileText } from 'lucide-react';
import RecordDrawer from '../components/modules/RecordDrawer';

const STATUSES = ['draft','sent','accepted','rejected','expired'];
const STATUS_COLORS = { draft:'gray', sent:'blue', accepted:'green', rejected:'red', expired:'amber' };
const EMPTY = { title:'', status:'draft', deal_id:'', account_id:'', contact_id:'', quote_date: new Date().toISOString().slice(0,10), valid_until:'', discount_pct:'', shipping:'', terms:'', notes:'', owner_id:'' };

export default function Quotes() {
  const { profile } = useAuth();
  const orgId = profile?.org_id;
  usePageTitle('Quotes');
  const [quotes, setQuotes] = useState([]);
  const [deals, setDeals] = useState([]);
  const [accounts, setAccounts] = useState([]);
  const [contacts, setContacts] = useState([]);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(EMPTY);
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [selectedQuote, setSelectedQuote] = useState(null);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (orgId) {
      fetchQuotes(); fetchDeals(); fetchAccounts(); fetchContacts(); fetchUsers();
    } else {
      setLoading(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orgId]);

  const fetchQuotes   = async () => { setLoading(true); const { data, error } = await supabase.from('quotes').select(`*, accounts(name), contacts(first_name,last_name), deals(name), user_profiles!quotes_owner_id_fkey(first_name,last_name)`).eq('org_id', orgId).order('created_at', { ascending: false }); if (error) toast.error('Failed to load quotes'); else setQuotes(data || []); setLoading(false); };
  const fetchDeals    = async () => { const { data } = await supabase.from('deals').select('id,name').eq('org_id', orgId).is('deleted_at', null); setDeals(data || []); };
  const fetchAccounts = async () => { const { data } = await supabase.from('accounts').select('id,name').eq('org_id', orgId).is('deleted_at', null); setAccounts(data || []); };
  const fetchContacts = async () => { const { data } = await supabase.from('contacts').select('id,first_name,last_name').eq('org_id', orgId).is('deleted_at', null); setContacts(data || []); };
  const fetchUsers    = async () => { const { data } = await supabase.from('user_profiles').select('id,first_name,last_name').eq('org_id', orgId); setUsers(data || []); };

  const openCreate = () => { setEditing(null); setForm(EMPTY); setShowModal(true); };
  const openEdit = q => { setEditing(q); setForm({ ...EMPTY, ...q, deal_id: q.deal_id||'', account_id: q.account_id||'', contact_id: q.contact_id||'' }); setShowModal(true); };
  const set = k => e => setForm(f => ({ ...f, [k]: e.target.value }));

  const handleSave = async () => {
    if (!form.title.trim()) { toast.error('Title is required'); return; }
    setSaving(true);
    const payload = {
      ...form,
      org_id: orgId, created_by: profile.id,
      deal_id: form.deal_id || null, account_id: form.account_id || null,
      contact_id: form.contact_id || null, owner_id: form.owner_id || null,
      valid_until: form.valid_until || null,
      discount_pct: form.discount_pct === '' ? 0 : Number(form.discount_pct) || 0,
      discount_amount: form.discount_amount === '' ? 0 : Number(form.discount_amount) || 0,
      tax_amount: form.tax_amount === '' ? 0 : Number(form.tax_amount) || 0,
      shipping: form.shipping === '' ? 0 : Number(form.shipping) || 0,
      subtotal: form.subtotal === '' ? 0 : Number(form.subtotal) || 0,
      grand_total: form.grand_total === '' ? 0 : Number(form.grand_total) || 0,
    };
    const { error } = editing
      ? await supabase.from('quotes').update(payload).eq('id', editing.id)
      : await supabase.from('quotes').insert(payload);
    setSaving(false);
    if (error) toast.error(error.message); else { toast.success(editing ? 'Quote updated' : 'Quote created'); setShowModal(false); fetchQuotes(); }
  };

  const handleDelete = async () => {
    const { error } = await supabase.from('quotes').delete().eq('id', deleteTarget.id);
    if (error) toast.error(error.message); else { toast.success('Quote deleted'); fetchQuotes(); }
  };

  const filtered = quotes.filter(q =>
    `${q.quote_number||''} ${q.title} ${q.accounts?.name||''}`.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="page-container">
      <div className="page-header">
        <div><h1>Quotes</h1><p className="page-subtitle">{quotes.length} quotes</p></div>
        <button className="btn btn-primary" onClick={openCreate}><Plus size={16} /> New Quote</button>
      </div>

      <div className="card" style={{ marginBottom: 20, padding: '12px 16px' }}>
        <div className="filter-bar">
          <div className="search-wrap">
            <Search size={14} className="search-icon" />
            <input className="form-input" placeholder="Search quotes..." value={search} onChange={e => setSearch(e.target.value)} />
          </div>
        </div>
      </div>

      <div className="card">
        {loading ? <Spinner /> : filtered.length === 0 ? (
          <EmptyState icon={FileText} title="No quotes yet"
            action={<button className="btn btn-primary" onClick={openCreate}><Plus size={14} /> New Quote</button>} />
        ) : (
          <div className="table-container" style={{ border: 'none', borderRadius: 0 }}>
            <table>
              <thead><tr>
                <th className="hide-mobile">Quote #</th>
                <th>Title</th>
                <th className="hide-mobile">Account</th>
                <th className="hide-mobile">Deal</th>
                <th>Status</th>
                <th>Total</th>
                <th className="hide-mobile">Valid Until</th>
                <th style={{ width: 80 }}>Actions</th>
              </tr></thead>
              <tbody>
                {filtered.map(q => (
                  <tr key={q.id}>
                    <td className="hide-mobile" style={{ fontSize: 12, fontWeight: 600, color: 'var(--green-700)' }}>{q.quote_number || '—'}</td>
                    <td>
                      <div style={{ fontWeight: 600, color: 'var(--green-700)', cursor: 'pointer', textDecoration: 'underline', textDecorationStyle: 'dotted', textUnderlineOffset: 3 }} onClick={() => setSelectedQuote(q)}>{q.title}</div>
                      <div className="show-mobile" style={{ fontSize: 11, color: 'var(--gray-400)', marginTop: 2 }}>
                        {q.quote_number || ''}{q.accounts?.name ? ` · ${q.accounts.name}` : ''}
                      </div>
                    </td>
                    <td className="hide-mobile" style={{ fontSize: 13 }}>{q.accounts?.name || '—'}</td>
                    <td className="hide-mobile" style={{ fontSize: 13 }}>{q.deals?.name || '—'}</td>
                    <td><Badge variant={STATUS_COLORS[q.status] || 'gray'}>{q.status}</Badge></td>
                    <td style={{ fontWeight: 600, color: 'var(--green-700)' }}>{formatCurrency(q.grand_total)}</td>
                    <td className="hide-mobile" style={{ fontSize: 13 }}>{formatDate(q.valid_until)}</td>
                    <td>
                      <div style={{ display: 'flex', gap: 4 }}>
                        <button className="btn btn-ghost btn-sm" onClick={() => openEdit(q)} style={{ padding: 5 }}><Pencil size={13} /></button>
                        <button className="btn btn-ghost btn-sm" onClick={() => setDeleteTarget(q)} style={{ padding: 5, color: 'var(--red-500)' }}><Trash2 size={13} /></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <Modal isOpen={showModal} onClose={() => setShowModal(false)} title={editing ? 'Edit Quote' : 'New Quote'} size="lg"
        footer={<>
          <button className="btn btn-secondary" onClick={() => setShowModal(false)}>Cancel</button>
          <button className="btn btn-primary" onClick={handleSave} disabled={saving}>{saving ? 'Saving...' : editing ? 'Update' : 'Create Quote'}</button>
        </>}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <FormGroup label="Quote Title" required><input className="form-input" value={form.title} onChange={set('title')} placeholder="e.g. Enterprise Software License" /></FormGroup>
          <FormRow>
            <FormGroup label="Status">
              <select className="form-input form-select" value={form.status} onChange={set('status')}>
                {STATUSES.map(s => <option key={s} value={s}>{s.charAt(0).toUpperCase()+s.slice(1)}</option>)}
              </select>
            </FormGroup>
            <FormGroup label="Valid Until"><input type="date" className="form-input" value={form.valid_until} onChange={set('valid_until')} /></FormGroup>
          </FormRow>
          <FormRow>
            <FormGroup label="Account">
              <select className="form-input form-select" value={form.account_id} onChange={set('account_id')}>
                <option value="">Select account</option>
                {accounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
              </select>
            </FormGroup>
            <FormGroup label="Contact">
              <select className="form-input form-select" value={form.contact_id} onChange={set('contact_id')}>
                <option value="">Select contact</option>
                {contacts.map(c => <option key={c.id} value={c.id}>{c.first_name} {c.last_name}</option>)}
              </select>
            </FormGroup>
          </FormRow>
          <FormRow>
            <FormGroup label="Deal">
              <select className="form-input form-select" value={form.deal_id} onChange={set('deal_id')}>
                <option value="">Select deal</option>
                {deals.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
              </select>
            </FormGroup>
            <FormGroup label="Assigned To">
              <select className="form-input form-select" value={form.owner_id} onChange={set('owner_id')}>
                <option value="">Unassigned</option>
                {users.map(u => <option key={u.id} value={u.id}>{u.first_name} {u.last_name}</option>)}
              </select>
            </FormGroup>
          </FormRow>
          <FormRow>
            <FormGroup label="Discount (%)"><input type="number" min="0" max="100" className="form-input" value={form.discount_pct} onChange={set('discount_pct')} /></FormGroup>
            <FormGroup label="Shipping ($)"><input type="number" className="form-input" value={form.shipping} onChange={set('shipping')} /></FormGroup>
          </FormRow>
          <FormGroup label="Terms & Conditions"><textarea className="form-input form-textarea" value={form.terms} onChange={set('terms')} rows={3} /></FormGroup>
          <FormGroup label="Notes"><textarea className="form-input form-textarea" value={form.notes} onChange={set('notes')} rows={2} /></FormGroup>
        </div>
      </Modal>

      <RecordDrawer
        isOpen={!!selectedQuote}
        onClose={() => setSelectedQuote(null)}
        title={selectedQuote?.title || ''}
        subtitle={[selectedQuote?.quote_number, selectedQuote?.accounts?.name].filter(Boolean).join(' · ')}
        relatedType="quote"
        relatedId={selectedQuote?.id}
        onEdit={() => { openEdit(selectedQuote); setSelectedQuote(null); }}
        fields={selectedQuote ? [
          { label: 'Quote #',     value: selectedQuote.quote_number },
          { label: 'Status',      value: selectedQuote.status },
          { label: 'Grand Total', value: selectedQuote.grand_total != null ? formatCurrency(selectedQuote.grand_total) : null, highlight: true },
          { label: 'Account',     value: selectedQuote.accounts?.name },
          { label: 'Contact',     value: selectedQuote.contacts ? `${selectedQuote.contacts.first_name} ${selectedQuote.contacts.last_name}` : null },
          { label: 'Deal',        value: selectedQuote.deals?.name },
          { label: 'Valid Until', value: formatDate(selectedQuote.valid_until) },
          { label: 'Discount',    value: selectedQuote.discount_pct ? `${selectedQuote.discount_pct}%` : null },
        ].filter(f => f.value) : []}
      />

      <ConfirmDialog isOpen={!!deleteTarget} onClose={() => setDeleteTarget(null)} onConfirm={handleDelete}
        title="Delete Quote" message={`Delete "${deleteTarget?.title}"?`} confirmText="Delete" />
    </div>
  );
}
