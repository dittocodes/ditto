import { useCallback, useEffect, useState } from 'react';
import { fetchProfile, fetchAnalysis } from '../services/studentV1Api';

export function useTrackerProfile(uid, tab = 'overview') {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const reload = useCallback(async () => {
    if (!uid) return;
    try {
      setData(await fetchProfile(uid, tab));
      setError(null);
    } catch (e) {
      setError(e.message);
    }
  }, [uid, tab]);
  useEffect(() => { reload(); }, [reload]);
  return { data, error, reload };
}

export function useTrackerAnalysis(uid, tab = 'overview') {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const reload = useCallback(async () => {
    if (!uid) return;
    try {
      setData(await fetchAnalysis(uid, tab));
      setError(null);
    } catch (e) {
      setError(e.message);
    }
  }, [uid, tab]);
  useEffect(() => { reload(); }, [reload]);
  return { data, error, reload };
}

export { useProcessingJob, useTrackerOverview } from './useProcessingJob';
