import React, { useEffect, useMemo, useRef, useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { API_BASE_URL } from '../../../../api';
import { fetchCampusActivities, getUid, uploadCampusDoc } from '../../../../services/studentV1Api';
import TrackerFileUpload from '../../components/TrackerFileUpload';
import './campus-hub.css';

const FILTERS = [
  ['all', 'All'],
  ['note', 'Notes'],
  ['event', 'Events'],
  ['blog', 'Posts'],
];

async function campusRequest(path, options = {}) {
  const token = sessionStorage.getItem('access_token');
  const headers = { ...(options.headers || {}) };
  if (token) headers.Authorization = `Bearer ${token}`;
  if (options.body) headers['Content-Type'] = 'application/json';
  const res = await fetch(`${API_BASE_URL}${path}`, { ...options, headers });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.detail || 'Request failed');
  return data;
}

function parseWhen(value) {
  const date = new Date(String(value || '').replace(' ', 'T'));
  return Number.isNaN(date.getTime()) ? null : date;
}

function whenLabel(value) {
  const date = parseWhen(value);
  if (!date) return value || '';
  return date.toLocaleString('en-IN', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function relativeTime(value) {
  const date = parseWhen(value);
  if (!date) return '';
  const minutes = Math.round((Date.now() - date.getTime()) / 60000);
  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  if (days < 7) return `${days}d ago`;
  return whenLabel(value);
}

function isToday(value) {
  const date = parseWhen(value);
  if (!date) return false;
  const now = new Date();
  return date.getFullYear() === now.getFullYear()
    && date.getMonth() === now.getMonth()
    && date.getDate() === now.getDate();
}

function dateBlock(value) {
  const date = parseWhen(value);
  if (!date) return { month: '', day: '' };
  return {
    month: date.toLocaleString('en-US', { month: 'short' }).toUpperCase(),
    day: String(date.getDate()),
  };
}

function splitNote(content) {
  const lines = String(content || '').split('\n');
  const label = (lines[0] || '').trim();
  const title = (lines[1] || label).trim();
  const body = lines.slice(2).join('\n').trim();
  return { label, title, body: body || (lines.length < 3 ? '' : body) };
}

function bannerKind(skills) {
  const text = (skills || []).join(' ').toLowerCase();
  if (/bio|health|medic/.test(text)) return 'bio';
  if (/speak|toast|debate|public/.test(text)) return 'speaking';
  if (/code|python|tech|hack|design|cloud|ai|data|system/.test(text)) return 'tech';
  return 'default';
}

function bannerMark(kind) {
  if (kind === 'bio') return 'Bio';
  if (kind === 'speaking') return 'Talk';
  if (kind === 'tech') return 'Tech';
  return 'Campus';
}

function noteAccent(note) {
  if (note.author_role === 'admin' || note.is_pinned) return 'urgent';
  if (note.author_role === 'dept_head') return 'dept';
  return 'mentor';
}

function roleLabel(role) {
  if (role === 'admin') return 'Admin';
  if (role === 'dept_head') return 'Department';
  return 'Mentor';
}

function readMinutes(post) {
  const source = `${post.author || ''} ${post.content || ''}`;
  const match = source.match(/(\d+)\s*min read/i);
  if (match) return `${match[1]} min read`;
  const words = String(post.content || '').trim().split(/\s+/).filter(Boolean).length;
  if (!words) return '';
  return `${Math.max(1, Math.round(words / 200))} min read`;
}

function snippet(text) {
  return String(text || '').replace(/\s+/g, ' ').trim();
}

function LinkText({ text }) {
  const parts = String(text || '').split(/(https?:\/\/[^\s]+)/g);
  return parts.map((part, index) => (
    part.startsWith('http')
      ? <a key={index} className="campus-link-preview" href={part} target="_blank" rel="noreferrer">{part}</a>
      : <span key={index}>{part}</span>
  ));
}

export default function CampusPage() {
  const [feed, setFeed] = useState({ announcements: [], events: [], blogs: [] });
  const [proofs, setProofs] = useState([]);
  const [filter, setFilter] = useState('all');
  const [error, setError] = useState('');
  const [qr, setQr] = useState(null);
  const [joinMsg, setJoinMsg] = useState('');
  const [composing, setComposing] = useState(false);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [showProofs, setShowProofs] = useState(false);
  const proofsRef = useRef(null);

  const loadFeed = async () => {
    setFeed(await campusRequest('/api/v1/campus/feed'));
  };

  const loadProofs = async () => {
    const uid = await getUid();
    setProofs(await fetchCampusActivities(uid));
  };

  useEffect(() => {
    loadFeed().catch((err) => setError(err.message || 'Could not load campus'));
    loadProofs().catch(() => setProofs([]));
  }, []);

  const rsvp = async (event) => {
    setError('');
    try {
      const result = await campusRequest(`/api/v1/campus/events/${event.id}/rsvp`, {
        method: 'POST',
        body: JSON.stringify({ attending: !event.rsvp }),
      });
      await loadFeed();
      if (result.attending && result.qr_value) setQr({ title: event.title, value: result.qr_value });
    } catch (err) {
      setError(err.message || 'RSVP failed');
    }
  };

  const join = async (event) => {
    setJoinMsg('');
    setError('');
    try {
      const result = await campusRequest(`/api/v1/campus/events/${event.id}/join`, { method: 'POST' });
      setJoinMsg(result.configured ? 'You are in the room. Attendance will be saved when the host ends the event.' : 'Your join was recorded. Video is not configured on this server yet.');
      await loadFeed();
    } catch (err) {
      setError(err.message || 'Join failed');
    }
  };

  const publish = async (event) => {
    event.preventDefault();
    setError('');
    try {
      await campusRequest('/api/v1/campus/blogs', {
        method: 'POST',
        body: JSON.stringify({ title, content: body }),
      });
      setTitle('');
      setBody('');
      setComposing(false);
      setFilter('all');
      await loadFeed();
    } catch (err) {
      setError(err.message || 'Could not publish');
    }
  };

  const uploadFn = async (file) => {
    const uid = await getUid();
    const result = await uploadCampusDoc(uid, file);
    await loadProofs();
    return result;
  };

  const openProofs = () => {
    setShowProofs(true);
    window.setTimeout(() => proofsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 0);
  };

  const notes = feed.announcements || [];
  const events = feed.events || [];
  const posts = feed.blogs || [];
  const external = proofs.filter((item) => !String(item.evidence_ref || '').startsWith('event-'));
  const upcoming = events.filter((event) => event.status !== 'ended');
  const tickets = upcoming.filter((event) => event.rsvp);
  const suggestions = upcoming.filter((event) => event.swot_match && !event.rsvp).slice(0, 3);
  const highlights = [
    ...notes.filter((note) => note.is_pinned || note.author_role === 'admin').map((note) => ({ kind: 'note', id: `n-${note.id}`, note })),
    ...upcoming.filter((event) => isToday(event.scheduled_at)).map((event) => ({ kind: 'event', id: `e-${event.id}`, event })),
  ];

  const timeline = useMemo(() => {
    const rows = [
      ...notes.map((note) => ({ kind: 'note', at: parseWhen(note.created_at)?.getTime() || 0, id: `note-${note.id}`, note })),
      ...events.map((event) => ({ kind: 'event', at: parseWhen(event.created_at || event.scheduled_at)?.getTime() || 0, id: `event-${event.id}`, event })),
      ...posts.map((post) => ({ kind: 'blog', at: parseWhen(post.published_at)?.getTime() || 0, id: `blog-${post.id}`, post })),
    ];
    rows.sort((left, right) => right.at - left.at);
    return filter === 'all' ? rows : rows.filter((row) => row.kind === filter);
  }, [notes, events, posts, filter]);

  const renderEvent = (event, compact = false) => {
    const kind = bannerKind(event.skills);
    const stamp = dateBlock(event.scheduled_at);
    const place = event.event_type === 'online' ? (event.location || 'Online') : (event.location || 'On campus');
    return (
      <article key={event.id} className={`campus-event-card ${compact ? 'compact' : ''}`}>
        {!compact && (
          <div className={`campus-banner campus-banner-${kind}`}>
            <span className="campus-date">
              <strong>{stamp.day}</strong>
              <small>{stamp.month}</small>
            </span>
            <span className="campus-banner-mark">{bannerMark(kind)}</span>
          </div>
        )}
        <div className="campus-event-body">
          <h3>{event.title}</h3>
          {!compact && event.description && <p className="campus-copy">{event.description}</p>}
          <div className="campus-pills">
            <span className="campus-pill">{event.event_type === 'online' ? 'Online' : 'On campus'} · {place}</span>
            {(event.skills || []).map((skill) => <span key={skill} className="campus-pill campus-pill-skill">{skill}</span>)}
          </div>
          {event.attending_count > 0 && <p className="campus-fomo">{event.attending_count} attending</p>}
          {event.swot_match && <p className="campus-gap">Matches a gap from your SWOT</p>}
          <div className="campus-event-footer">
            {event.event_type === 'online' && event.status !== 'ended' && (
              <button type="button" disabled={!event.join_open} onClick={() => join(event)}>
                {event.join_open ? 'Join session' : 'Join opens 10 minutes before the start'}
              </button>
            )}
            {event.event_type === 'offline' && event.status !== 'ended' && !event.rsvp && (
              <button type="button" className="gold" onClick={() => rsvp(event)}>RSVP</button>
            )}
            {event.event_type === 'offline' && event.rsvp && event.qr_value && (
              <button type="button" className="ticket" onClick={() => setQr({ title: event.title, value: event.qr_value })}>View ticket</button>
            )}
            {event.status !== 'ended' && event.rsvp && (
              <button type="button" className="ghost" onClick={() => rsvp(event)}>Cancel RSVP</button>
            )}
          </div>
        </div>
      </article>
    );
  };

  return (
    <div className="campus-hub">
      <div className="campus-head">
        <div>
          <h1 className="tracker-page-title">Campus</h1>
          <p className="tracker-page-sub">Hosted events are recorded from attendance. Upload a file only for activities held outside this portal.</p>
        </div>
      </div>

      {!!highlights.length && (
        <div className="campus-highlights">
          {highlights.map((item) => (
            item.kind === 'note' ? (
              <button key={item.id} type="button" className="campus-highlight urgent" onClick={() => setFilter('note')}>
                <span>Urgent</span>
                <strong>{splitNote(item.note.content).title}</strong>
              </button>
            ) : (
              <button key={item.id} type="button" className="campus-highlight today" onClick={() => setFilter('event')}>
                <span>Today</span>
                <strong>{item.event.title}</strong>
              </button>
            )
          ))}
        </div>
      )}

      <div className="campus-layout">
        <div>
          <button type="button" className="campus-composer" onClick={() => setComposing(true)}>Share a short post</button>
          <div className="campus-filters">
            {FILTERS.map(([id, label]) => (
              <button key={id} type="button" className={filter === id ? 'active' : ''} onClick={() => setFilter(id)}>{label}</button>
            ))}
          </div>
          {error && <p className="campus-card campus-error">{error}</p>}
          {joinMsg && <p className="campus-card">{joinMsg}</p>}
          {!timeline.length && <div className="campus-empty">Nothing here yet.</div>}
          {timeline.map((item) => {
            if (item.kind === 'event') return renderEvent(item.event);
            if (item.kind === 'note') {
              const parts = splitNote(item.note.content);
              const accent = noteAccent(item.note);
              return (
                <article key={item.id} className={`campus-card campus-announcement campus-accent-${accent}`}>
                  <div className="campus-author">
                    <span className="campus-avatar">{(item.note.author_name || 'C').slice(0, 1)}</span>
                    <div>
                      <strong>{item.note.author_name || roleLabel(item.note.author_role)}</strong>
                      <div className="campus-meta">{roleLabel(item.note.author_role)} · {relativeTime(item.note.created_at)}{item.note.is_pinned ? ' · Pinned' : ''}</div>
                    </div>
                  </div>
                  <h3>{parts.title}</h3>
                  {parts.body && <p className="campus-copy"><LinkText text={parts.body} /></p>}
                </article>
              );
            }
            const minutes = readMinutes(item.post);
            return (
              <article key={item.id} className="campus-card campus-blog">
                <div className="campus-author">
                  <span className="campus-avatar">{(item.post.author || 'S').slice(0, 1)}</span>
                  <div>
                    <strong>{item.post.author || 'Student'}</strong>
                    <div className="campus-meta">{relativeTime(item.post.published_at)}{minutes ? ` · ${minutes}` : ''}</div>
                  </div>
                </div>
                <h3>{item.post.title}</h3>
                <p className="campus-snippet">{snippet(item.post.content)}</p>
              </article>
            );
          })}
        </div>

        <aside className="campus-side">
          <section className="campus-card">
            <h2>Your tickets</h2>
            {!tickets.length && <p className="campus-meta">No upcoming RSVPs yet.</p>}
            {tickets.map((event) => (
              <div key={event.id} className="campus-ticket">
                <div>
                  <strong>{event.title}</strong>
                  <div className="campus-meta">{whenLabel(event.scheduled_at)}</div>
                </div>
                {event.event_type === 'offline' && event.qr_value && (
                  <button type="button" className="gold" onClick={() => setQr({ title: event.title, value: event.qr_value })}>Show QR</button>
                )}
                {event.event_type === 'online' && (
                  <button type="button" disabled={!event.join_open} onClick={() => join(event)}>
                    {event.join_open ? 'Join' : 'Soon'}
                  </button>
                )}
              </div>
            ))}
          </section>
          <section className="campus-card">
            <h2>Suggested for you</h2>
            {!suggestions.length && <p className="campus-meta">No events match a gap from your SWOT yet.</p>}
            {suggestions.map((event) => (
              <div key={event.id} className="campus-suggest">
                <strong>{event.title}</strong>
                <p className="campus-gap">Matches a gap from your SWOT</p>
                {event.event_type === 'offline' && !event.rsvp && (
                  <button type="button" className="gold" onClick={() => rsvp(event)}>RSVP</button>
                )}
              </div>
            ))}
          </section>
          <button type="button" className="campus-upload" onClick={openProofs}>Upload external proof</button>
        </aside>
      </div>

      {showProofs && (
        <section className="campus-proofs" ref={proofsRef}>
          <h2>External proofs</h2>
          <p className="campus-meta">Certificates and club proofs from outside this portal. Events created here do not need a file.</p>
          <TrackerFileUpload label="Upload an external campus proof" accept="image/*,.pdf" uploadFn={uploadFn} />
          {!external.length && <div className="campus-empty">No external proofs uploaded.</div>}
          {external.map((item) => (
            <article key={item.id} className="campus-card">
              <h3>{item.event_name}</h3>
              <div className="campus-meta">{item.role || 'Participant'} · {item.record_date || '—'} · {item.verified ? 'Verified' : 'Pending review'}</div>
            </article>
          ))}
        </section>
      )}

      {composing && (
        <div className="campus-modal" onClick={() => setComposing(false)} role="presentation">
          <form className="campus-modal-card campus-form" onClick={(event) => event.stopPropagation()} onSubmit={publish}>
            <h3>Share a short post</h3>
            <label htmlFor="blog-title">Title</label>
            <input id="blog-title" value={title} onChange={(event) => setTitle(event.target.value)} required />
            <label htmlFor="blog-body">Post</label>
            <textarea id="blog-body" rows={4} value={body} onChange={(event) => setBody(event.target.value)} required />
            <div className="campus-actions">
              <button type="button" className="ghost" onClick={() => setComposing(false)}>Cancel</button>
              <button type="submit" className="gold">Publish</button>
            </div>
          </form>
        </div>
      )}

      {qr && (
        <div className="campus-modal" onClick={() => setQr(null)} role="presentation">
          <div className="campus-modal-card" onClick={(event) => event.stopPropagation()} role="dialog" aria-label="Attendance QR">
            <h3>{qr.title}</h3>
            <p className="campus-meta">Show this code to the host.</p>
            <QRCodeSVG value={qr.value} size={180} />
            <div className="campus-actions" style={{ justifyContent: 'center' }}>
              <button type="button" className="ghost" onClick={() => setQr(null)}>Close</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
