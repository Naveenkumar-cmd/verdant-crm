import usePageTitle from '../hooks/usePageTitle';
// src/pages/Accounts.js
import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { Modal, ConfirmDialog, Badge, Spinner, EmptyState, FormGroup, FormRow, formatCurrency } from '../components/ui/index';
import toast from 'react-hot-toast';
import { Plus, Search, Pencil, Trash2, Building2 } from 'lucide-react';
import RecordDrawer from '../components/modules/RecordDrawer';

const ACC_TYPES = ['prospect','customer','partner','competitor','vendor','other'];
const INDUSTRIES = ['technology','finance','healthcare','education','retail','manufacturing','real_estate','consulting','media','legal','hospitality','nonprofit','government','other'];
const TYPE_COLORS = { prospect:'blue', customer:'green', partner:'purple', competitor:'red', vendor:'amber', other:'gray' };
const EMPTY = { name:'', type:'prospect', industry:'', website:'', phone:'', email:'', billing_street:'', billing_city:'', billing_state:'', billing_zip:'', billing_country:'', annual_revenue:'', employees:'', description:'', rating:'', owner_id:'' };

export default function Accounts() {
  const { profile } = useAuth();
  const orgId = profile?.org_id;
  usePageTitle('Accounts');
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
  const [selectedAccount, setSelectedAccount] = useState(null);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (orgId) {
      fetchAccounts(); fetchUsers();
    } else {
      setLoading(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orgId]);

  const fetchAccounts = useCallback(async () => {
    setLoading(true);
    let q = supabase.from('accounts').select(`
      id, name, type, industry, website, phone, email, annual_revenue, employees, rating, created_at, owner_id,
      user_profiles!accounts_owner_id_fkey(first_name, last_name)
    `).eq('org_id', orgId).is('deleted_at', null).order('name');
    if (typeFilter) q = q.eq('type', typeFilter);
    const { data, error } = await q;
    if (error) toast.error('Failed to load accounts');
    else setAccounts(data || []);
    setLoading(false);
  }, [orgId, typeFilter]);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (orgId) {
      fetchAccounts();
    } else {
      setLoading(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fetchAccounts]);

  const fetchUsers = async () => {
    const { data } = await supabase.from('user_profiles').select('id,first_name,last_name').eq('org_id', orgId);
    setUsers(data || []);
  };

  const openCreate = () => { setEditing(null); setForm(EMPTY); setShowModal(true); };
  const openEdit = a => { setEditing(a); setForm({ ...EMPTY, ...a }); setShowModal(true); };
  const set = k => e => setForm(f => ({ ...f, [k]: e.target.value }));

  const handleSave = async () => {
    if (!form.name.trim()) { toast.error('Account name is required'); return; }
    setSaving(true);
    const payload = {
      ...form,
      org_id: orgId,
      created_by: profile.id,
      owner_id: form.owner_id || null,
      annual_revenue: form.annual_revenue === '' ? null : Number(form.annual_revenue) || null,
      employees: form.employees === '' ? null : Number(form.employees) || null,
      industry: form.industry || null,
    };
    const { error } = editing
      ? await supabase.from('accounts').update(payload).eq('id', editing.id)
      : await supabase.from('accounts').insert(payload);
    setSaving(false);
    if (error) toast.error(error.message);
    else { toast.success(editing ? 'Account updated' : 'Account created'); setShowModal(false); fetchAccounts(); }
  };

  const handleDelete = async () => {
    const { error } = await supabase.from('accounts').update({ deleted_at: new Date().toISOString() }).eq('id', deleteTarget.id);
    if (error) toast.error(error.message); else { toast.success('Account deleted'); fetchAccounts(); }
  };

  const filtered = accounts.filter(a =>
    `${a.name} ${a.website || ''} ${a.email || ''}`.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="page-container">
      <div className="page-header">
        <div><h1>Accounts</h1><p className="page-subtitle">{accounts.length} total</p></div>
        <button className="btn btn-primary" onClick={openCreate}><Plus size={16} /> Add Account</button>
      </div>

      <div className="card" style={{ marginBottom: 20, padding: '12px 16px' }}>
        <div className="filter-bar">
          <div className="search-wrap">
            <Search size={14} className="search-icon" />
            <input className="form-input" placeholder="Search accounts..." value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          <select className="form-input form-select" value={typeFilter} onChange={e => setTypeFilter(e.target.value)}>
            <option value="">All Types</option>
            {ACC_TYPES.map(t => <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>)}
          </select>
          <span className="hide-mobile" style={{ marginLeft: 'auto', fontSize: 13, color: 'var(--gray-500)' }}>{filtered.length} results</span>
        </div>
      </div>

      <div className="card">
        {loading ? <Spinner /> : filtered.length === 0 ? (
          <EmptyState icon={Building2} title="No accounts yet"
            action={<button className="btn btn-primary" onClick={openCreate}><Plus size={14} /> Add Account</button>} />
        ) : (
          <div className="table-container" style={{ border: 'none', borderRadius: 0 }}>
            <table>
              <thead><tr>
                <th>Account Name</th>
                <th>Type</th>
                <th className="hide-mobile">Industry</th>
                <th className="hide-mobile">Phone</th>
                <th className="hide-mobile">Revenue</th>
                <th className="hide-mobile">Employees</th>
                <th className="hide-mobile">Owner</th>
                <th style={{ width: 80 }}>Actions</th>
              </tr></thead>
              <tbody>
                {filtered.map(a => (
                  <tr key={a.id}>
                    <td>
                      <div style={{ fontWeight: 600, color: 'var(--green-700)', cursor: 'pointer', textDecoration: 'underline', textDecorationStyle: 'dotted', textUnderlineOffset: 3 }} onClick={() => setSelectedAccount(a)}>{a.name}</div>
                      {a.website && <a href={a.website} target="_blank" rel="noreferrer" style={{ fontSize: 11, color: 'var(--green-600)' }}>{a.website}</a>}
                      <div className="show-mobile" style={{ fontSize: 12, color: 'var(--gray-500)', marginTop: 2 }}>
                        {a.industry?.replace(/_/g,' ') || ''}{a.annual_revenue ? ` · ${formatCurrency(a.annual_revenue)}` : ''}
                      </div>
                    </td>
                    <td><Badge variant={TYPE_COLORS[a.type] || 'gray'}>{a.type}</Badge></td>
                    <td className="hide-mobile" style={{ fontSize: 12, color: 'var(--gray-600)', textTransform: 'capitalize' }}>{a.industry?.replace(/_/g,' ') || '—'}</td>
                    <td className="hide-mobile" style={{ fontSize: 13, color: 'var(--gray-600)' }}>{a.phone || '—'}</td>
                    <td className="hide-mobile" style={{ fontWeight: 500 }}>{formatCurrency(a.annual_revenue)}</td>
                    <td className="hide-mobile" style={{ fontSize: 13, color: 'var(--gray-600)' }}>{a.employees?.toLocaleString() || '—'}</td>
                    <td className="hide-mobile" style={{ fontSize: 12 }}>{a.user_profiles ? `${a.user_profiles.first_name} ${a.user_profiles.last_name}`.trim() : '—'}</td>
                    <td>
                      <div style={{ display: 'flex', gap: 4 }}>
                        <button className="btn btn-ghost btn-sm" onClick={() => openEdit(a)} style={{ padding: 5 }}><Pencil size={13} /></button>
                        <button className="btn btn-ghost btn-sm" onClick={() => setDeleteTarget(a)} style={{ padding: 5, color: 'var(--red-500)' }}><Trash2 size={13} /></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <Modal isOpen={showModal} onClose={() => setShowModal(false)} title={editing ? 'Edit Account' : 'New Account'} size="lg"
        footer={<>
          <button className="btn btn-secondary" onClick={() => setShowModal(false)}>Cancel</button>
          <button className="btn btn-primary" onClick={handleSave} disabled={saving}>{saving ? 'Saving...' : editing ? 'Update' : 'Create Account'}</button>
        </>}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
          <FormGroup label="Account Name" required>
            <input className="form-input" value={form.name} onChange={set('name')} placeholder="Acme Corporation" />
          </FormGroup>
          <FormRow cols={3}>
            <FormGroup label="Type">
              <select className="form-input form-select" value={form.type} onChange={set('type')}>
                {ACC_TYPES.map(t => <option key={t} value={t}>{t.charAt(0).toUpperCase()+t.slice(1)}</option>)}
              </select>
            </FormGroup>
            <FormGroup label="Industry">
              <select className="form-input form-select" value={form.industry} onChange={set('industry')}>
                <option value="">Select...</option>
                {INDUSTRIES.map(i => <option key={i} value={i}>{i.replace(/_/g,' ').replace(/\b\w/g,c=>c.toUpperCase())}</option>)}
              </select>
            </FormGroup>
            <FormGroup label="Rating">
              <select className="form-input form-select" value={form.rating} onChange={set('rating')}>
                <option value="">Select rating</option>
                {['hot','warm','cold'].map(r => <option key={r} value={r}>{r.charAt(0).toUpperCase()+r.slice(1)}</option>)}
              </select>
            </FormGroup>
          </FormRow>
          <FormRow>
            <FormGroup label="Website"><input className="form-input" value={form.website} onChange={set('website')} placeholder="https://acme.com" /></FormGroup>
            <FormGroup label="Phone"><input className="form-input" value={form.phone} onChange={set('phone')} /></FormGroup>
          </FormRow>
          <FormRow>
            <FormGroup label="Email"><input type="email" className="form-input" value={form.email} onChange={set('email')} /></FormGroup>
            <FormGroup label="Assigned To">
              <select className="form-input form-select" value={form.owner_id} onChange={set('owner_id')}>
                <option value="">Unassigned</option>
                {users.map(u => <option key={u.id} value={u.id}>{u.first_name} {u.last_name}</option>)}
              </select>
            </FormGroup>
          </FormRow>
          <FormRow>
            <FormGroup label="Annual Revenue ($)"><input type="number" className="form-input" value={form.annual_revenue} onChange={set('annual_revenue')} /></FormGroup>
            <FormGroup label="No. of Employees"><input type="number" className="form-input" value={form.employees} onChange={set('employees')} /></FormGroup>
          </FormRow>
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--gray-400)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 12 }}>Billing Address</div>
            <FormGroup label="Street"><input className="form-input" value={form.billing_street} onChange={set('billing_street')} /></FormGroup>
            <div style={{ marginTop: 10 }}><FormRow cols={3}>
              <FormGroup label="City"><input className="form-input" value={form.billing_city} onChange={set('billing_city')} /></FormGroup>
              <FormGroup label="State"><input className="form-input" value={form.billing_state} onChange={set('billing_state')} /></FormGroup>
              <FormGroup label="ZIP"><input className="form-input" value={form.billing_zip} onChange={set('billing_zip')} /></FormGroup>
            </FormRow></div>
            <div style={{ marginTop: 10 }}><FormGroup label="Country"><input className="form-input" value={form.billing_country} onChange={set('billing_country')} /></FormGroup></div>
          </div>
          <FormGroup label="Description"><textarea className="form-input form-textarea" value={form.description} onChange={set('description')} rows={3} /></FormGroup>
        </div>
      </Modal>

      <RecordDrawer
        isOpen={!!selectedAccount}
        onClose={() => setSelectedAccount(null)}
        title={selectedAccount?.name || ''}
        subtitle={[selectedAccount?.industry?.replace(/_/g,' '), selectedAccount?.type].filter(Boolean).join(' · ')}
        relatedType="account"
        relatedId={selectedAccount?.id}
        emailTo={selectedAccount?.email || null}
        emailName={selectedAccount?.name || null}
        onEdit={() => { openEdit(selectedAccount); setSelectedAccount(null); }}
        fields={selectedAccount ? [
          { label: 'Website',  value: selectedAccount.website },
          { label: 'Phone',    value: selectedAccount.phone },
          { label: 'Email',    value: selectedAccount.email },
          { label: 'Industry', value: selectedAccount.industry?.replace(/_/g,' ') },
          { label: 'Revenue',  value: selectedAccount.annual_revenue ? formatCurrency(selectedAccount.annual_revenue) : null, highlight: true },
          { label: 'Employees',value: selectedAccount.employees?.toLocaleString() },
          { label: 'Rating',   value: selectedAccount.rating },
          { label: 'Type',     value: selectedAccount.type },
        ] : []}
      />

      <ConfirmDialog isOpen={!!deleteTarget} onClose={() => setDeleteTarget(null)} onConfirm={handleDelete}
        title="Delete Account" message={`Delete "${deleteTarget?.name}"?`} confirmText="Delete Account" />
    </div>
  );
}
