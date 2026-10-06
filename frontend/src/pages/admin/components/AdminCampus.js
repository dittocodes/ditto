import React, { useEffect, useState } from 'react';
import { API_BASE_URL } from '../../../api';

const ROLES = [
  { id: 'admin', label: 'Admin' },
  { id: 'dept_head', label: 'Department head' },
  { id: 'mentor', label: 'Mentor' },
];

export default function AdminCampus() {
  const [rows, setRows] = useState([]);
  const [content, setContent] = useState('');
  const [authorRole, setAuthorRole] = useState('admin');
  const [pinned, setPinned] = useState(false);
  const [msg, setMsg] = useState('');

  const load = async () => {
    const token = sessionStorage.getItem('access_token');
    const res = await fetch(`${API_BASE_URL}/api/v1/admin/campus/announcements`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (res.ok) setRows(await res.json());
  };

  useEffect(() => {
    load();
  }, []);

  const onSubmit = async (event) => {
    event.preventDefault();
    const token = sessionStorage.getItem('access_token');
    const res = await fetch(`${API_BASE_URL}/api/v1/admin/campus/announcements`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ content, author_role: authorRole, is_pinned: pinned }),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      setMsg(json.detail || 'Save failed');
      return;
    }
    setContent('');
    setPinned(false);
    setMsg('Announcement posted.');
    load();
  };

  return (
    <div className="admin-dashboard__main-content">
      <h1>Campus announcements</h1>
      <p>Students see these on the Campus page. The role label only changes the card style.</p>
      <form onSubmit={onSubmit} className="tracker-card" style={{ maxWidth: 720, marginBottom: 24 }}>
        <label>Shown as</label>
        <select className="tracker-input" value={authorRole} onChange={(e) => setAuthorRole(e.target.value)}>
          {ROLES.map((role) => (
            <option key={role.id} value={role.id}>{role.label}</option>
          ))}
        </select>
        <label style={{ marginTop: 12, display: 'block' }}>
          <input type="checkbox" checked={pinned} onChange={(e) => setPinned(e.target.checked)} /> Pin to the top
        </label>
        <label style={{ marginTop: 12 }}>Announcement</label>
        <textarea className="tracker-input" rows={5} value={content} onChange={(e) => setContent(e.target.value)} required />
        <button type="submit" className="tracker-btn-primary" style={{ marginTop: 12 }}>Post</button>
        {msg && <p style={{ marginTop: 8 }}>{msg}</p>}
      </form>
      {!rows.length && <p>No announcements yet.</p>}
      {rows.map((row) => (
        <article key={row.id} className="tracker-card">
          <strong>{ROLES.find((role) => role.id === row.author_role)?.label || row.author_role}</strong>
          {row.is_pinned ? ' · Pinned' : ''}
          <div style={{ color: '#64748b', fontSize: 13 }}>{row.created_at}</div>
          <p>{row.content}</p>
        </article>
      ))}
    </div>
  );
}
