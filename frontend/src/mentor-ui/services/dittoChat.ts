import { API_BASE_URL } from '../../api.js';

export const MENTOR_DITTO_GREETING = {
  role: 'bot' as const,
  text: "Hi, I'm Ditto.\n\nAsk me about your mentees, who is overdue, or who is meeting soon.",
  at: '',
};

export const MENTOR_DITTO_PROMPTS = [
  'Who is overdue?',
  'Who is meeting soon?',
  'How is the group doing?',
];

export const MENTOR_DITTO_KEYS = {
  messages: 'mentor_ditto_messages_v1',
  history: 'mentor_ditto_history_v1',
  seeded: 'mentor_ditto_seeded_v1',
};

export async function sendMentorChat(
  message: string,
  sessionId: string | null,
  onDelta?: (delta: string) => void,
) {
  const token = sessionStorage.getItem('access_token');
  const res = await fetch(`${API_BASE_URL}/api/v1/mentor/chat`, {
    method: 'POST',
    headers: {
      Authorization: token ? `Bearer ${token}` : '',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ message, session_id: sessionId }),
  });
  if (!res.ok) {
    throw new Error(res.status === 401 ? 'Your session timed out' : 'Request failed');
  }
  const reader = res.body?.getReader();
  if (!reader) {
    return { session_id: sessionId, reply: '' };
  }
  const decoder = new TextDecoder();
  let buffer = '';
  let session = sessionId;
  let reply = '';
  let proposal: Record<string, unknown> | null = null;
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const chunks = buffer.split('\n\n');
    buffer = chunks.pop() || '';
    chunks.forEach((block) => {
      const line = block.split('\n').find((row) => row.startsWith('data:'));
      if (!line) return;
      let payload: { delta?: string; session_id?: string; proposal?: Record<string, unknown> } = {};
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

export async function fetchMentorOpening() {
  const token = sessionStorage.getItem('access_token');
  const res = await fetch(`${API_BASE_URL}/api/v1/mentor/chat/opening`, {
    headers: { Authorization: token ? `Bearer ${token}` : '' },
  });
  if (!res.ok) return { text: '', proposal: null };
  return res.json();
}
