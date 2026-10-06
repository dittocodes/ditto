import { useCallback, useEffect, useState } from 'react';
import { pollJob } from '../services/studentV1Api';

export function useProcessingJob(jobId) {
  const [job, setJob] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!jobId) return undefined;
    let cancelled = false;
    (async () => {
      try {
        let j = await pollJob(jobId);
        for (let i = 0; i < 40 && !cancelled && j.status !== 'completed' && j.status !== 'failed'; i += 1) {
          await new Promise((r) => setTimeout(r, 2000));
          j = await pollJob(jobId);
        }
        if (!cancelled) setJob(j);
      } catch (e) {
        if (!cancelled) setError(e.message);
      }
    })();
    return () => { cancelled = true; };
  }, [jobId]);

  return { job, error, busy: jobId && !job && !error };
}

export function useTrackerOverview(uid) {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const reload = useCallback(async () => {
    if (!uid) return;
    const { fetchOverview } = await import('../services/studentV1Api');
    try {
      setData(await fetchOverview(uid));
      setError(null);
    } catch (e) {
      setError(e.message);
    }
  }, [uid]);
  useEffect(() => { reload(); }, [reload]);
  return { data, error, reload };
}
