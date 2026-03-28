// src/components/modules/NotesPanel.js
//
// Reusable notes panel.  Drop onto any record detail view:
//
//   <NotesPanel relatedType="lead"    relatedId={lead.id} />
//   <NotesPanel relatedType="contact" relatedId={contact.id} />
//   <NotesPanel relatedType="account" relatedId={account.id} />
//   <NotesPanel relatedType="deal"    relatedId={deal.id} />
//
// On lead conversion the parent passes the note IDs to copy; this
// component exposes a static helper `copyNotesTo` for that purpose.
//
import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import toast from 'react-hot-toast';
import { StickyNote, Plus, Pencil, Trash2, ChevronDown, ChevronUp, X, Check } from 'lucide-react';

// ── Static helper — called by lead conversion to clone notes ─────────────
// Usage: await NotesPanel.copyNotes(orgId, userId, sourceId, targets)
// targets = [{ type: 'contact', id: '...' }, { type: 'account', id: '...' }, ...]
NotesPanel.copyNotes = async (orgId, userId, sourceType, sourceId, targets) => {
  const { data: sourceNotes } = await supabase
    .from('notes')
    .select('title, content')
    .eq('org_id', orgId)
    .eq('related_to_type', sourceType)
    .eq('related_to_id', sourceId);

  if (!sourceNotes || sourceNotes.length === 0) return;

  const rows = [];
  for (const target of targets) {
    if (!target.id) continue;
    for (const n of sourceNotes) {
      rows.push({
        org_id:          orgId,
        title:           n.title,
        content:         n.content,
        related_to_type: target.type,
        related_to_id:   target.id,
        created_by:      userId,
      });
    }
  }

  if (rows.length > 0) {
    await supabase.from('notes').insert(rows);
  }
};

// ── Component ─────────────────────────────────────────────────────────────
export default function NotesPanel({ relatedType, relatedId }) {
  const { profile } = useAuth();
  const orgId = profile?.org_id;

  const [notes, setNotes]         = useState([]);
  const [loading, setLoading]     = useState(true);
  const [expanded, setExpanded]   = useState(true);
  const [showForm, setShowForm]   = useState(false);
  const [editingNote, setEditingNote] = useState(null);
  const [title, setTitle]         = useState('');
  const [content, setContent]     = useState('');
  const [saving, setSaving]       = useState(false);

  const fetchNotes = useCallback(async () => {
    if (!orgId || !relatedId) return;
    setLoading(true);
    const { data, error } = await supabase
      .from('notes')
      .select('id, title, content, created_at, updated_at, created_by, user_profiles!notes_created_by_fkey(first_name, last_name)')
      .eq('org_id', orgId)
      .eq('related_to_type', relatedType)
      .eq('related_to_id', relatedId)
      .order('created_at', { ascending: false });
    if (!error) setNotes(data || []);
    setLoading(false);
  }, [orgId, relatedType, relatedId]);

  // eslint-disable-next-line react-hooks/exhaustive-deps

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { fetchNotes(); }, [fetchNotes]);

  const openAdd = () => {
    setEditingNote(null);
    setTitle('');
    setContent('');
    setShowForm(true);
  };

  const openEdit = (note) => {
    setEditingNote(note);
    setTitle(note.title || '');
    setContent(note.content || '');
    setShowForm(true);
  };

  const cancelForm = () => {
    setShowForm(false);
    setEditingNote(null);
    setTitle('');
    setContent('');
  };

  const handleSave = async () => {
    if (!content.trim()) { toast.error('Note content cannot be empty'); return; }
    setSaving(true);
    const payload = {
      org_id:          orgId,
      title:           title.trim() || null,
      content:         content.trim(),
      related_to_type: relatedType,
      related_to_id:   relatedId,
      created_by:      profile.id,
    };
    const { error } = editingNote
      ? await supabase.from('notes').update({ title: payload.title, content: payload.content }).eq('id', editingNote.id)
      : await supabase.from('notes').insert(payload);
    setSaving(false);
    if (error) toast.error(error.message);
    else {
      toast.success(editingNote ? 'Note updated' : 'Note added');
      cancelForm();
      fetchNotes();
    }
  };

  const handleDelete = async (note) => {
    const { error } = await supabase.from('notes').delete().eq('id', note.id);
    if (error) toast.error(error.message);
    else { toast.success('Note deleted'); fetchNotes(); }
  };

  const formatTimeAgo = (dateStr) => {
    if (!dateStr) return '';
    const diff = (Date.now() - new Date(dateStr)) / 1000;
    if (diff < 60)   return 'just now';
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`;
    return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  return (
    <div className="card" style={{ marginTop: 20 }}>
      {/* Header */}
      <div className="card-header" style={{ cursor: 'pointer' }} onClick={() => setExpanded(v => !v)}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <StickyNote size={16} color="var(--green-600)" />
          <h3 style={{ fontSize: 14, fontWeight: 700 }}>Notes</h3>
          {notes.length > 0 && (
            <span style={{ background: 'var(--green-100)', color: 'var(--green-700)', fontSize: 11, fontWeight: 700, padding: '1px 7px', borderRadius: 100 }}>
              {notes.length}
            </span>
          )}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {expanded && (
            <button
              className="btn btn-primary btn-sm"
              onClick={e => { e.stopPropagation(); openAdd(); }}
              style={{ gap: 4 }}
            >
              <Plus size={13} /> Add Note
            </button>
          )}
          {expanded
            ? <ChevronUp size={16} color="var(--gray-400)" />
            : <ChevronDown size={16} color="var(--gray-400)" />}
        </div>
      </div>

      {expanded && (
        <div>
          {/* Add / Edit form */}
          {showForm && (
            <div style={{
              margin: '0 0 0 0',
              padding: '16px 20px',
              background: 'var(--green-50)',
              borderBottom: '1px solid var(--green-100)',
            }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <input
                  className="form-input"
                  placeholder="Title (optional)"
                  value={title}
                  onChange={e => setTitle(e.target.value)}
                  autoFocus
                />
                <textarea
                  className="form-input form-textarea"
                  placeholder="Write your note here..."
                  value={content}
                  onChange={e => setContent(e.target.value)}
                  rows={4}
                  style={{ resize: 'vertical' }}
                />
                <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                  <button className="btn btn-secondary btn-sm" onClick={cancelForm} disabled={saving}>
                    <X size={13} /> Cancel
                  </button>
                  <button className="btn btn-primary btn-sm" onClick={handleSave} disabled={saving || !content.trim()}>
                    {saving
                      ? <><div className="spinner" style={{ width: 12, height: 12, borderWidth: 2, borderColor: 'rgba(255,255,255,0.3)', borderTopColor: 'white' }} /> Saving...</>
                      : <><Check size={13} /> {editingNote ? 'Update' : 'Save Note'}</>}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Notes list */}
          {loading ? (
            <div style={{ padding: '20px', display: 'flex', justifyContent: 'center' }}>
              <div className="spinner" />
            </div>
          ) : notes.length === 0 && !showForm ? (
            <div style={{ padding: '28px 20px', textAlign: 'center' }}>
              <StickyNote size={28} color="var(--gray-200)" style={{ margin: '0 auto 10px', display: 'block' }} />
              <p style={{ fontSize: 13, color: 'var(--gray-400)', marginBottom: 12 }}>
                No notes yet. Add a note to log conversations, decisions, or context.
              </p>
              <button className="btn btn-primary btn-sm" onClick={openAdd}>
                <Plus size={13} /> Add First Note
              </button>
            </div>
          ) : (
            notes.map((note, i) => (
              <div
                key={note.id}
                style={{
                  padding: '14px 20px',
                  borderBottom: i < notes.length - 1 ? '1px solid var(--color-border)' : 'none',
                  transition: 'background 0.1s',
                }}
                onMouseEnter={e => e.currentTarget.style.background = 'var(--gray-50)'}
                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
              >
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                  {/* Avatar */}
                  <div style={{
                    width: 30, height: 30, borderRadius: '50%',
                    background: 'var(--green-600)', flexShrink: 0,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 11, fontWeight: 700, color: 'white',
                  }}>
                    {note.user_profiles
                      ? `${(note.user_profiles.first_name || '?')[0]}${(note.user_profiles.last_name || '')[0] || ''}`.toUpperCase()
                      : '?'}
                  </div>

                  <div style={{ flex: 1, minWidth: 0 }}>
                    {/* Meta row */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4, flexWrap: 'wrap' }}>
                      <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--gray-700)' }}>
                        {note.user_profiles
                          ? `${note.user_profiles.first_name} ${note.user_profiles.last_name}`.trim()
                          : 'Unknown'}
                      </span>
                      <span style={{ fontSize: 11, color: 'var(--gray-400)' }}>
                        {formatTimeAgo(note.created_at)}
                        {note.updated_at !== note.created_at && ' · edited'}
                      </span>
                      {note.title && (
                        <span style={{ fontSize: 11, background: 'var(--gray-100)', color: 'var(--gray-600)', padding: '1px 7px', borderRadius: 100 }}>
                          {note.title}
                        </span>
                      )}
                    </div>

                    {/* Content */}
                    <p style={{
                      fontSize: 13, color: 'var(--gray-700)', lineHeight: 1.6,
                      whiteSpace: 'pre-wrap', wordBreak: 'break-word',
                      margin: 0,
                    }}>
                      {note.content}
                    </p>
                  </div>

                  {/* Actions — only author can edit/delete */}
                  {note.created_by === profile.id && (
                    <div style={{ display: 'flex', gap: 2, flexShrink: 0 }}>
                      <button
                        className="btn btn-ghost btn-sm"
                        onClick={() => openEdit(note)}
                        title="Edit note"
                        style={{ padding: 4, color: 'var(--gray-400)' }}
                      >
                        <Pencil size={12} />
                      </button>
                      <button
                        className="btn btn-ghost btn-sm"
                        onClick={() => handleDelete(note)}
                        title="Delete note"
                        style={{ padding: 4, color: 'var(--gray-400)' }}
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
