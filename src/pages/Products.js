import usePageTitle from '../hooks/usePageTitle';
// src/pages/Products.js
import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { Modal, ConfirmDialog, Badge, Spinner, EmptyState, FormGroup, FormRow, formatCurrency } from '../components/ui/index';
import toast from 'react-hot-toast';
import { Plus, Search, Pencil, Trash2, Package } from 'lucide-react';
import RecordDrawer from '../components/modules/RecordDrawer';

const EMPTY = { name:'', sku:'', description:'', category:'', unit_price:'', currency:'USD', tax_rate:'', unit_of_measure:'unit', status:'active', is_taxable:true };

export default function Products() {
  const { profile } = useAuth();
  const orgId = profile?.org_id;
  usePageTitle('Products');
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(EMPTY);
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [selectedProduct, setSelectedProduct] = useState(null);

  useEffect(() => {
    if (orgId) {
      fetchProducts();
    } else {
      setLoading(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orgId]);

  const fetchProducts = async () => {
    setLoading(true);
    const { data, error } = await supabase.from('products').select('*').eq('org_id', orgId).order('name');
    if (error) toast.error('Failed to load products'); else setProducts(data || []);
    setLoading(false);
  };

  const openCreate = () => { setEditing(null); setForm(EMPTY); setShowModal(true); };
  const openEdit = p => { setEditing(p); setForm({ ...EMPTY, ...p }); setShowModal(true); };
  const set = k => e => { const v = e.target.type === 'checkbox' ? e.target.checked : e.target.value; setForm(f => ({ ...f, [k]: v })); };

  const handleSave = async () => {
    if (!form.name.trim()) { toast.error('Product name is required'); return; }
    setSaving(true);
    const payload = {
      ...form,
      org_id: orgId,
      created_by: profile.id,
      unit_price: form.unit_price === '' ? 0 : Number(form.unit_price) || 0,
      tax_rate: form.tax_rate === '' ? 0 : Number(form.tax_rate) || 0,
    };
    const { error } = editing
      ? await supabase.from('products').update(payload).eq('id', editing.id)
      : await supabase.from('products').insert(payload);
    setSaving(false);
    if (error) toast.error(error.message); else { toast.success(editing ? 'Product updated' : 'Product added'); setShowModal(false); fetchProducts(); }
  };

  const handleDelete = async () => {
    const { error } = await supabase.from('products').delete().eq('id', deleteTarget.id);
    if (error) toast.error(error.message); else { toast.success('Product deleted'); fetchProducts(); }
  };

  const filtered = products.filter(p =>
    `${p.name} ${p.sku || ''} ${p.category || ''}`.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="page-container">
      <div className="page-header">
        <div><h1>Products & Catalog</h1><p className="page-subtitle">{products.length} products</p></div>
        <button className="btn btn-primary" onClick={openCreate}><Plus size={16} /> Add Product</button>
      </div>

      <div className="card" style={{ marginBottom: 20, padding: '12px 16px' }}>
        <div className="filter-bar">
          <div className="search-wrap">
            <Search size={14} className="search-icon" />
            <input className="form-input" placeholder="Search products..." value={search} onChange={e => setSearch(e.target.value)} />
          </div>
        </div>
      </div>

      <div className="card">
        {loading ? <Spinner /> : filtered.length === 0 ? (
          <EmptyState icon={Package} title="No products yet"
            action={<button className="btn btn-primary" onClick={openCreate}><Plus size={14} /> Add Product</button>} />
        ) : (
          <div className="table-container" style={{ border: 'none', borderRadius: 0 }}>
            <table>
              <thead><tr>
                <th>Name</th>
                <th className="hide-mobile">SKU</th>
                <th className="hide-mobile">Category</th>
                <th>Unit Price</th>
                <th className="hide-mobile">Tax Rate</th>
                <th>Status</th>
                <th style={{ width: 80 }}>Actions</th>
              </tr></thead>
              <tbody>
                {filtered.map(p => (
                  <tr key={p.id}>
                    <td>
                      <div style={{ fontWeight: 600, color: 'var(--green-700)', cursor: 'pointer', textDecoration: 'underline', textDecorationStyle: 'dotted', textUnderlineOffset: 3 }} onClick={() => setSelectedProduct(p)}>{p.name}</div>
                      {p.description && <div style={{ fontSize: 11, color: 'var(--gray-500)' }}>{p.description.slice(0,60)}{p.description.length > 60 ? '...' : ''}</div>}
                      <div className="show-mobile" style={{ fontSize: 11, color: 'var(--gray-400)', marginTop: 2 }}>
                        {p.sku ? `SKU: ${p.sku}` : ''}{p.category ? ` · ${p.category}` : ''}
                      </div>
                    </td>
                    <td className="hide-mobile" style={{ fontSize: 12, color: 'var(--gray-500)' }}>{p.sku || '—'}</td>
                    <td className="hide-mobile" style={{ fontSize: 13 }}>{p.category || '—'}</td>
                    <td style={{ fontWeight: 600, color: 'var(--green-700)' }}>{formatCurrency(p.unit_price, p.currency)}</td>
                    <td className="hide-mobile" style={{ fontSize: 13 }}>{p.tax_rate ? `${p.tax_rate}%` : '—'}</td>
                    <td><Badge variant={p.status === 'active' ? 'green' : 'gray'}>{p.status}</Badge></td>
                    <td>
                      <div style={{ display: 'flex', gap: 4 }}>
                        <button className="btn btn-ghost btn-sm" onClick={() => openEdit(p)} style={{ padding: 5 }}><Pencil size={13} /></button>
                        <button className="btn btn-ghost btn-sm" onClick={() => setDeleteTarget(p)} style={{ padding: 5, color: 'var(--red-500)' }}><Trash2 size={13} /></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <Modal isOpen={showModal} onClose={() => setShowModal(false)} title={editing ? 'Edit Product' : 'New Product'} size="md"
        footer={<>
          <button className="btn btn-secondary" onClick={() => setShowModal(false)}>Cancel</button>
          <button className="btn btn-primary" onClick={handleSave} disabled={saving}>{saving ? 'Saving...' : editing ? 'Update' : 'Add Product'}</button>
        </>}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <FormRow>
            <FormGroup label="Product Name" required><input className="form-input" value={form.name} onChange={set('name')} /></FormGroup>
            <FormGroup label="SKU"><input className="form-input" value={form.sku} onChange={set('sku')} placeholder="PROD-001" /></FormGroup>
          </FormRow>
          <FormRow>
            <FormGroup label="Category"><input className="form-input" value={form.category} onChange={set('category')} /></FormGroup>
            <FormGroup label="Unit of Measure"><input className="form-input" value={form.unit_of_measure} onChange={set('unit_of_measure')} /></FormGroup>
          </FormRow>
          <FormRow>
            <FormGroup label="Unit Price ($)" required><input type="number" className="form-input" value={form.unit_price} onChange={set('unit_price')} /></FormGroup>
            <FormGroup label="Tax Rate (%)"><input type="number" className="form-input" value={form.tax_rate} onChange={set('tax_rate')} /></FormGroup>
          </FormRow>
          <FormRow>
            <FormGroup label="Status">
              <select className="form-input form-select" value={form.status} onChange={set('status')}>
                <option value="active">Active</option><option value="inactive">Inactive</option><option value="discontinued">Discontinued</option>
              </select>
            </FormGroup>
            <FormGroup label="Currency">
              <select className="form-input form-select" value={form.currency} onChange={set('currency')}>
                {['USD','EUR','GBP','INR','CAD','AUD'].map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </FormGroup>
          </FormRow>
          <FormGroup label="Description"><textarea className="form-input form-textarea" value={form.description} onChange={set('description')} rows={3} /></FormGroup>
          <label style={{ display: 'flex', gap: 8, alignItems: 'center', cursor: 'pointer', fontSize: 13 }}>
            <input type="checkbox" checked={form.is_taxable} onChange={set('is_taxable')} /> Is Taxable
          </label>
        </div>
      </Modal>

      <RecordDrawer
        isOpen={!!selectedProduct}
        onClose={() => setSelectedProduct(null)}
        title={selectedProduct?.name || ''}
        subtitle={[selectedProduct?.category, selectedProduct?.sku ? `SKU: ${selectedProduct.sku}` : null].filter(Boolean).join(' · ')}
        relatedType="product"
        relatedId={selectedProduct?.id}
        onEdit={() => { openEdit(selectedProduct); setSelectedProduct(null); }}
        fields={selectedProduct ? [
          { label: 'Unit Price',  value: selectedProduct.unit_price != null ? formatCurrency(selectedProduct.unit_price, selectedProduct.currency) : null, highlight: true },
          { label: 'SKU',         value: selectedProduct.sku },
          { label: 'Category',    value: selectedProduct.category },
          { label: 'Tax Rate',    value: selectedProduct.tax_rate ? `${selectedProduct.tax_rate}%` : null },
          { label: 'Unit',        value: selectedProduct.unit_of_measure },
          { label: 'Currency',    value: selectedProduct.currency },
          { label: 'Status',      value: selectedProduct.status },
          { label: 'Taxable',     value: selectedProduct.is_taxable ? 'Yes' : 'No' },
        ].filter(f => f.value) : []}
      />

      <ConfirmDialog isOpen={!!deleteTarget} onClose={() => setDeleteTarget(null)} onConfirm={handleDelete}
        title="Delete Product" message={`Delete "${deleteTarget?.name}"?`} confirmText="Delete" />
    </div>
  );
}
