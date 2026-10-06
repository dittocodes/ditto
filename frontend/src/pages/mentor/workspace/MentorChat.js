import React, { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { mentorRequest } from './mentorApi';

export default function MentorChat() {
  const { mentor_id, student_usn } = useParams();
  const [inbox, setInbox] = useState([]);
  const [thread, setThread] = useState(null);
  const [draft, setDraft] = useState('');
  const [query, setQuery] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    mentorRequest('/api/v1/mentor/messages').then(setInbox).catch((err) => setError(err.message));
  }, [student_usn]);

  useEffect(() => {
    if (!student_usn) {
      setThread(null);
      return undefined;
    }
    let stop = false;
    const load = async () => {
      try {
        const json = await mentorRequest(`/api/v1/mentor/messages/${student_usn}`);
        if (!stop) setThread(json);
      } catch (err) {
        if (!stop) setError(err.message);
      }
    };
    load();
    const timer = setInterval(load, 4000);
    return () => {
      stop = true;
      clearInterval(timer);
    };
  }, [student_usn]);

  const send = async (event) => {
    event.preventDefault();
    if (!draft.trim()) return;
    await mentorRequest(`/api/v1/mentor/messages/${student_usn}`, {
      method: 'POST',
      body: JSON.stringify({ content: draft }),
    });
    setDraft('');
    setThread(await mentorRequest(`/api/v1/mentor/messages/${student_usn}`));
    setInbox(await mentorRequest('/api/v1/mentor/messages'));
  };

  const people = inbox.filter((row) => `${row.name} ${row.usn}`.toLowerCase().includes(query.toLowerCase()));

  return (
    <div className="mentor-page">
      <h1>Mentee chat</h1>
      <p className="mentor-muted">Messages go to the mentee’s Mentor page. This is separate from their assistant.</p>
      {error && <p className="mentor-error">{error}</p>}
      <div className="mentor-chat" style={{ marginTop: 16 }}>
        <div className="mentor-chat-list">
          <div style={{ padding: 12 }}>
            <input className="mentor-input" placeholder="Search mentees" value={query} onChange={(e) => setQuery(e.target.value)} />
          </div>
          {people.map((row) => (
            <Link key={row.usn} className={row.usn === student_usn ? 'active' : undefined} to={`/mentor/${mentor_id}/chat/${row.usn}`}>
              <strong>{row.name}</strong>
              <div className="mentor-muted">{row.preview || 'No messages yet'}</div>
            </Link>
          ))}
          {people.length === 0 && <p className="mentor-muted" style={{ padding: 12 }}>No mentees found.</p>}
        </div>
        {thread ? (
          <section className="mentor-thread">
            <div style={{ padding: 14, borderBottom: '1px solid #e2e8f0' }}>
              <strong>{thread.name}</strong>
              <div className="mentor-muted">{thread.usn}</div>
            </div>
            <div className="mentor-bubbles">
              {(thread.messages || []).length === 0 && <p className="mentor-muted">Start the conversation.</p>}
              {(thread.messages || []).map((message) => (
                <div key={message.id} className={`mentor-bubble${message.sender === 'mentor' ? ' mine' : ''}`}>{message.content}</div>
              ))}
            </div>
            <form className="mentor-composer" onSubmit={send}>
              <input className="mentor-input" style={{ flex: 1 }} value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="Write a message" />
              <button className="mentor-btn" type="submit">Send</button>
            </form>
          </section>
        ) : (
          <section className="mentor-thread" style={{ alignItems: 'center', justifyContent: 'center' }}>
            <p className="mentor-muted">Choose a mentee.</p>
          </section>
        )}
      </div>
    </div>
  );
}
