import { API_BASE_URL } from '../api';

const SESSION_ERROR = 'Your session timed out. Sign in again.';
let refreshPromise = null;

function authHeaders() {
  const token = sessionStorage.getItem('access_token');
  return token ? { Authorization: `Bearer ${token}` } : {};
}

function storeSession(data) {
  if (!data?.access_token || !data?.expires_in) return false;
  sessionStorage.setItem('access_token', data.access_token);
  sessionStorage.setItem('tokenExpiry', String(Date.now() + data.expires_in * 1000));
  return true;
}

export function refreshAccessToken() {
  if (refreshPromise) return refreshPromise;
  const token = sessionStorage.getItem('access_token');
  if (!token) return Promise.resolve(false);
  refreshPromise = fetch(`${API_BASE_URL}/auth/refresh`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
  })
    .then(async (res) => {
      if (!res.ok) return false;
      const data = await res.json().catch(() => ({}));
      return storeSession(data);
    })
    .catch(() => false)
    .finally(() => {
      refreshPromise = null;
    });
  return refreshPromise;
}

async function fetchWithSession(url, options, retried = false) {
  const res = await fetch(url, options);
  if (res.status === 401 && !retried && await refreshAccessToken()) {
    const headers = { ...(options.headers || {}), ...authHeaders() };
    return fetchWithSession(url, { ...options, headers }, true);
  }
  return res;
}

export function trackProcessingJob(jobId) {
  if (jobId) sessionStorage.setItem('tracker_watch_job', String(jobId));
}

export async function fetchStudentUid() {
  const res = await fetch(`${API_BASE_URL}/api/v1/students/me/uid`, { headers: authHeaders() });
  if (!res.ok) throw new Error('Failed to resolve student UID');
  const data = await res.json();
  sessionStorage.setItem('student_uid', data.uid);
  return data.uid;
}

export async function getUid(forceRefresh = false) {
  if (!forceRefresh) {
    const cached = sessionStorage.getItem('student_uid');
    if (cached) return cached;
  }
  return fetchStudentUid();
}

export async function apiGet(path) {
  const res = await fetchWithSession(`${API_BASE_URL}${path}`, { headers: authHeaders() });
  const json = await res.json().catch(() => ({}));
  if (res.status === 401) throw new Error(SESSION_ERROR);
  if (!res.ok) throw new Error(json.detail || res.statusText);
  return json;
}

export async function apiPost(path, body) {
  const res = await fetch(`${API_BASE_URL}${path}`, {
    method: 'POST',
    headers: { ...authHeaders(), 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json.detail || res.statusText);
  return json;
}

export async function apiPut(path, body) {
  const res = await fetch(`${API_BASE_URL}${path}`, {
    method: 'PUT',
    headers: { ...authHeaders(), 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json.detail || res.statusText);
  return json;
}

export async function apiPatch(path, body) {
  const res = await fetch(`${API_BASE_URL}${path}`, {
    method: 'PATCH',
    headers: { ...authHeaders(), 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json.detail || res.statusText);
  return json;
}

export async function fetchOverview(uid) {
  return apiGet(`/api/v1/students/${uid}/overview`);
}

export async function fetchProfile(uid, tab) {
  return apiGet(`/api/v1/students/${uid}/profile?tab=${tab}`);
}

export async function fetchAnalysis(uid, tab) {
  return apiGet(`/api/v1/students/${uid}/analysis?tab=${tab}`);
}

export async function sendChat(uid, message, sessionId, onDelta) {
  const res = await fetchWithSession(`${API_BASE_URL}/api/v1/students/${uid}/chat`, {
    method: 'POST',
    headers: { ...authHeaders(), 'Content-Type': 'application/json' },
    body: JSON.stringify({ message, session_id: sessionId }),
  });
  if (!res.ok) {
    const json = await res.json().catch(() => ({}));
    throw new Error(res.status === 401 ? SESSION_ERROR : (json.detail || res.statusText));
  }
  const reader = res.body?.getReader();
  if (!reader) {
    const json = await res.json().catch(() => ({}));
    if (json.reply && onDelta) onDelta(json.reply);
    return { session_id: json.session_id || sessionId, reply: json.reply || '' };
  }
  const decoder = new TextDecoder();
  let buffer = '';
  let session = sessionId;
  let reply = '';
  let proposal = null;
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const chunks = buffer.split('\n\n');
    buffer = chunks.pop() || '';
    chunks.forEach((block) => {
      const line = block.split('\n').find((row) => row.startsWith('data:'));
      if (!line) return;
      let payload = {};
      try {
        payload = JSON.parse(line.slice(5).trim());
      } catch {
        return;
      }
      if (payload.delta) {
        reply += payload.delta;
        if (onDelta) onDelta(payload.delta);
      }
      if (payload.session_id) session = payload.session_id;
      if (payload.proposal) proposal = payload.proposal;
    });
  }
  return { session_id: session, reply, proposal };
}

async function dittoAction(proposalId, method, path, body) {
  const res = await fetch(`${API_BASE_URL}/api/v1/chat/actions/${proposalId}${path}`, {
    method,
    headers: { ...authHeaders(), ...(body ? { 'Content-Type': 'application/json' } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const detail = data.detail;
    throw new Error(typeof detail === 'string' ? detail : 'That action could not be completed.');
  }
  return data;
}

export function confirmDittoAction(proposalId) {
  return dittoAction(proposalId, 'POST', '/execute');
}

export function cancelDittoAction(proposalId) {
  return dittoAction(proposalId, 'POST', '/cancel');
}

export function editDittoAction(proposalId, values) {
  return dittoAction(proposalId, 'PATCH', '', { values });
}

export async function pollJob(jobId) {
  return apiGet(`/api/v1/jobs/${jobId}`);
}

export async function pollJobUntilDone(jobId, maxAttempts = 40, intervalMs = 2000) {
  const terminal = new Set(['completed', 'failed', 'dead_letter']);
  let job = await pollJob(jobId);
  for (let i = 0; i < maxAttempts && !terminal.has(job.status); i += 1) {
    await new Promise((r) => setTimeout(r, intervalMs));
    job = await pollJob(jobId);
  }
  return job;
}

async function uploadMultipart(path, file, extraFields = {}) {
  const fd = new FormData();
  fd.append('file', file);
  Object.entries(extraFields).forEach(([k, v]) => fd.append(k, v));
  const res = await fetch(`${API_BASE_URL}${path}`, {
    method: 'POST',
    headers: authHeaders(),
    body: fd,
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json.detail || res.statusText);
  if (json.job_id) trackProcessingJob(json.job_id);
  return json;
}

export async function fetchRecentJobs(limit = 5) {
  return apiGet(`/api/v1/students/me/jobs/recent?limit=${limit}`);
}

export async function uploadAcademicDoc(uid, file) {
  return uploadMultipart(`/api/v1/students/${uid}/academic/upload`, file);
}

export async function uploadCareerDoc(uid, file) {
  return uploadMultipart(`/api/v1/students/${uid}/career/upload`, file);
}

export async function uploadCampusDoc(uid, file) {
  return uploadMultipart(`/api/v1/students/${uid}/campus/upload`, file);
}

export async function uploadKnowledgeDoc(uid, file) {
  return uploadMultipart(`/api/v1/students/${uid}/knowledge/upload`, file);
}

export async function fetchKnowledge() {
  return apiGet('/api/v1/students/me/knowledge');
}

export async function updateKnowledgeCategory(itemId, docGroup, category) {
  return apiPatch(`/api/v1/students/me/knowledge/${itemId}`, { doc_group: docGroup, category });
}

export async function fetchCampusActivities(uid) {
  return apiGet(`/api/v1/students/${uid}/campus`);
}

export async function cancelMeeting(meetingId) {
  const res = await fetch(`${API_BASE_URL}/api/v1/meetings/${meetingId}/cancel`, {
    method: 'POST',
    headers: authHeaders(),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json.detail || res.statusText);
  return json;
}

export async function uploadMeetingSummary(uid, meetingId, file) {
  return uploadMultipart(`/api/v1/students/${uid}/meetings/${meetingId}/summary`, file);
}

export async function generateCv(uid) {
  const res = await fetch(`${API_BASE_URL}/api/v1/students/${uid}/cv/generate`, {
    method: 'POST',
    headers: authHeaders(),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json.detail || res.statusText);
  if (json.job_id) {
    return pollJobUntilDone(json.job_id);
  }
  return json;
}

export async function joinMeeting(meetingId) {
  const res = await fetch(`${API_BASE_URL}/api/v1/meetings/${meetingId}/join`, {
    method: 'POST',
    headers: authHeaders(),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json.detail || res.statusText);
  return json;
}

export async function downloadReport(uid, reportType) {
  const res = await fetch(`${API_BASE_URL}/api/v1/students/${uid}/reports/${reportType}/download`, {
    headers: authHeaders(),
  });
  if (!res.ok) {
    const json = await res.json().catch(() => ({}));
    throw new Error(json.detail || res.statusText);
  }
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${reportType}-report.pdf`;
  a.click();
  URL.revokeObjectURL(url);
}

export async function downloadReportPack(uid) {
  const res = await fetch(`${API_BASE_URL}/api/v1/students/${uid}/reports/pack`, {
    headers: authHeaders(),
  });
  if (!res.ok) {
    const json = await res.json().catch(() => ({}));
    throw new Error(json.detail || res.statusText);
  }
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'mentee-report-pack.zip';
  a.click();
  URL.revokeObjectURL(url);
}

export async function submitProfileReview(uid, approved, edits) {
  return apiPost(`/api/v1/students/${uid}/profile/review`, { approved, edits: edits || null });
}

export async function addStudentLink(uid, type, url) {
  return apiPost(`/api/v1/students/${uid}/links`, { type, url });
}

export async function patchProfilePersonal(uid, body) {
  return apiPatch(`/api/v1/students/${uid}/profile/personal`, body);
}

export async function refreshProfile(uid, tab = 'overview') {
  return apiPost(`/api/v1/students/${uid}/profile/refresh?tab=${encodeURIComponent(tab)}`, {});
}

export async function patchActivity(uid, activityId, body) {
  return apiPatch(`/api/v1/students/${uid}/activities/${activityId}`, body);
}

export async function uploadActivityEvidence(uid, activityId, file) {
  return uploadMultipart(`/api/v1/students/${uid}/activities/${activityId}/evidence`, file);
}
