/** Sample Support Assistant content for demo / first-run UX. */

export const DITTO_GREETING = {
  role: 'bot',
  text: "Hi, I'm Ditto, your mentor assistant.\n\nAsk me about your progress, your skills, or what is still missing from your record.",
  at: '',
};

export const SAMPLE_MESSAGES = [
  {
    role: 'bot',
    text: DITTO_GREETING.text,
    at: 'Today, 9:00 AM',
  },
  {
    role: 'user',
    text: 'How many activities have I completed?',
    at: 'Today, 9:02 AM',
  },
  {
    role: 'bot',
    text: 'You have finished 24 activities, about 72% of the list.\n\nOpen Activities if you want the due dates.',
    at: 'Today, 9:02 AM',
  },
  {
    role: 'user',
    text: 'Where can I download my monthly report?',
    at: 'Today, 9:05 AM',
  },
  {
    role: 'bot',
    text: 'Open Analysis and use Download Report on the Overview tab.\n\nThe Reports tab has your SWOT and progress files.',
    at: 'Today, 9:05 AM',
  },
];

export const SAMPLE_SEARCH_HISTORY = [
  { id: 'h1', query: 'Download progress report', at: 'Today, 9:05 AM' },
  { id: 'h2', query: 'How many activities have I completed?', at: 'Today, 9:02 AM' },
  { id: 'h3', query: 'Upcoming mentor meetings', at: 'Yesterday, 4:30 PM' },
  { id: 'h4', query: 'SWOT form submission status', at: 'Sep 26, 2:15 PM' },
  { id: 'h5', query: 'Meeting attendance percentage', at: 'Sep 25, 11:40 AM' },
  { id: 'h6', query: 'Skills assessment scores', at: 'Sep 24, 5:20 PM' },
];

export const QUICK_PROMPTS = [
  'My progress summary',
  'Upcoming meetings',
  'Overdue activities',
  'Download report',
];

export const STORAGE_KEYS = {
  messages: 'tracker_support_messages_v2',
  history: 'tracker_support_history_v1',
  seeded: 'tracker_support_demo_seeded_v1',
};

function isSampleThread(messages) {
  return (messages || []).some((m) => String(m.text || '').includes('24 activities'));
}

export function loadStoredMessages(allowSample = false, keys = STORAGE_KEYS) {
  try {
    const raw = sessionStorage.getItem(keys.messages);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length) {
        if (!allowSample && isSampleThread(parsed)) return null;
        return parsed;
      }
    }
  } catch {
    /* ignore */
  }
  return null;
}

export function saveStoredMessages(messages, keys = STORAGE_KEYS) {
  try {
    sessionStorage.setItem(keys.messages, JSON.stringify(messages));
  } catch {
    /* ignore */
  }
}

function isSampleHistory(entries) {
  const ids = new Set((entries || []).map((e) => e.id));
  return ids.has('h1') && ids.has('h2');
}

export function loadSearchHistory(allowSample = false, keys = STORAGE_KEYS) {
  try {
    const raw = localStorage.getItem(keys.history);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length) {
        if (!allowSample && isSampleHistory(parsed)) return [];
        return parsed;
      }
    }
  } catch {
    /* ignore */
  }
  if (!allowSample) return [];
  if (!localStorage.getItem(keys.seeded)) {
    localStorage.setItem(keys.seeded, '1');
    localStorage.setItem(keys.history, JSON.stringify(SAMPLE_SEARCH_HISTORY));
  }
  return [...SAMPLE_SEARCH_HISTORY];
}

export function persistSearchHistory(entries, keys = STORAGE_KEYS) {
  try {
    localStorage.setItem(keys.history, JSON.stringify(entries));
  } catch {
    /* ignore */
  }
}

export function formatMessageTime(date = new Date()) {
  return date.toLocaleString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
}

export function formatHistoryStamp(date = new Date()) {
  const now = new Date();
  const sameDay = date.toDateString() === now.toDateString();
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  const time = date.toLocaleString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
  if (sameDay) return `Today, ${time}`;
  if (date.toDateString() === yesterday.toDateString()) return `Yesterday, ${time}`;
  return date.toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true });
}
