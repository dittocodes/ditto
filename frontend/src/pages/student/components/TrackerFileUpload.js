import React, { useState } from 'react';
import { pollJob } from '../../../services/studentV1Api';

export default function TrackerFileUpload({ label, accept, uploadFn, onComplete }) {
  const [status, setStatus] = useState('');
  const [busy, setBusy] = useState(false);

  const onChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setBusy(true);
    setStatus('Uploading…');
    try {
      const { job_id: jobId } = await uploadFn(file);
      setStatus(`Processing job ${jobId}…`);
      let job = await pollJob(jobId);
      for (let i = 0; i < 30 && job.status !== 'completed' && job.status !== 'failed'; i += 1) {
        await new Promise((r) => setTimeout(r, 2000));
        job = await pollJob(jobId);
      }
      setStatus(job.status === 'completed' ? 'Done' : job.status === 'failed' ? 'Failed — try again' : 'Still processing — check Jobs later');
      if (onComplete) onComplete(job);
    } catch (err) {
      setStatus(err.message || 'Upload failed');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="tracker-card" style={{ marginTop: 12 }}>
      <h4>{label}</h4>
      <input type="file" accept={accept} disabled={busy} onChange={onChange} />
      {status && <p style={{ fontSize: 13, color: '#64748b', marginTop: 8 }}>{status}</p>}
    </div>
  );
}
