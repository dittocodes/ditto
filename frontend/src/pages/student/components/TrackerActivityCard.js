import React, { useEffect, useRef, useState } from 'react';
import { Calendar, Clock, RefreshCw, Upload } from 'lucide-react';

const statusClass = (s, statusTag) => {
  const v = (statusTag || s || '').toLowerCase();
  if (v.includes('completed')) return 'completed';
  if (v.includes('review')) return 'reviewed';
  if (v === 'in_progress' || v.includes('progress')) return 'progress';
  if (v === 'overdue') return 'overdue';
  return 'pending';
};

const termClass = (termType, termTag) => {
  const t = (termType || termTag || '').toLowerCase();
  if (t.includes('short')) return 'short';
  if (t.includes('mid')) return 'mid';
  if (t.includes('long')) return 'long';
  return 'default';
};

function progressBarClass(pct) {
  if (!pct) return 'empty';
  if (pct >= 40) return 'high';
  return 'low';
}

function formatDue(iso) {
  if (!iso) return '';
  return new Date(iso).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

export default function TrackerActivityCard({
  activity,
  onDetails,
  detailsHref,
  onProgressSave,
  onEvidenceUpload,
}) {
  const a = activity;
  const inProgress = (a.status || '').includes('progress') || a.icon === 'progress';
  const Corner = inProgress ? RefreshCw : Clock;
  const termLabel = a.term_tag || a.term;
  const statusLabel = a.status_tag || (a.status || '').replace('_', ' ');
  const pct = typeof a.progress_pct === 'number' ? a.progress_pct : 0;
  const [draftPct, setDraftPct] = useState(pct);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const fileRef = useRef(null);
  const interactive = Boolean(onProgressSave || onEvidenceUpload);

  useEffect(() => {
    setDraftPct(pct);
  }, [pct, a.id]);

  const saveProgress = async (nextPct, markComplete = false) => {
    if (!onProgressSave) return;
    setBusy(true);
    setMsg('');
    try {
      await onProgressSave(a, {
        progress_pct: nextPct,
        status: markComplete || nextPct >= 100 ? 'completed' : nextPct > 0 ? 'in_progress' : 'pending',
      });
      setMsg(markComplete || nextPct >= 100 ? 'Marked complete' : 'Progress saved');
    } catch (e) {
      setMsg(e.message || 'Save failed');
    } finally {
      setBusy(false);
    }
  };

  const onFile = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file || !onEvidenceUpload) return;
    setBusy(true);
    setMsg('');
    try {
      await onEvidenceUpload(a, file);
      setMsg('Evidence uploaded — processing started');
    } catch (err) {
      setMsg(err.message || 'Upload failed');
    } finally {
      setBusy(false);
    }
  };

  return (
    <article className={`tracker-card tracker-activity-card tone-${termClass(a.term_type, a.term)}`}>
      <div className="tracker-activity-title-row">
        <h3>{a.title}</h3>
        <Corner
          className={`tracker-activity-corner-icon${inProgress ? ' is-progress' : ' is-pending'}`}
          size={18}
          aria-hidden
        />
      </div>
      {a.description && <p className="tracker-activity-desc">{a.description}</p>}
      <div className="tracker-activity-tags">
        {termLabel && (
          <span className={`tracker-pill-tag term-${termClass(a.term_type, a.term)}`}>{termLabel}</span>
        )}
        {statusLabel && (
          <span className={`tracker-pill-tag ${statusClass(a.status, a.status_tag)}`}>{statusLabel}</span>
        )}
      </div>
      <div className="tracker-activity-progress">
        <span className="tracker-activity-progress-label">Progress</span>
        <div className={`tracker-activity-progress-bar ${progressBarClass(interactive ? draftPct : pct)}`}>
          <div
            className="tracker-activity-progress-fill"
            style={{ width: `${interactive ? draftPct : pct}%` }}
          />
        </div>
        <span className="tracker-activity-progress-pct">
          {interactive ? draftPct : pct}
          %
        </span>
      </div>
      {interactive ? (
        <div className="tracker-activity-controls">
          <label className="tracker-activity-slider-label">
            <span>Update progress</span>
            <input
              type="range"
              min={0}
              max={100}
              step={5}
              value={draftPct}
              disabled={busy}
              onChange={(e) => setDraftPct(Number(e.target.value))}
            />
          </label>
          <div className="tracker-activity-actions">
            <button
              type="button"
              className="tracker-meeting-btn outline"
              disabled={busy || draftPct === pct}
              onClick={() => saveProgress(draftPct)}
            >
              Save progress
            </button>
            <button
              type="button"
              className="tracker-meeting-btn primary"
              disabled={busy || (a.status || '').toLowerCase() === 'completed'}
              onClick={() => {
                setDraftPct(100);
                saveProgress(100, true);
              }}
            >
              Mark complete
            </button>
            {onEvidenceUpload ? (
              <>
                <input
                  ref={fileRef}
                  type="file"
                  accept=".pdf,.png,.jpg,.jpeg,.txt"
                  hidden
                  onChange={onFile}
                />
                <button
                  type="button"
                  className="tracker-meeting-btn outline"
                  disabled={busy}
                  onClick={() => fileRef.current?.click()}
                >
                  <Upload size={14} aria-hidden />
                  Upload evidence
                </button>
              </>
            ) : null}
          </div>
          {msg ? <p className="tracker-activity-action-msg">{msg}</p> : null}
        </div>
      ) : null}
      <div className="tracker-activity-footer">
        {a.due_date && (
          <span className="tracker-activity-due">
            <Calendar size={14} aria-hidden />
            Due:
            {' '}
            {formatDue(a.due_date)}
          </span>
        )}
        {detailsHref ? (
          <a href={detailsHref} className="tracker-activity-details-link">
            Details →
          </a>
        ) : null}
        {onDetails && !detailsHref ? (
          <button type="button" className="tracker-activity-details-link" onClick={() => onDetails(a)}>
            Details →
          </button>
        ) : null}
      </div>
      {a.mentor_remarks && <p className="tracker-activity-mentor">Mentor: {a.mentor_remarks}</p>}
    </article>
  );
}
