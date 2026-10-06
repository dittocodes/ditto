import React, { useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { apiGet, apiPost, getUid, uploadActivityEvidence } from '../../../services/studentV1Api';
import TrackerPageHeader from './TrackerPageHeader';

const FILTERS = [
  { id: 'all', label: 'All' },
  { id: 'requested', label: 'Waiting' },
  { id: 'added', label: 'Added' },
  { id: 'rejected', label: 'Declined' },
];

function requestState(activity) {
  if (activity.status === 'requested') return 'requested';
  if (activity.origin === 'student_request' && activity.status === 'rejected') return 'rejected';
  if (activity.origin === 'student_request') return 'added';
  return '';
}

export default function ActivitiesSubmissions() {
  const { student_usn } = useParams();
  const [items, setItems] = useState([]);
  const [filter, setFilter] = useState('all');
  const [title, setTitle] = useState('');
  const [details, setDetails] = useState('');
  const [term, setTerm] = useState('short-term');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [uploadingId, setUploadingId] = useState(null);

  const load = async () => {
    const uid = await getUid();
    setItems(await apiGet(`/api/v1/students/${uid}/activities`));
  };

  useEffect(() => {
    load().catch((err) => setError(err.message || 'Could not load activities'));
  }, [student_usn]);

  const requests = useMemo(
    () => items.filter((item) => requestState(item)),
    [items],
  );
  const visibleRequests = requests.filter((item) => filter === 'all' || requestState(item) === filter);
  const assigned = items.filter((item) => item.status !== 'requested' && !(item.origin === 'student_request' && item.status === 'rejected'));

  const sendRequest = async (event) => {
    event.preventDefault();
    setError('');
    setMessage('');
    setBusy(true);
    try {
      const uid = await getUid();
      await apiPost(`/api/v1/students/${uid}/activities/request`, {
        title,
        description: details,
        term,
      });
      setTitle('');
      setDetails('');
      setMessage('Request sent. It appears on your list after your mentor approves it.');
      await load();
    } catch (err) {
      setError(err.message || 'Could not send the request');
    } finally {
      setBusy(false);
    }
  };

  const uploadProof = async (activity, file) => {
    if (!file) return;
    setError('');
    setUploadingId(activity.id);
    try {
      const uid = await getUid();
      await uploadActivityEvidence(uid, activity.id, file);
      setMessage(`Proof received for ${activity.title}.`);
    } catch (err) {
      setError(err.message || 'Upload failed');
    } finally {
      setUploadingId(null);
    }
  };

  return (
    <div className="tracker-submissions">
      <TrackerPageHeader
        title="Activity submissions"
        subtitle="Ask your mentor for an activity. It is added to your list only after they approve it. Upload proof for activities already assigned."
      />

      <form className="tracker-card tracker-request-form" onSubmit={sendRequest}>
        <h2>Request an activity</h2>
        <label htmlFor="request-title">Title</label>
        <input id="request-title" className="tracker-input" value={title} onChange={(e) => setTitle(e.target.value)} required placeholder="What do you want to work on?" />
        <label htmlFor="request-details">Why this activity</label>
        <textarea id="request-details" className="tracker-input" rows={3} value={details} onChange={(e) => setDetails(e.target.value)} placeholder="A short note for your mentor" />
        <label htmlFor="request-term">Term</label>
        <select id="request-term" className="tracker-input" value={term} onChange={(e) => setTerm(e.target.value)}>
          <option value="short-term">Short-term</option>
          <option value="mid-term">Mid-term</option>
          <option value="long-term">Long-term</option>
        </select>
        <button type="submit" className="tracker-btn-primary" disabled={busy}>{busy ? 'Sending…' : 'Send to mentor'}</button>
        {message && <p className="tracker-request-note">{message}</p>}
        {error && <p className="tracker-request-error">{error}</p>}
      </form>

      <div className="tracker-activities-tabs">
        {FILTERS.map((item) => (
          <button
            key={item.id}
            type="button"
            className={`tracker-activities-tab${filter === item.id ? ' active' : ''}`}
            onClick={() => setFilter(item.id)}
          >
            {item.label} ({item.id === 'all' ? requests.length : requests.filter((row) => requestState(row) === item.id).length})
          </button>
        ))}
      </div>

      {!visibleRequests.length && <div className="tracker-card tracker-request-empty">No requests in this view.</div>}
      <div className="tracker-submission-list">
        {visibleRequests.map((item) => {
          const state = requestState(item);
          return (
            <article key={item.id} className="tracker-card tracker-submission-card">
              <div>
                <h3>{item.title}</h3>
                <p>{item.description}</p>
              </div>
              <span className={`tracker-request-pill ${state}`}>
                {state === 'requested' ? 'Waiting for mentor' : state === 'added' ? 'Added' : 'Declined'}
              </span>
            </article>
          );
        })}
      </div>

      <h2 className="tracker-submission-heading">Assigned activities</h2>
      {!assigned.length && <div className="tracker-card tracker-request-empty">No activities assigned yet. Approved requests show up here.</div>}
      <div className="tracker-submission-list">
        {assigned.map((item) => (
          <article key={item.id} className="tracker-card tracker-submission-card">
            <div>
              <h3>{item.title}</h3>
              <p>{item.status_tag || item.status}{item.due_date ? ` · Due ${item.due_date.slice(0, 10)}` : ''}</p>
            </div>
            <label className="tracker-proof-btn">
              {uploadingId === item.id ? 'Uploading…' : 'Upload proof'}
              <input
                type="file"
                accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
                disabled={uploadingId === item.id}
                onChange={(e) => uploadProof(item, e.target.files?.[0])}
              />
            </label>
          </article>
        ))}
      </div>
    </div>
  );
}
