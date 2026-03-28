import usePageTitle from '../hooks/usePageTitle';
// src/pages/Deals.js
import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { Modal, ConfirmDialog, Spinner, EmptyState, FormGroup, FormRow, formatCurrency, formatDate } from '../components/ui/index';
import toast from 'react-hot-toast';
import { Plus, TrendingUp, LayoutGrid, List, Pencil, Trash2, Calendar, Search } from 'lucide-react';
import RecordDrawer from '../components/modules/RecordDrawer';

const SOURCES   = ['website','referral','social_media','email_campaign','cold_call','event','partner','advertisement','other'];
const DEAL_TYPES = ['new_business','existing_business','renewal'];
const EMPTY = { name:'', account_id:'', contact_id:'', stage_id:'', amount:'', probability:'', close_date:'', deal_type:'new_business', lead_source:'', description:'', next_step:'', owner_id:'' };

export default function Deals() {
  const { profile } = useAuth();
  const orgId = profile?.org_id;
  usePageTitle('Deals');
  const [deals, setDeals] = useState([]);
  const [stages, setStages] = useState([]);
  const [accounts, setAccounts] = useState([]);
  const [contacts, setContacts] = useState([]);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState('board');
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(EMPTY);
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [selectedDeal, setSelectedDeal] = useState(null);
  const [dragging, setDragging] = useState(null);
  const [dragOver, setDragOver] = useState(null);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (orgId) {
      fetchDeals(); fetchStages(); fetchAccounts(); fetchContacts(); fetchUsers();
    } else {
      setLoading(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orgId]);

  const fetchDeals = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase.from('deals').select(`
      id, name, amount, probability, close_date, stage_id, stage_name, deal_type, is_won, is_lost,
      account_id, contact_id, owner_id, created_at,
      accounts(name), contacts(first_name, last_name, email),
      user_profiles!deals_owner_id_fkey(first_name, last_name)
    `).eq('org_id', orgId).is('deleted_at', null).order('created_at', { ascending: false });
    if (error) toast.error('Failed to load deals');
    else setDeals(data || []);
    setLoading(false);
  }, [orgId]);

  const fetchStages   = async () => { const { data } = await supabase.from('pipeline_stages').select('*').eq('org_id', orgId).eq('is_active', true).order('display_order'); setStages(data || []); };
  const fetchAccounts = async () => { const { data } = await supabase.from('accounts').select('id,name').eq('org_id', orgId).is('deleted_at', null).order('name'); setAccounts(data || []); };
  const fetchContacts = async () => { const { data } = await supabase.from('contacts').select('id,first_name,last_name').eq('org_id', orgId).is('deleted_at', null).order('first_name'); setContacts(data || []); };
  const fetchUsers    = async () => { const { data } = await supabase.from('user_profiles').select('id,first_name,last_name').eq('org_id', orgId); setUsers(data || []); };

  const openCreate = (stageId = '') => { setEditing(null); setForm({ ...EMPTY, stage_id: stageId }); setShowModal(true); };
  const openEdit   = d => { setEditing(d); setForm({ ...EMPTY, ...d, account_id: d.account_id || '', contact_id: d.contact_id || '', stage_id: d.stage_id || '' }); setShowModal(true); };
  const set = k => e => setForm(f => ({ ...f, [k]: e.target.value }));

  const handleSave = async () => {
    if (!form.name.trim()) { toast.error('Deal name is required'); return; }
    if (!form.close_date)  { toast.error('Close date is required'); return; }
    setSaving(true);
    const stage = stages.find(s => s.id === form.stage_id);
    const payload = {
      ...form, org_id: orgId, created_by: profile.id,
      stage_name: stage?.name || null,
      is_won: stage?.is_won || false,
      is_lost: stage?.is_lost || false,
      account_id: form.account_id || null,
      contact_id: form.contact_id || null,
      owner_id: form.owner_id || null,
      stage_id: form.stage_id || null,
      amount: form.amount === '' ? 0 : Number(form.amount) || 0,
      probability: form.probability === '' ? (stage?.probability || 0) : Number(form.probability) || 0,
      lead_source: form.lead_source || null,
      deal_type: form.deal_type || null,
    };
    const { error } = editing
      ? await supabase.from('deals').update(payload).eq('id', editing.id)
      : await supabase.from('deals').insert(payload);
    setSaving(false);
    if (error) toast.error(error.message);
    else { toast.success(editing ? 'Deal updated' : 'Deal created'); setShowModal(false); fetchDeals(); }
  };

  const handleDelete = async () => {
    const { error } = await supabase.from('deals').update({ deleted_at: new Date().toISOString() }).eq('id', deleteTarget.id);
    if (error) toast.error(error.message); else { toast.success('Deal deleted'); fetchDeals(); }
  };

  const handleDragStart = (e, deal)  => { setDragging(deal); e.dataTransfer.effectAllowed = 'move'; };
  const handleDragOver  = (e, stageId) => { e.preventDefault(); setDragOver(stageId); };
  const handleDrop      = async (e, stage) => {
    e.preventDefault();
    if (!dragging || dragging.stage_id === stage.id) { setDragging(null); setDragOver(null); return; }
    const { error } = await supabase.from('deals').update({ stage_id: stage.id, stage_name: stage.name, is_won: stage.is_won, is_lost: stage.is_lost, probability: stage.probability }).eq('id', dragging.id);
    if (error) toast.error(error.message); else { toast.success(`Moved to ${stage.name}`); fetchDeals(); }
    setDragging(null); setDragOver(null);
  };

  const [search, setSearch]             = useState('');
  const [stageFilter, setStageFilter]   = useState('');

  const totalPipeline = deals.filter(d => !d.is_won && !d.is_lost).reduce((s, d) => s + (d.amount || 0), 0);
  const totalWon      = deals.filter(d => d.is_won).reduce((s, d) => s + (d.amount || 0), 0);

  const filteredDeals = deals.filter(d => {
    const matchSearch = !search || `${d.name} ${d.accounts?.name || ''} ${d.contacts?.first_name || ''} ${d.contacts?.last_name || ''}`.toLowerCase().includes(search.toLowerCase());
    const matchStage  = !stageFilter || d.stage_id === stageFilter;
    return matchSearch && matchStage;
  });

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <h1>Deals</h1>
          <p className="page-subtitle">
            Pipeline: {formatCurrency(totalPipeline)} &nbsp;·&nbsp; Won: {formatCurrency(totalWon)}
          </p>
        </div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
          {/* View toggle */}
          <div style={{ display: 'flex', border: '1px solid var(--color-border)', borderRadius: 8, overflow: 'hidden' }}>
            <button onClick={() => setView('board')}
              className={`btn btn-sm ${view === 'board' ? 'btn-primary' : 'btn-ghost'}`}
              style={{ borderRadius: 0, border: 'none', gap: 6 }}>
              <LayoutGrid size={14} /> <span className="hide-mobile">Board</span>
            </button>
            <button onClick={() => setView('list')}
              className={`btn btn-sm ${view === 'list' ? 'btn-primary' : 'btn-ghost'}`}
              style={{ borderRadius: 0, border: 'none', gap: 6 }}>
              <List size={14} /> <span className="hide-mobile">List</span>
            </button>
          </div>
          <button className="btn btn-primary" onClick={() => openCreate()}><Plus size={16} /> Add Deal</button>
        </div>
      </div>

      {/* Filter bar */}
      <div className="card" style={{ marginBottom: 20, padding: '12px 16px' }}>
        <div className="filter-bar">
          <div className="search-wrap">
            <Search size={14} className="search-icon" />
            <input className="form-input" placeholder="Search deals..." value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          <select className="form-input form-select" value={stageFilter} onChange={e => setStageFilter(e.target.value)}>
            <option value="">All Stages</option>
            {stages.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
          <span className="hide-mobile" style={{ marginLeft: 'auto', fontSize: 13, color: 'var(--gray-500)' }}>
            {filteredDeals.length} deals
          </span>
        </div>
      </div>

      {loading ? <Spinner /> : (
        view === 'board' ? (
          /* ── KANBAN BOARD ── */
          <div className="pipeline-board">
            {stages.map(stage => {
              const stageDeals = filteredDeals.filter(d => d.stage_id === stage.id);
              const stageTotal = stageDeals.reduce((s, d) => s + (d.amount || 0), 0);
              return (
                <div key={stage.id} className="pipeline-column"
                  onDragOver={e => handleDragOver(e, stage.id)}
                  onDrop={e => handleDrop(e, stage)}
                  style={{ borderTop: `3px solid ${stage.color || 'var(--green-600)'}`, opacity: dragOver === stage.id ? 0.85 : 1 }}>
                  <div className="pipeline-column-header">
                    <div>
                      <div className="stage-name">{stage.name}</div>
                      <div style={{ fontSize: 11, color: 'var(--gray-500)', marginTop: 2 }}>{formatCurrency(stageTotal)}</div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span className="stage-count">{stageDeals.length}</span>
                      <button className="btn btn-ghost btn-sm" onClick={() => openCreate(stage.id)} style={{ padding: 3 }}><Plus size={13} /></button>
                    </div>
                  </div>
                  <div className="pipeline-cards">
                    {stageDeals.map(deal => (
                      <div key={deal.id} className="deal-card"
                        draggable onDragStart={e => handleDragStart(e, deal)}
                        onClick={() => setSelectedDeal(deal)}>
                        <div style={{ fontWeight: 600, fontSize: 13, color: 'var(--gray-900)', marginBottom: 6 }}>{deal.name}</div>
                        {deal.accounts?.name && <div style={{ fontSize: 11, color: 'var(--gray-500)', marginBottom: 8 }}>{deal.accounts.name}</div>}
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span style={{ fontWeight: 700, color: 'var(--green-700)', fontSize: 14 }}>{formatCurrency(deal.amount)}</span>
                          {deal.close_date && (
                            <span style={{ fontSize: 11, color: 'var(--gray-400)', display: 'flex', alignItems: 'center', gap: 3 }}>
                              <Calendar size={10} />{new Date(deal.close_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                            </span>
                          )}
                        </div>
                        {deal.probability > 0 && (
                          <div style={{ marginTop: 8 }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: 'var(--gray-400)', marginBottom: 3 }}>
                              <span>Probability</span><span>{deal.probability}%</span>
                            </div>
                            <div style={{ height: 3, background: 'var(--gray-200)', borderRadius: 2 }}>
                              <div style={{ width: `${deal.probability}%`, height: '100%', background: stage.color || 'var(--green-600)', borderRadius: 2 }} />
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                    {stageDeals.length === 0 && (
                      <div style={{ textAlign: 'center', padding: '20px 0', color: 'var(--gray-400)', fontSize: 12 }}>Drop deals here</div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          /* ── LIST VIEW ── */
          <div className="card">
            {filteredDeals.length === 0 ? (
              <EmptyState icon={TrendingUp} title="No deals yet"
                action={<button className="btn btn-primary" onClick={() => openCreate()}><Plus size={14} /> Add Deal</button>} />
            ) : (
              <div className="table-container" style={{ border: 'none', borderRadius: 0 }}>
                <table>
                  <thead><tr>
                    <th>Deal Name</th>
                    <th className="hide-mobile">Account</th>
                    <th>Stage</th>
                    <th>Amount</th>
                    <th className="hide-mobile">Close Date</th>
                    <th className="hide-mobile">Probability</th>
                    <th className="hide-mobile">Owner</th>
                    <th style={{ width: 80 }}>Actions</th>
                  </tr></thead>
                  <tbody>
                    {filteredDeals.map(d => {
                      const stage = stages.find(s => s.id === d.stage_id);
                      return (
                        <tr key={d.id}>
                          <td>
                            <div style={{ fontWeight: 600, color: 'var(--green-700)', cursor: 'pointer', textDecoration: 'underline', textDecorationStyle: 'dotted', textUnderlineOffset: 3 }} onClick={() => setSelectedDeal(d)}>{d.name}</div>
                            {d.is_won && <span style={{ fontSize: 10, background: 'var(--green-100)', color: 'var(--green-700)', padding: '1px 6px', borderRadius: 100, fontWeight: 600 }}>Won</span>}
                            {d.is_lost && <span style={{ fontSize: 10, background: '#fee2e2', color: 'var(--red-500)', padding: '1px 6px', borderRadius: 100, fontWeight: 600 }}>Lost</span>}
                            {/* Mobile sub-line */}
                            <div className="show-mobile" style={{ fontSize: 12, color: 'var(--gray-500)', marginTop: 2 }}>
                              {d.accounts?.name || ''}{d.close_date ? ` · ${formatDate(d.close_date)}` : ''}
                            </div>
                          </td>
                          <td className="hide-mobile" style={{ color: 'var(--gray-600)' }}>{d.accounts?.name || '—'}</td>
                          <td>
                            <span style={{ fontSize: 11, padding: '3px 8px', borderRadius: 100, fontWeight: 600,
                              background: (stage?.color || '#16a34a') + '22', color: stage?.color || '#16a34a' }}>
                              {d.stage_name || '—'}
                            </span>
                          </td>
                          <td style={{ fontWeight: 600, color: 'var(--green-700)' }}>{formatCurrency(d.amount)}</td>
                          <td className="hide-mobile" style={{ fontSize: 13 }}>{formatDate(d.close_date)}</td>
                          <td className="hide-mobile">
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                              <div style={{ flex: 1, height: 4, background: 'var(--gray-200)', borderRadius: 2 }}>
                                <div style={{ width: `${d.probability || 0}%`, height: '100%', background: 'var(--green-500)', borderRadius: 2 }} />
                              </div>
                              <span style={{ fontSize: 12, color: 'var(--gray-600)', minWidth: 30 }}>{d.probability || 0}%</span>
                            </div>
                          </td>
                          <td className="hide-mobile" style={{ fontSize: 12 }}>{d.user_profiles ? `${d.user_profiles.first_name} ${d.user_profiles.last_name}`.trim() : '—'}</td>
                          <td>
                            <div style={{ display: 'flex', gap: 4 }}>
                              <button className="btn btn-ghost btn-sm" onClick={() => openEdit(d)} style={{ padding: 5 }}><Pencil size={13} /></button>
                              <button className="btn btn-ghost btn-sm" onClick={() => setDeleteTarget(d)} style={{ padding: 5, color: 'var(--red-500)' }}><Trash2 size={13} /></button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )
      )}

      <Modal isOpen={showModal} onClose={() => setShowModal(false)} title={editing ? 'Edit Deal' : 'New Deal'} size="lg"
        footer={<>
          <button className="btn btn-secondary" onClick={() => setShowModal(false)}>Cancel</button>
          <button className="btn btn-primary" onClick={handleSave} disabled={saving}>{saving ? 'Saving...' : editing ? 'Update Deal' : 'Create Deal'}</button>
        </>}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
          <FormGroup label="Deal Name" required>
            <input className="form-input" value={form.name} onChange={set('name')} placeholder="e.g. Acme Corp – Enterprise Plan" />
          </FormGroup>
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
            <FormGroup label="Pipeline Stage">
              <select className="form-input form-select" value={form.stage_id} onChange={e => {
                const stage = stages.find(s => s.id === e.target.value);
                setForm(f => ({ ...f, stage_id: e.target.value, probability: stage?.probability || f.probability }));
              }}>
                <option value="">Select stage</option>
                {stages.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </FormGroup>
            <FormGroup label="Deal Type">
              <select className="form-input form-select" value={form.deal_type} onChange={set('deal_type')}>
                {DEAL_TYPES.map(t => <option key={t} value={t}>{t.replace(/_/g,' ').replace(/\b\w/g,c=>c.toUpperCase())}</option>)}
              </select>
            </FormGroup>
          </FormRow>
          <FormRow cols={3}>
            <FormGroup label="Amount ($)"><input type="number" className="form-input" value={form.amount} onChange={set('amount')} placeholder="10000" /></FormGroup>
            <FormGroup label="Probability (%)"><input type="number" min="0" max="100" className="form-input" value={form.probability} onChange={set('probability')} /></FormGroup>
            <FormGroup label="Close Date" required><input type="date" className="form-input" value={form.close_date} onChange={set('close_date')} /></FormGroup>
          </FormRow>
          <FormRow>
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
          <FormGroup label="Next Step"><input className="form-input" value={form.next_step} onChange={set('next_step')} placeholder="e.g. Send proposal by Friday" /></FormGroup>
          <FormGroup label="Description"><textarea className="form-input form-textarea" value={form.description} onChange={set('description')} rows={3} /></FormGroup>
        </div>
      </Modal>

      <RecordDrawer
        isOpen={!!selectedDeal}
        onClose={() => setSelectedDeal(null)}
        title={selectedDeal?.name || ''}
        subtitle={[selectedDeal?.accounts?.name, selectedDeal?.stage_name].filter(Boolean).join(' · ')}
        relatedType="deal"
        relatedId={selectedDeal?.id}
        emailTo={selectedDeal?.contacts?.email || null}
        emailName={selectedDeal?.contacts ? `${selectedDeal.contacts.first_name} ${selectedDeal.contacts.last_name}` : (selectedDeal?.accounts?.name || null)}
        onEdit={() => { openEdit(selectedDeal); setSelectedDeal(null); }}
        fields={selectedDeal ? [
          { label: 'Amount',      value: selectedDeal.amount ? formatCurrency(selectedDeal.amount) : null, highlight: true },
          { label: 'Stage',       value: selectedDeal.stage_name },
          { label: 'Close Date',  value: formatDate(selectedDeal.close_date) },
          { label: 'Probability', value: selectedDeal.probability != null ? `${selectedDeal.probability}%` : null },
          { label: 'Account',     value: selectedDeal.accounts?.name },
          { label: 'Contact',     value: selectedDeal.contacts ? `${selectedDeal.contacts.first_name} ${selectedDeal.contacts.last_name}` : null },
          { label: 'Type',        value: selectedDeal.deal_type?.replace(/_/g,' ') },
          { label: 'Next Step',   value: selectedDeal.next_step },
        ] : []}
      />

      <ConfirmDialog isOpen={!!deleteTarget} onClose={() => setDeleteTarget(null)} onConfirm={handleDelete}
        title="Delete Deal" message={`Delete "${deleteTarget?.name}"?`} confirmText="Delete Deal" />
    </div>
  );
}
