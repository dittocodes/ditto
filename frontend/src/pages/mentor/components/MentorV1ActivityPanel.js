import React, { useState } from 'react';
import { API_BASE_URL } from '../../../api';

/** Patch Tracker v2 activities for an assigned student (by pipeline UID). */
export default function MentorV1ActivityPanel() {
  const [uid, setUid] = useState('');
  const [activities, setActivities] = useState([]);
  const [msg, setMsg] = useState('');

  const load = async () => {
    setMsg('');
    const token = sessionStorage.getItem('access_token');
    const res = await fetch(`${API_BASE_URL}/api/v1/mentor/students/${uid}/activities`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      setMsg(json.detail || 'Load failed');
      setActivities([]);
      return;
    }
    setActivities(json);
  };

  const patch = async (activityId, body) => {
    const token = sessionStorage.getItem('access_token');
    const res = await fetch(`${API_BASE_URL}/api/v1/mentor/students/${uid}/activities/${activityId}`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      setMsg(json.detail || 'Update failed');
      return;
    }
    load();
  };

  return (
    <div className="activity-tracking-section" style={{ marginTop: 32, paddingTop: 16, borderTop: '1px solid #e2e8f0' }}>
      <h2>Tracker activities (v1)</h2>
      <p style={{ fontSize: 14, color: '#64748b' }}>Enter a student pipeline UID (STU-…) to view and update v2 activities.</p>
      <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
        <input className="tracker-input" placeholder="Student UID" value={uid} onChange={(e) => setUid(e.target.value.trim())} />
        <button type="button" className="tracker-btn-primary" onClick={load}>Load</button>
      </div>
      {msg && <p>{msg}</p>}
      {activities.map((a) => (
        <div key={a.id} className="tracker-card" style={{ marginBottom: 8 }}>
          <strong>{a.title}</strong> — {a.status} ({a.progress_pct}%)
          <div style={{ marginTop: 8, display: 'flex', gap: 8 }}>
            <button type="button" onClick={() => patch(a.id, { progress_pct: Math.min(100, (a.progress_pct || 0) + 25), status: 'in_progress' })}>
              +25% progress
            </button>
            <button type="button" onClick={() => patch(a.id, { status: 'completed', progress_pct: 100 })}>Mark complete</button>
          </div>
        </div>
      ))}
    </div>
  );
}
