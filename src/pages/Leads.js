import usePageTitle from '../hooks/usePageTitle';
// src/pages/Leads.js
import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import {
  Modal, ConfirmDialog, LeadStatusBadge, Spinner,
  EmptyState, FormGroup, FormRow, formatDate, formatCurrency,
} from '../components/ui/index';
import NotesPanel from '../components/modules/NotesPanel';
import RecordDrawer from '../components/modules/RecordDrawer';
import toast from 'react-hot-toast';
import {
  Plus, Search, Pencil, Trash2, Users,
  ArrowRightLeft, CheckCircle, UserCircle, Building2, TrendingUp,
} from 'lucide-react';

const STATUSES   = ['new','contacted','qualified','unqualified','converted','lost'];
const SOURCES    = ['website','referral','social_media','email_campaign','cold_call','event','partner','advertisement','other'];
const INDUSTRIES = ['technology','finance','healthcare','education','retail','manufacturing','real_estate','consulting','media','legal','hospitality','nonprofit','government','other'];

const EMPTY_FORM = {
  first_name:'', last_name:'', email:'', phone:'', mobile:'', company:'',
  title:'', industry:'', website:'', street:'', city:'', state:'', zip:'', country:'',
  status:'new', source:'other', rating:'', annual_revenue:'', no_of_employees:'',
  description:'', do_not_call:false, do_not_email:false, owner_id:'',
};

// ─── Lead Conversion Modal ────────────────────────────────────────────────────
function ConvertLeadModal({ lead, isOpen, onClose, onConverted, users, stages }) {
  const { profile } = useAuth();
  const orgId = profile?.org_id;
  usePageTitle('Leads');

  const [createContact, setCreateContact] = useState(true);
  const [createAccount, setCreateAccount] = useState(false);
  const [createDeal,    setCreateDeal]    = useState(false);
  const [contact, setContact] = useState({});
  const [account, setAccount] = useState({});
  const [deal, setDeal]       = useState({ name:'', stage_id:'', amount:'', close_date:'', owner_id:'' });
  const [converting, setConverting]         = useState(false);
  const [existingAccounts, setExistingAccounts] = useState([]);
  const [useExistingAccount, setUseExistingAccount] = useState(false);
  const [existingAccountId, setExistingAccountId]   = useState('');

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!lead) return;
    setCreateContact(true);
    setCreateAccount(!!lead.company);
    setCreateDeal(false);
    setUseExistingAccount(false);
    setExistingAccountId('');

    setContact({
      first_name:  lead.first_name || '', last_name: lead.last_name || '',
      title:       lead.title || '', email: lead.email || '',
      phone:       lead.phone || '', mobile: lead.mobile || '',
      lead_source: lead.source || '', street: lead.street || '',
      city:        lead.city || '', state: lead.state || '',
      zip:         lead.zip || '', country: lead.country || '',
      owner_id:    lead.owner_id || '',
    });
    setAccount({
      name:           lead.company || '', industry: lead.industry || '',
      website:        lead.website || '', phone: lead.phone || '',
      annual_revenue: lead.annual_revenue || '', employees: lead.no_of_employees || '',
      billing_street: lead.street || '', billing_city: lead.city || '',
      billing_state:  lead.state || '', billing_zip: lead.zip || '',
      billing_country:lead.country || '', owner_id: lead.owner_id || '',
    });
    setDeal({
      name: lead.company ? `${lead.company} – Deal` : `${lead.first_name} ${lead.last_name} – Deal`,
      stage_id: stages?.[0]?.id || '', amount: '', close_date: '', owner_id: lead.owner_id || '',
    });
  }, [lead, stages]);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!orgId || !isOpen) return;
    supabase.from('accounts').select('id,name').eq('org_id', orgId).is('deleted_at', null).order('name')
      .then(({ data }) => setExistingAccounts(data || []));
  }, [orgId, isOpen]);

  const setC = k => e => setContact(f => ({ ...f, [k]: e.target.value }));
  const setA = k => e => setAccount(f => ({ ...f, [k]: e.target.value }));
  const setD = k => e => setDeal(f => ({ ...f, [k]: e.target.value }));

  const handleConvert = async () => {
    if (!createContact && !createAccount && !createDeal) { toast.error('Select at least one record to create'); return; }
    if (createDeal && !deal.close_date) { toast.error('Deal close date is required'); return; }
    setConverting(true);
    try {
      let accountId = existingAccountId || null;
      let contactId = null;
      let dealId    = null;

      // 1. Create Account
      if (createAccount && !useExistingAccount) {
        if (!account.name.trim()) throw new Error('Account name is required');
        const { data: acc, error: e } = await supabase.from('accounts')
          .insert({ ...account, org_id: orgId, created_by: profile.id,
            annual_revenue: account.annual_revenue || null,
            employees: account.employees || null,
            owner_id: account.owner_id || null,
            industry: account.industry || null })
          .select('id').single();
        if (e) throw e;
        accountId = acc.id;
      } else if (useExistingAccount) {
        accountId = existingAccountId || null;
      }

      // 2. Create Contact
      if (createContact) {
        if (!contact.first_name.trim() || !contact.last_name.trim()) throw new Error('Contact first and last name are required');
        const { data: con, error: e } = await supabase.from('contacts')
          .insert({ ...contact, org_id: orgId, created_by: profile.id,
            account_id: accountId || null, owner_id: contact.owner_id || null,
            lead_source: contact.lead_source || null })
          .select('id').single();
        if (e) throw e;
        contactId = con.id;
      }

      // 3. Create Deal
      if (createDeal) {
        if (!deal.name.trim()) throw new Error('Deal name is required');
        const stage = stages.find(s => s.id === deal.stage_id);
        const { data: dl, error: e } = await supabase.from('deals')
          .insert({
            name: deal.name, stage_id: deal.stage_id || null, stage_name: stage?.name || null,
            amount: deal.amount || 0, close_date: deal.close_date,
            probability: stage?.probability || 0,
            is_won: stage?.is_won || false, is_lost: stage?.is_lost || false,
            lead_source: lead.source || null,
            account_id: accountId || null, contact_id: contactId || null,
            owner_id: deal.owner_id || null, org_id: orgId, created_by: profile.id,
          })
          .select('id').single();
        if (e) throw e;
        dealId = dl.id;
      }

      // 4. Copy notes from lead → all created records
      const copyTargets = [
        createContact && contactId ? { type: 'contact', id: contactId } : null,
        (createAccount || useExistingAccount) && accountId ? { type: 'account', id: accountId } : null,
        createDeal && dealId ? { type: 'deal', id: dealId } : null,
      ].filter(Boolean);

      if (copyTargets.length > 0) {
        await NotesPanel.copyNotes(orgId, profile.id, 'lead', lead.id, copyTargets);
      }

      // 5. Mark lead as converted
      const { error: leadErr } = await supabase.from('leads').update({
        is_converted: true, converted_at: new Date().toISOString(), status: 'converted',
        converted_contact_id: contactId,
        converted_account_id: accountId,
        converted_deal_id: dealId,
      }).eq('id', lead.id);
      if (leadErr) throw leadErr;

      const created = [
        createContact && 'Contact',
        (createAccount && !useExistingAccount) && 'Account',
        createDeal && 'Deal',
      ].filter(Boolean);
      const notesCopied = copyTargets.length > 0 ? ' · Notes copied across.' : '';
      toast.success(`Lead converted! Created: ${created.join(', ')}${notesCopied}`);
      onConverted();
      onClose();
    } catch (err) {
      toast.error(err.message || 'Conversion failed');
    } finally {
      setConverting(false);
    }
  };

  if (!lead) return null;

  const Toggle = ({ checked, onChange }) => (
    <div onClick={onChange} style={{
      width: 36, height: 20, borderRadius: 10, flexShrink: 0,
      background: checked ? 'var(--green-600)' : 'var(--gray-300)',
      position: 'relative', cursor: 'pointer', transition: 'background 0.2s',
    }}>
      <div style={{
        width: 16, height: 16, borderRadius: '50%', background: 'white',
        position: 'absolute', top: 2, transition: 'left 0.2s',
        left: checked ? 18 : 2, boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
      }} />
    </div>
  );

  const SectionHead = ({ icon: Icon, title, color, iconColor, checked, onToggle }) => (
    <div style={{
      padding: '14px 18px',
      background: checked ? `${color}40` : 'var(--gray-50)',
      borderBottom: checked ? `1px solid ${color}` : 'none',
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <div style={{ width: 30, height: 30, borderRadius: 8, background: color, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Icon size={15} color={iconColor} />
        </div>
        <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--gray-700)' }}>{title}</span>
      </div>
      <Toggle checked={checked} onChange={onToggle} />
    </div>
  );

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Convert Lead" size="lg"
      footer={<>
        <button className="btn btn-secondary" onClick={onClose} disabled={converting}>Cancel</button>
        <button className="btn btn-primary" onClick={handleConvert} disabled={converting} style={{ gap: 7 }}>
          {converting
            ? <><div className="spinner" style={{ width: 15, height: 15, borderWidth: 2, borderColor: 'rgba(255,255,255,0.3)', borderTopColor: 'white' }} /> Converting...</>
            : <><ArrowRightLeft size={15} /> Convert Lead</>}
        </button>
      </>}>

      {/* Lead summary */}
      <div style={{ background: 'var(--gray-50)', border: '1px solid var(--color-border)', borderRadius: 10, padding: '12px 16px', marginBottom: 24, display: 'flex', alignItems: 'center', gap: 12 }}>
        <div style={{ width: 38, height: 38, borderRadius: '50%', background: 'var(--green-100)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontWeight: 700, fontSize: 14, color: 'var(--green-700)' }}>
          {(lead.first_name?.[0]||'?').toUpperCase()}{(lead.last_name?.[0]||'').toUpperCase()}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--gray-900)' }}>{lead.first_name} {lead.last_name}</div>
          <div style={{ fontSize: 12, color: 'var(--gray-500)' }}>{[lead.title, lead.company].filter(Boolean).join(' · ') || lead.email || '—'}</div>
        </div>
        <div style={{ fontSize: 12, color: 'var(--gray-500)', textAlign: 'right', flexShrink: 0 }}>
          Will be marked as<br /><strong style={{ color: 'var(--green-700)' }}>Converted</strong>
        </div>
      </div>

      {/* Notes copy notice */}
      <div style={{ background: 'var(--green-50)', border: '1px solid var(--green-200)', borderRadius: 8, padding: '10px 14px', marginBottom: 20, fontSize: 13, color: 'var(--green-800)', display: 'flex', alignItems: 'center', gap: 8 }}>
        <CheckCircle size={14} color="var(--green-600)" style={{ flexShrink: 0 }} />
        All notes on this lead will be automatically copied to the Contact, Account, and Deal you create.
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

        {/* Contact */}
        <div style={{ border: '1px solid var(--color-border)', borderRadius: 12, overflow: 'hidden' }}>
          <SectionHead icon={UserCircle} title="Create Contact" color="var(--green-100)" iconColor="var(--green-700)" checked={createContact} onToggle={() => setCreateContact(v => !v)} />
          {createContact && (
            <div style={{ padding: 18, display: 'flex', flexDirection: 'column', gap: 14 }}>
              <FormRow>
                <FormGroup label="First Name" required><input className="form-input" value={contact.first_name} onChange={setC('first_name')} /></FormGroup>
                <FormGroup label="Last Name" required><input className="form-input" value={contact.last_name} onChange={setC('last_name')} /></FormGroup>
              </FormRow>
              <FormRow>
                <FormGroup label="Title"><input className="form-input" value={contact.title} onChange={setC('title')} /></FormGroup>
                <FormGroup label="Email"><input type="email" className="form-input" value={contact.email} onChange={setC('email')} /></FormGroup>
              </FormRow>
              <FormRow>
                <FormGroup label="Phone"><input className="form-input" value={contact.phone} onChange={setC('phone')} /></FormGroup>
                <FormGroup label="Assign To">
                  <select className="form-input form-select" value={contact.owner_id} onChange={setC('owner_id')}>
                    <option value="">Unassigned</option>
                    {users.map(u => <option key={u.id} value={u.id}>{u.first_name} {u.last_name}</option>)}
                  </select>
                </FormGroup>
              </FormRow>
            </div>
          )}
        </div>

        {/* Account */}
        <div style={{ border: '1px solid var(--color-border)', borderRadius: 12, overflow: 'hidden' }}>
          <SectionHead icon={Building2} title="Create Account" color="#dbeafe" iconColor="#1d4ed8" checked={createAccount} onToggle={() => { setCreateAccount(v => !v); setUseExistingAccount(false); }} />
          {createAccount && (
            <div style={{ padding: 18, display: 'flex', flexDirection: 'column', gap: 14 }}>
              {existingAccounts.length > 0 && (
                <div style={{ background: 'var(--gray-50)', border: '1px solid var(--color-border)', borderRadius: 8, padding: '10px 14px' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 13, color: 'var(--gray-700)' }}>
                    <input type="checkbox" checked={useExistingAccount} onChange={e => setUseExistingAccount(e.target.checked)} />
                    Link to an existing account instead
                  </label>
                  {useExistingAccount && (
                    <div style={{ marginTop: 10 }}>
                      <select className="form-input form-select" value={existingAccountId} onChange={e => setExistingAccountId(e.target.value)}>
                        <option value="">Select existing account</option>
                        {existingAccounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                      </select>
                    </div>
                  )}
                </div>
              )}
              {!useExistingAccount && (<>
                <FormRow>
                  <FormGroup label="Account Name" required><input className="form-input" value={account.name} onChange={setA('name')} /></FormGroup>
                  <FormGroup label="Website"><input className="form-input" value={account.website} onChange={setA('website')} /></FormGroup>
                </FormRow>
                <FormRow>
                  <FormGroup label="Industry">
                    <select className="form-input form-select" value={account.industry} onChange={setA('industry')}>
                      <option value="">Select industry</option>
                      {INDUSTRIES.map(i => <option key={i} value={i}>{i.replace(/_/g,' ').replace(/\b\w/g,c=>c.toUpperCase())}</option>)}
                    </select>
                  </FormGroup>
                  <FormGroup label="Annual Revenue ($)"><input type="number" className="form-input" value={account.annual_revenue} onChange={setA('annual_revenue')} /></FormGroup>
                </FormRow>
                <FormRow>
                  <FormGroup label="Phone"><input className="form-input" value={account.phone} onChange={setA('phone')} /></FormGroup>
                  <FormGroup label="Assign To">
                    <select className="form-input form-select" value={account.owner_id} onChange={setA('owner_id')}>
                      <option value="">Unassigned</option>
                      {users.map(u => <option key={u.id} value={u.id}>{u.first_name} {u.last_name}</option>)}
                    </select>
                  </FormGroup>
                </FormRow>
              </>)}
            </div>
          )}
        </div>

        {/* Deal */}
        <div style={{ border: '1px solid var(--color-border)', borderRadius: 12, overflow: 'hidden' }}>
          <SectionHead icon={TrendingUp} title="Create Deal" color="#ede9fe" iconColor="#6d28d9" checked={createDeal} onToggle={() => setCreateDeal(v => !v)} />
          {createDeal && (
            <div style={{ padding: 18, display: 'flex', flexDirection: 'column', gap: 14 }}>
              <FormGroup label="Deal Name" required><input className="form-input" value={deal.name} onChange={setD('name')} /></FormGroup>
              <FormRow>
                <FormGroup label="Pipeline Stage">
                  <select className="form-input form-select" value={deal.stage_id}
                    onChange={e => { const s = stages.find(st => st.id === e.target.value); setDeal(f => ({ ...f, stage_id: e.target.value, probability: s?.probability || 0 })); }}>
                    <option value="">Select stage</option>
                    {stages.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                </FormGroup>
                <FormGroup label="Amount ($)"><input type="number" className="form-input" value={deal.amount} onChange={setD('amount')} placeholder="0" /></FormGroup>
              </FormRow>
              <FormRow>
                <FormGroup label="Close Date" required><input type="date" className="form-input" value={deal.close_date} onChange={setD('close_date')} /></FormGroup>
                <FormGroup label="Assign To">
                  <select className="form-input form-select" value={deal.owner_id} onChange={setD('owner_id')}>
                    <option value="">Unassigned</option>
                    {users.map(u => <option key={u.id} value={u.id}>{u.first_name} {u.last_name}</option>)}
                  </select>
                </FormGroup>
              </FormRow>
            </div>
          )}
        </div>
      </div>
    </Modal>
  );
}

// ─── Main Leads Page ──────────────────────────────────────────────────────────
export default function Leads() {
  const { profile } = useAuth();
  const orgId = profile?.org_id;
  const [leads, setLeads]               = useState([]);
  const [loading, setLoading]           = useState(true);
  const [search, setSearch]             = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [showModal, setShowModal]       = useState(false);
  const [editing, setEditing]           = useState(null);
  const [form, setForm]                 = useState(EMPTY_FORM);
  const [saving, setSaving]             = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [users, setUsers]               = useState([]);
  const [stages, setStages]             = useState([]);
  const [convertTarget, setConvertTarget] = useState(null);
  const [selectedLead, setSelectedLead] = useState(null); // drawer

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (orgId) {
      fetchLeads(); fetchUsers(); fetchStages();
    } else {
      setLoading(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orgId]);

  const fetchLeads = useCallback(async () => {
    setLoading(true);
    let q = supabase.from('leads').select(`
      id, first_name, last_name, email, phone, mobile, company, title,
      industry, website, street, city, state, zip, country,
      status, source, rating, annual_revenue, no_of_employees,
      description, do_not_call, do_not_email,
      created_at, owner_id, is_converted,
      user_profiles!leads_owner_id_fkey(first_name, last_name)
    `).eq('org_id', orgId).is('deleted_at', null).order('created_at', { ascending: false });
    if (statusFilter) q = q.eq('status', statusFilter);
    const { data, error } = await q;
    if (error) toast.error('Failed to load leads');
    else setLeads(data || []);
    setLoading(false);
  }, [orgId, statusFilter]);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (orgId) {
      fetchLeads();
    } else {
      setLoading(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fetchLeads]);

  const fetchUsers  = async () => { const { data } = await supabase.from('user_profiles').select('id,first_name,last_name').eq('org_id', orgId); setUsers(data || []); };
  const fetchStages = async () => { const { data } = await supabase.from('pipeline_stages').select('*').eq('org_id', orgId).eq('is_active', true).order('display_order'); setStages(data || []); };

  const openCreate = () => { setEditing(null); setForm(EMPTY_FORM); setShowModal(true); };
  const openEdit   = lead => { setEditing(lead); setForm({ ...EMPTY_FORM, ...lead }); setShowModal(true); setSelectedLead(null); };
  const set = k => e => { const v = e.target.type === 'checkbox' ? e.target.checked : e.target.value; setForm(f => ({ ...f, [k]: v })); };

  const handleSave = async () => {
    if (!form.first_name.trim() || !form.last_name.trim()) { toast.error('First and last name are required'); return; }
    setSaving(true);
    const payload = {
      ...form,
      org_id: orgId,
      created_by: profile.id,
      owner_id: form.owner_id || null,
      annual_revenue: form.annual_revenue === '' ? null : form.annual_revenue,
      no_of_employees: form.no_of_employees === '' ? null : form.no_of_employees,
      industry: form.industry || null,
      rating: form.rating || null,
    };
    const { error } = editing
      ? await supabase.from('leads').update(payload).eq('id', editing.id)
      : await supabase.from('leads').insert(payload);
    setSaving(false);
    if (error) toast.error(error.message);
    else { toast.success(editing ? 'Lead updated' : 'Lead created'); setShowModal(false); fetchLeads(); }
  };

  const handleDelete = async () => {
    const { error } = await supabase.from('leads').update({ deleted_at: new Date().toISOString() }).eq('id', deleteTarget.id);
    if (error) toast.error(error.message);
    else { toast.success('Lead deleted'); setSelectedLead(null); fetchLeads(); }
  };

  const filtered = leads.filter(l =>
    `${l.first_name} ${l.last_name} ${l.email || ''} ${l.company || ''}`.toLowerCase().includes(search.toLowerCase())
  );

  // Refresh selected lead data after notes change
  const refreshSelected = () => {
    if (selectedLead) {
      supabase.from('leads').select('*').eq('id', selectedLead.id).single()
        .then(({ data }) => { if (data) setSelectedLead(data); });
    }
    fetchLeads();
  };

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <h1>Leads</h1>
          <p className="page-subtitle">{leads.length} total · {leads.filter(l => l.is_converted).length} converted</p>
        </div>
        <button className="btn btn-primary" onClick={openCreate}><Plus size={16} /> Add Lead</button>
      </div>

      {/* Filter bar */}
      <div className="card" style={{ marginBottom: 20, padding: '12px 16px' }}>
        <div className="filter-bar">
          <div className="search-wrap">
            <Search size={14} className="search-icon" />
            <input className="form-input" placeholder="Search leads..." value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          <select className="form-input form-select" value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
            <option value="">All Statuses</option>
            {STATUSES.map(s => <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>)}
          </select>
          <span className="hide-mobile" style={{ marginLeft: 'auto', fontSize: 13, color: 'var(--gray-500)' }}>{filtered.length} results</span>
        </div>
      </div>

      {/* Table */}
      <div className="card">
        {loading ? <Spinner /> : filtered.length === 0 ? (
          <EmptyState icon={Users} title="No leads found" description="Add your first lead to get started"
            action={<button className="btn btn-primary" onClick={openCreate}><Plus size={14} /> Add Lead</button>} />
        ) : (
          <div className="table-container" style={{ border: 'none', borderRadius: 0 }}>
            <table>
              <thead>
                <tr>
                  <th>Name</th>
                  <th className="hide-mobile">Company</th>
                  <th className="hide-mobile">Email</th>
                  <th className="hide-mobile">Phone</th>
                  <th>Status</th>
                  <th className="hide-mobile">Source</th>
                  <th className="hide-mobile">Owner</th>
                  <th className="hide-mobile">Created</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(lead => (
                  <tr key={lead.id} style={{ opacity: lead.is_converted ? 0.75 : 1 }}>
                    <td>
                      <div
                        style={{ fontWeight: 600, color: 'var(--green-700)', cursor: 'pointer', textDecoration: 'underline', textDecorationStyle: 'dotted', textUnderlineOffset: 3 }}
                        onClick={() => setSelectedLead(lead)}
                        title="Click to view notes and details"
                      >
                        {lead.first_name} {lead.last_name}
                      </div>
                      <div className="show-mobile" style={{ fontSize: 12, color: 'var(--gray-500)', marginTop: 2 }}>
                        {lead.email || lead.company || '—'}
                      </div>
                      {lead.is_converted && (
                        <span style={{ fontSize: 10, background: 'var(--green-100)', color: 'var(--green-700)', padding: '1px 6px', borderRadius: 100, fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: 3, marginTop: 3 }}>
                          <CheckCircle size={9} /> Converted
                        </span>
                      )}
                    </td>
                    <td className="hide-mobile" style={{ color: 'var(--gray-600)' }}>{lead.company || '—'}</td>
                    <td className="hide-mobile" style={{ color: 'var(--gray-600)' }}>{lead.email || '—'}</td>
                    <td className="hide-mobile" style={{ color: 'var(--gray-600)' }}>{lead.phone || '—'}</td>
                    <td><LeadStatusBadge status={lead.status} /></td>
                    <td className="hide-mobile" style={{ color: 'var(--gray-500)', fontSize: 12, textTransform: 'capitalize' }}>{lead.source?.replace(/_/g,' ') || '—'}</td>
                    <td className="hide-mobile" style={{ fontSize: 12, color: 'var(--gray-600)' }}>
                      {lead.user_profiles ? `${lead.user_profiles.first_name} ${lead.user_profiles.last_name}`.trim() : '—'}
                    </td>
                    <td className="hide-mobile" style={{ fontSize: 12, color: 'var(--gray-500)' }}>{formatDate(lead.created_at)}</td>
                    <td>
                      <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                        {!lead.is_converted && (
                          <button className="btn btn-sm" title="Convert lead" onClick={() => setConvertTarget(lead)}
                            style={{ padding: '4px 7px', gap: 4, background: 'var(--green-50)', color: 'var(--green-700)', border: '1px solid var(--green-200)', borderRadius: 6, fontSize: 11, fontWeight: 600 }}>
                            <ArrowRightLeft size={11} />
                            <span className="hide-mobile">Convert</span>
                          </button>
                        )}
                        <button className="btn btn-ghost btn-sm" onClick={() => openEdit(lead)} style={{ padding: 5 }} title="Edit"><Pencil size={13} /></button>
                        <button className="btn btn-ghost btn-sm" onClick={() => setDeleteTarget(lead)} style={{ padding: 5, color: 'var(--red-500)' }} title="Delete"><Trash2 size={13} /></button>
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
        isOpen={!!selectedLead}
        onClose={() => setSelectedLead(null)}
        title={selectedLead ? `${selectedLead.first_name} ${selectedLead.last_name}` : ''}
        subtitle={[selectedLead?.title, selectedLead?.company].filter(Boolean).join(' · ')}
        badgeEl={selectedLead ? <LeadStatusBadge status={selectedLead.status} /> : null}
        relatedType="lead"
        relatedId={selectedLead?.id}
        emailTo={selectedLead?.email || null}
        emailName={selectedLead ? `${selectedLead.first_name} ${selectedLead.last_name}` : null}
        onEdit={() => openEdit(selectedLead)}
        onConvert={selectedLead && !selectedLead.is_converted ? () => { setConvertTarget(selectedLead); setSelectedLead(null); } : null}
        fields={selectedLead ? [
          { label: 'Email',    value: selectedLead.email },
          { label: 'Phone',    value: selectedLead.phone },
          { label: 'Mobile',   value: selectedLead.mobile },
          { label: 'Company',  value: selectedLead.company },
          { label: 'Title',    value: selectedLead.title },
          { label: 'Industry', value: selectedLead.industry?.replace(/_/g,' ') },
          { label: 'Source',   value: selectedLead.source?.replace(/_/g,' ') },
          { label: 'Rating',   value: selectedLead.rating },
          { label: 'Revenue',  value: selectedLead.annual_revenue ? formatCurrency(selectedLead.annual_revenue) : null, highlight: true },
          { label: 'Website',  value: selectedLead.website },
          { label: 'City',     value: selectedLead.city },
          { label: 'Country',  value: selectedLead.country },
        ] : []}
      />

      {/* Create / Edit modal */}
      <Modal isOpen={showModal} onClose={() => setShowModal(false)} title={editing ? 'Edit Lead' : 'New Lead'} size="lg"
        footer={<>
          <button className="btn btn-secondary" onClick={() => setShowModal(false)}>Cancel</button>
          <button className="btn btn-primary" onClick={handleSave} disabled={saving}>{saving ? 'Saving...' : editing ? 'Update Lead' : 'Create Lead'}</button>
        </>}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--gray-400)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 14 }}>Personal Info</div>
            <FormRow>
              <FormGroup label="First Name" required><input className="form-input" value={form.first_name} onChange={set('first_name')} placeholder="Jane" /></FormGroup>
              <FormGroup label="Last Name" required><input className="form-input" value={form.last_name} onChange={set('last_name')} placeholder="Smith" /></FormGroup>
            </FormRow>
            <div style={{ marginTop: 12 }}><FormRow>
              <FormGroup label="Email"><input type="email" className="form-input" value={form.email} onChange={set('email')} /></FormGroup>
              <FormGroup label="Phone"><input className="form-input" value={form.phone} onChange={set('phone')} /></FormGroup>
            </FormRow></div>
            <div style={{ marginTop: 12 }}><FormRow>
              <FormGroup label="Title"><input className="form-input" value={form.title} onChange={set('title')} /></FormGroup>
              <FormGroup label="Mobile"><input className="form-input" value={form.mobile} onChange={set('mobile')} /></FormGroup>
            </FormRow></div>
          </div>
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--gray-400)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 14 }}>Company Info</div>
            <FormRow>
              <FormGroup label="Company Name"><input className="form-input" value={form.company} onChange={set('company')} /></FormGroup>
              <FormGroup label="Website"><input className="form-input" value={form.website} onChange={set('website')} /></FormGroup>
            </FormRow>
            <div style={{ marginTop: 12 }}><FormRow>
              <FormGroup label="Industry">
                <select className="form-input form-select" value={form.industry} onChange={set('industry')}>
                  <option value="">Select industry</option>
                  {INDUSTRIES.map(i => <option key={i} value={i}>{i.replace(/_/g,' ').replace(/\b\w/g,c=>c.toUpperCase())}</option>)}
                </select>
              </FormGroup>
              <FormGroup label="Annual Revenue ($)"><input type="number" className="form-input" value={form.annual_revenue} onChange={set('annual_revenue')} /></FormGroup>
            </FormRow></div>
          </div>
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--gray-400)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 14 }}>Lead Qualification</div>
            <FormRow cols={3}>
              <FormGroup label="Status">
                <select className="form-input form-select" value={form.status} onChange={set('status')}>
                  {STATUSES.map(s => <option key={s} value={s}>{s.replace(/_/g,' ').replace(/\b\w/g,c=>c.toUpperCase())}</option>)}
                </select>
              </FormGroup>
              <FormGroup label="Source">
                <select className="form-input form-select" value={form.source} onChange={set('source')}>
                  {SOURCES.map(s => <option key={s} value={s}>{s.replace(/_/g,' ').replace(/\b\w/g,c=>c.toUpperCase())}</option>)}
                </select>
              </FormGroup>
              <FormGroup label="Rating">
                <select className="form-input form-select" value={form.rating} onChange={set('rating')}>
                  <option value="">Select rating</option>
                  {['hot','warm','cold'].map(r => <option key={r} value={r}>{r.charAt(0).toUpperCase()+r.slice(1)}</option>)}
                </select>
              </FormGroup>
            </FormRow>
            <div style={{ marginTop: 12 }}><FormGroup label="Assign To">
              <select className="form-input form-select" value={form.owner_id || ''} onChange={set('owner_id')}>
                <option value="">Unassigned</option>
                {users.map(u => <option key={u.id} value={u.id}>{u.first_name} {u.last_name}</option>)}
              </select>
            </FormGroup></div>
          </div>
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--gray-400)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 14 }}>Address</div>
            <FormGroup label="Street"><input className="form-input" value={form.street} onChange={set('street')} /></FormGroup>
            <div style={{ marginTop: 12 }}><FormRow cols={3}>
              <FormGroup label="City"><input className="form-input" value={form.city} onChange={set('city')} /></FormGroup>
              <FormGroup label="State"><input className="form-input" value={form.state} onChange={set('state')} /></FormGroup>
              <FormGroup label="ZIP"><input className="form-input" value={form.zip} onChange={set('zip')} /></FormGroup>
            </FormRow></div>
            <div style={{ marginTop: 12 }}><FormGroup label="Country"><input className="form-input" value={form.country} onChange={set('country')} /></FormGroup></div>
          </div>
          <FormGroup label="Description / Notes">
            <textarea className="form-input form-textarea" value={form.description} onChange={set('description')} rows={3} />
          </FormGroup>
          <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap' }}>
            <label style={{ display: 'flex', gap: 8, alignItems: 'center', cursor: 'pointer', fontSize: 13 }}><input type="checkbox" checked={form.do_not_call} onChange={set('do_not_call')} /> Do Not Call</label>
            <label style={{ display: 'flex', gap: 8, alignItems: 'center', cursor: 'pointer', fontSize: 13 }}><input type="checkbox" checked={form.do_not_email} onChange={set('do_not_email')} /> Do Not Email</label>
          </div>
        </div>
      </Modal>

      <ConvertLeadModal lead={convertTarget} isOpen={!!convertTarget} onClose={() => setConvertTarget(null)} onConverted={refreshSelected} users={users} stages={stages} />
      <ConfirmDialog isOpen={!!deleteTarget} onClose={() => setDeleteTarget(null)} onConfirm={handleDelete} title="Delete Lead" message={`Delete ${deleteTarget?.first_name} ${deleteTarget?.last_name}? This cannot be undone.`} confirmText="Delete Lead" />
    </div>
  );
}
