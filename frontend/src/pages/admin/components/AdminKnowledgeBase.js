import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { API_BASE_URL } from '../../../api';

const KINDS = [
  { id: 'swot', label: 'SWOT training' },
  { id: 'campus', label: 'Campus knowledge' },
  { id: 'programme', label: 'Programme' },
  { id: 'global', label: 'General' },
];

const LABEL = Object.fromEntries(KINDS.map((kind) => [kind.id, kind.label]));

export default function AdminKnowledgeBase() {
  const { admin_id } = useParams();
  const [rows, setRows] = useState([]);
  const [scope, setScope] = useState('swot');
  const [programmeId, setProgrammeId] = useState('');
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [msg, setMsg] = useState('');

  const load = async () => {
    const token = sessionStorage.getItem('access_token');
    const res = await fetch(`${API_BASE_URL}/api/v1/admin/knowledge-base`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (res.ok) setRows(await res.json());
  };

  useEffect(() => { load(); }, [admin_id]);

  const onSubmit = async (e) => {
    e.preventDefault();
    setMsg('');
    const token = sessionStorage.getItem('access_token');
    const res = await fetch(`${API_BASE_URL}/api/v1/admin/knowledge-base`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        scope,
        programme_id: scope === 'programme' ? programmeId : null,
        title,
        content,
      }),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      setMsg(json.detail || 'Save failed');
      return;
    }
    setTitle('');
    setContent('');
    setMsg('Saved. SWOT activity suggestions will use campus and SWOT entries.');
    load();
  };

  const remove = async (id) => {
    const token = sessionStorage.getItem('access_token');
    const res = await fetch(`${API_BASE_URL}/api/v1/admin/knowledge-base/${id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    });
    if (res.ok) load();
  };

  return (
    <div className="admin-dashboard__main-content">
      <h1>Knowledge base</h1>
      <p>
        Add campus facts and SWOT training notes. Those entries are used when a student’s SWOT weaknesses become activities.
      </p>
      <form onSubmit={onSubmit} className="tracker-card" style={{ maxWidth: 720, marginBottom: 24 }}>
        <label>Kind</label>
        <select className="tracker-input" value={scope} onChange={(e) => setScope(e.target.value)}>
          {KINDS.map((kind) => (
            <option key={kind.id} value={kind.id}>{kind.label}</option>
          ))}
        </select>
        {scope === 'programme' && (
          <>
            <label style={{ marginTop: 12 }}>Programme id</label>
            <input className="tracker-input" value={programmeId} onChange={(e) => setProgrammeId(e.target.value)} placeholder="CS" />
          </>
        )}
        <label style={{ marginTop: 12 }}>Title</label>
        <input className="tracker-input" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Toastmasters on campus" />
        <label style={{ marginTop: 12 }}>What the assistant should know</label>
        <textarea
          className="tracker-input"
          rows={6}
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="Campus Toastmasters meets every Thursday and helps students who fear public speaking."
        />
        <button type="submit" className="tracker-btn-primary" style={{ marginTop: 12 }}>Add to knowledge base</button>
        {msg && <p style={{ marginTop: 8 }}>{msg}</p>}
      </form>
      <ul className="owner-kb-list">
        {rows.map((row) => (
          <li key={row.id}>
            <div>
              <strong>{LABEL[row.scope] || row.scope}</strong>
              {row.programme_id ? ` · ${row.programme_id}` : ''}
              <p>{row.content}</p>
            </div>
            <button type="button" onClick={() => remove(row.id)}>Remove</button>
          </li>
        ))}
      </ul>
    </div>
  );
}
