import React, { useEffect, useState } from 'react';
import { fetchRecentJobs } from '../../../services/studentV1Api';

const STAGE_LABELS = {
  queued: 'Queued',
  ocr_extract: 'Extracting text',
  pii_classify_mask: 'Masking personal data',
  gemini_analyse: 'Analysing document',
  document_analyse: 'Analysing document',
  insight_analyse: 'Analysing document',
  reidentify_merge: 'Merging into your profile',
  cv_generate: 'Generating CV',
  notify: 'Complete',
};

function stageLabel(stage) {
  if (!stage) return 'Processing';
  if (STAGE_LABELS[stage]) return STAGE_LABELS[stage];
  const cleaned = String(stage)
    .replace(/gemini/gi, 'document')
    .replace(/openai|claude|gpt/gi, 'document')
    .replace(/_/g, ' ');
  return cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
}

export default function ProcessingStatusBanner() {
  const [job, setJob] = useState(null);

  useEffect(() => {
    let cancelled = false;
    let timer = 0;
    const tick = async () => {
      if (sessionStorage.getItem('role') !== 'student' || !sessionStorage.getItem('access_token')) {
        if (!cancelled) setJob(null);
        return;
      }
      try {
        const watchId = sessionStorage.getItem('tracker_watch_job');
        const data = await fetchRecentJobs(3);
        const jobs = data.jobs || [];
        const active =
          jobs.find((j) => j.id === watchId) ||
          jobs.find((j) => j.status !== 'completed' && j.status !== 'failed') ||
          null;
        if (!cancelled) setJob(active);
        if (active?.status === 'completed' || active?.status === 'failed') {
          sessionStorage.removeItem('tracker_watch_job');
        }
      } catch (err) {
        if (!cancelled) setJob(null);
        if (String(err?.message || '').includes('session')) clearInterval(timer);
      }
    };
    tick();
    timer = setInterval(tick, 2500);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, []);

  if (!job || job.status === 'completed') return null;

  const label = stageLabel(job.stage);
  const failed = job.status === 'failed';

  return (
    <div className={`tracker-processing-banner${failed ? ' is-error' : ''}`} role="status">
      <span className="tracker-processing-banner__dot" aria-hidden />
      <span>
        {failed ? 'Document processing failed. Try again or contact support.' : `${label}…`}
        {!failed && job.report_target ? ` (${job.report_target})` : ''}
      </span>
    </div>
  );
}
