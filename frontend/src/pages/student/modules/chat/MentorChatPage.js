import React, { useEffect, useState } from 'react';
import { apiGet, apiPost } from '../../../../services/studentV1Api';
import '../../../mentor/workspace/mentorWorkspace.css';

export default function MentorChatPage() {
  const [data, setData] = useState({ mentor_name: '', messages: [] });
  const [draft, setDraft] = useState('');
  const [error, setError] = useState('');

  const load = async () => {
    setData(await apiGet('/api/v1/students/me/mentor-chat'));
  };

  useEffect(() => {
    let stop = false;
    const tick = async () => {
      try {
        const json = await apiGet('/api/v1/students/me/mentor-chat');
        if (!stop) setData(json);
      } catch (err) {
        if (!stop) setError(err.message);
      }
    };
    tick();
    const timer = setInterval(tick, 4000);
    return () => {
      stop = true;
      clearInterval(timer);
    };
  }, []);

  const send = async (event) => {
    event.preventDefault();
    if (!draft.trim()) return;
    try {
      await apiPost('/api/v1/students/me/mentor-chat', { content: draft });
      setDraft('');
      await load();
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <div className="mentor-page" style={{ maxWidth: 760 }}>
      <h1>Mentor</h1>
      <p className="mentor-muted">{data.mentor_name ? `Conversation with ${data.mentor_name}` : 'No mentor is assigned yet.'}</p>
      {error && <p className="mentor-error">{error}</p>}
      <div className="mentor-bubbles" style={{ minHeight: 320, borderRadius: 14 }}>
        {(data.messages || []).length === 0 && <p className="mentor-muted">No messages yet.</p>}
        {(data.messages || []).map((message) => (
          <div key={message.id} className={`mentor-bubble${message.sender === 'student' ? ' mine' : ''}`}>{message.content}</div>
        ))}
      </div>
      {data.mentor_name && (
        <form className="mentor-composer" onSubmit={send}>
          <input className="mentor-input" style={{ flex: 1 }} value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="Message your mentor" />
          <button className="mentor-btn" type="submit">Send</button>
        </form>
      )}
    </div>
  );
}
