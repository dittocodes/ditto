import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { API_BASE_URL } from '../../../api';

export default function AdminDemoPipeline() {
  const { admin_id } = useParams();
  const [queue, setQueue] = useState([]);
  const [uid, setUid] = useState('');
  const [jobs, setJobs] = useState([]);
  const [selectedJob, setSelectedJob] = useState('');
  const [detail, setDetail] = useState(null);
  const [reports, setReports] = useState([]);
  const [msg, setMsg] = useState('');

  const token = () => sessionStorage.getItem('access_token');
  const headers = () => ({ Authorization: `Bearer ${token()}` });

  const loadQueue = async () => {
    const res = await fetch(`${API_BASE_URL}/api/v1/admin/review-queue`, { headers: headers() });
    if (res.ok) setQueue(await res.json());
  };

  useEffect(() => {
    loadQueue().catch(() => {});
  }, [admin_id]);

  const resolve = async (id, action) => {
    await fetch(`${API_BASE_URL}/api/v1/admin/review-queue/${id}/resolve`, {
      method: 'POST',
      headers: { ...headers(), 'Content-Type': 'application/json' },
      body: JSON.stringify({ action }),
    });
    loadQueue();
  };

  const runWorker = async () => {
    setMsg('');
    const res = await fetch(`${API_BASE_URL}/api/v1/admin/demo/run-worker`, {
      method: 'POST',
      headers: { ...headers(), 'Content-Type': 'application/json' },
      body: JSON.stringify({ count: 8 }),
    });
    const json = await res.json().catch(() => ({}));
    setMsg(res.ok ? `Processed ${json.jobs_processed} job(s)` : json.detail || 'Failed');
  };

  const loadReports = async () => {
    if (!uid.trim()) return;
    const res = await fetch(`${API_BASE_URL}/api/v1/admin/demo/students/${uid.trim()}/living-reports`, {
      headers: headers(),
    });
    if (res.ok) setReports(await res.json());
  };

  const loadJob = async (jobId) => {
    if (!jobId) return;
    const res = await fetch(`${API_BASE_URL}/api/v1/admin/demo/pipeline/${jobId}`, { headers: headers() });
    if (res.ok) setDetail(await res.json());
  };

  return (
    <div className="admin-dashboard__main-content">
      <h1>Demo pipeline inspector</h1>
      <p>Privacy story: raw OCR vs masked processing input, job stages, living report versions.</p>
      <button type="button" className="tracker-btn-primary" onClick={runWorker} style={{ marginBottom: 16 }}>
        Run worker burst (DEMO_MODE)
      </button>
      {msg ? <p>{msg}</p> : null}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: 24 }}>
        <section className="tracker-card">
          <h2>Review queue</h2>
          {queue.length === 0 ? <p>No pending items.</p> : null}
          {queue.map((item) => (
            <div key={item.id} style={{ marginBottom: 12, paddingBottom: 12, borderBottom: '1px solid #e2e8f0' }}>
              <strong>{item.field_path}</strong>
              <p style={{ fontSize: 13 }}>uid: {item.uid}</p>
              <button type="button" onClick={() => resolve(item.id, 'accept_new')}>Accept new</button>
              {' '}
              <button type="button" onClick={() => resolve(item.id, 'keep_old')}>Keep old</button>
            </div>
          ))}
        </section>

        <section className="tracker-card">
          <h2>Job inspector</h2>
          <label>Student UID</label>
          <input className="tracker-input" value={uid} onChange={(e) => setUid(e.target.value)} />
          <button type="button" className="tracker-btn-primary" style={{ marginTop: 8 }} onClick={loadReports}>
            Load living reports
          </button>
          <label style={{ display: 'block', marginTop: 12 }}>Job ID</label>
          <input
            className="tracker-input"
            value={selectedJob}
            onChange={(e) => setSelectedJob(e.target.value)}
            placeholder="Paste job UUID from upload response"
          />
          <button type="button" className="tracker-btn-primary" style={{ marginTop: 8 }} onClick={() => loadJob(selectedJob)}>
            Load pipeline detail
          </button>

          {detail ? (
            <div style={{ marginTop: 16, display: 'grid', gap: 12 }}>
              <div>
                <h3>Raw OCR (preview)</h3>
                <pre style={{ whiteSpace: 'pre-wrap', fontSize: 12, background: '#f8fafc', padding: 8 }}>
                  {detail.ocr_preview || '—'}
                </pre>
              </div>
              <div>
                <h3>Masked (sent to analysis)</h3>
                <pre style={{ whiteSpace: 'pre-wrap', fontSize: 12, background: '#fef9c3', padding: 8 }}>
                  {detail.masked_preview || '—'}
                </pre>
              </div>
              <div>
                <h3>Analysis summary</h3>
                <pre style={{ fontSize: 12 }}>
                  {JSON.stringify(detail.analysis_summary, null, 2)}
                </pre>
              </div>
              <div>
                <h3>PII token types</h3>
                <p>{(detail.pii_token_types || []).join(', ') || '—'}</p>
              </div>
            </div>
          ) : null}

          {reports.length ? (
            <div style={{ marginTop: 16 }}>
              <h3>Living reports</h3>
              <ul>
                {reports.map((r) => (
                  <li key={r.report_type}>
                    {r.report_type} v{r.version} — {r.updated_at}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </section>
      </div>
    </div>
  );
}
