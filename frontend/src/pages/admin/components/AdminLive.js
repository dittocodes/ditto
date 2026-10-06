import React, { useEffect, useState } from 'react';
import { API_BASE_URL } from '../../../api';

const SCOPE_LABEL = {
  swot: 'SWOT training',
  campus: 'Campus knowledge',
  programme: 'Programme',
  global: 'General',
};

function Score({ value }) {
  if (value == null) return '—';
  return Number(value).toFixed(1);
}

export default function AdminLive() {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let stop = false;
    const load = async () => {
      try {
        const token = sessionStorage.getItem('access_token');
        const res = await fetch(`${API_BASE_URL}/api/v1/admin/live`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const json = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(json.detail || 'Could not load the live view');
        if (!stop) {
          setData(json);
          setError('');
        }
      } catch (err) {
        if (!stop) setError(err.message || 'Could not load the live view');
      }
    };
    load();
    const timer = setInterval(load, 4000);
    return () => {
      stop = true;
      clearInterval(timer);
    };
  }, []);

  const counts = data?.counts || {};

  return (
    <div className="admin-dashboard__main-content">
      <h1>Live tracker</h1>
      <p>Students, documents, and reading jobs refresh every few seconds.</p>
      {error && <p>{error}</p>}
      <div className="owner-live-counts">
        <div><strong>{counts.students ?? '—'}</strong><span>Students</span></div>
        <div><strong>{counts.documents ?? '—'}</strong><span>Documents</span></div>
        <div><strong>{counts.jobs_active ?? '—'}</strong><span>Reading now</span></div>
        <div><strong>{counts.swot ?? '—'}</strong><span>SWOT entries</span></div>
        <div><strong>{counts.campus ?? '—'}</strong><span>Campus entries</span></div>
      </div>
      <h2>Students</h2>
      <table className="owner-live-table">
        <thead>
          <tr>
            <th>Name</th>
            <th>Programme</th>
            <th>Documents</th>
            <th>Score</th>
            <th>Onboarding</th>
          </tr>
        </thead>
        <tbody>
          {(data?.students || []).map((row) => (
            <tr key={row.usn}>
              <td>{row.name}<br /><small>{row.usn}</small></td>
              <td>{row.program || '—'}</td>
              <td>{row.documents}</td>
              <td><Score value={row.score} /></td>
              <td>{row.onboarding ? 'Done' : 'In progress'}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <h2>Document reading</h2>
      <table className="owner-live-table">
        <thead>
          <tr>
            <th>Student</th>
            <th>Status</th>
            <th>Stage</th>
            <th>Target</th>
          </tr>
        </thead>
        <tbody>
          {(data?.jobs || []).map((row) => (
            <tr key={row.id}>
              <td>{row.student}</td>
              <td>{row.status}</td>
              <td>{row.stage}</td>
              <td>{row.target || '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="owner-live-note">Knowledge labels: {Object.values(SCOPE_LABEL).join(', ')}.</p>
    </div>
  );
}
