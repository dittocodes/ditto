import React, { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { mentorRequest } from './mentorApi';

function Score({ value }) {
  if (value == null) return '—';
  return Number(value).toFixed(1);
}

export default function MentorHome() {
  const { mentor_id } = useParams();
  const [data, setData] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let stop = false;
    const load = async () => {
      try {
        const json = await mentorRequest('/api/v1/mentor/home');
        if (!stop) {
          setData(json);
          setError('');
        }
      } catch (err) {
        if (!stop) setError(err.message);
      }
    };
    load();
    const timer = setInterval(load, 8000);
    return () => {
      stop = true;
      clearInterval(timer);
    };
  }, []);

  const counts = data?.counts || {};
  const total = counts.activities || 0;

  return (
    <div className="mentor-page">
      <div className="mentor-row">
        <div>
          <h1>Mentorship workspace</h1>
          <p className="mentor-muted">{data?.mentor_name ? `Welcome, ${data.mentor_name}` : 'Your assigned mentees'}</p>
        </div>
        <div className="mentor-actions">
          <Link className="mentor-btn" to={`/mentor/${mentor_id}/meetings`}>Schedule meeting</Link>
          <Link className="mentor-btn-ghost" to={`/mentor/${mentor_id}/activities`}>Add activity</Link>
          <Link className="mentor-btn-ghost" to={`/mentor/${mentor_id}/profile`}>Profile</Link>
        </div>
      </div>
      {error && <p className="mentor-error">{error}</p>}
      <div className="mentor-stats">
        <div className="mentor-stat"><span>Total mentees</span><strong>{counts.mentees ?? '—'}</strong></div>
        <div className="mentor-stat"><span>Activities</span><strong>{counts.activities ?? '—'}</strong></div>
        <div className="mentor-stat"><span>Upcoming meetings</span><strong>{counts.meetings ?? '—'}</strong></div>
        <div className="mentor-stat"><span>Activity completion</span><strong>{counts.completion == null ? '—' : `${counts.completion}%`}</strong></div>
      </div>
      <div className="mentor-grid">
        <section className="mentor-card">
          <h2>Activity status</h2>
          {total === 0 && <p className="mentor-muted">No activities yet.</p>}
          {Object.entries(data?.status_counts || {}).map(([status, count]) => (
            <div key={status} style={{ marginTop: 12 }}>
              <div className="mentor-row" style={{ marginBottom: 6 }}>
                <span>{status.replaceAll('_', ' ')}</span>
                <span>{count}</span>
              </div>
              <div className="mentor-progress"><span style={{ width: `${Math.round((count / total) * 100)}%` }} /></div>
            </div>
          ))}
        </section>
        <section className="mentor-card">
          <h2>By term</h2>
          {Object.keys(data?.term_counts || {}).length === 0 && <p className="mentor-muted">No terms recorded yet.</p>}
          {Object.entries(data?.term_counts || {}).map(([term, count]) => (
            <div key={term} style={{ marginTop: 12 }}>
              <div className="mentor-row" style={{ marginBottom: 6 }}>
                <span>{term === 'unset' ? 'No term' : term}</span>
                <span>{count}</span>
              </div>
              <div className="mentor-progress"><span style={{ width: `${total ? Math.round((count / total) * 100) : 0}%` }} /></div>
            </div>
          ))}
        </section>
      </div>
      <div className="mentor-grid">
        <section className="mentor-card">
          <h2>This week</h2>
          {(data?.week || []).length === 0 && <p className="mentor-muted">Nothing scheduled in the next seven days.</p>}
          <ul>
            {(data?.week || []).map((row) => (
              <li key={row.meeting_id}>{row.meeting_date?.replace('T', ' ').slice(0, 16)} · {row.student_name} · {row.title}</li>
            ))}
          </ul>
        </section>
        <section className="mentor-card">
          <h2>Insights</h2>
          <ul>
            <li>Overdue activities: {data?.insights?.overdue ?? '—'}</li>
            <li>Mentees without a score yet: {data?.insights?.without_score ?? '—'}</li>
            <li>Upcoming meetings: {data?.insights?.upcoming ?? '—'}</li>
          </ul>
        </section>
      </div>
        <section className="mentor-card">
          <h2>Mentee progress</h2>
          {(data?.students || []).length === 0 && <p className="mentor-muted">No mentees are assigned yet.</p>}
          {(data?.students || []).map((student) => (
            <div key={student.usn} style={{ marginTop: 12 }}>
              <div className="mentor-row" style={{ marginBottom: 6 }}>
                <span>{student.name}</span>
                <span><Score value={student.score} /></span>
              </div>
              <div className="mentor-progress"><span style={{ width: `${student.score || 0}%` }} /></div>
            </div>
          ))}
        </section>
      <div className="mentor-grid">
        <section className="mentor-card">
          <h2>Recent activities</h2>
          {(data?.activities || []).length === 0 && <p className="mentor-muted">Nothing assigned yet.</p>}
          <ul>
            {(data?.activities || []).map((row) => (
              <li key={row.id}>{row.student_name}: {row.title}</li>
            ))}
          </ul>
        </section>
        <section className="mentor-card">
          <h2>Upcoming meetings</h2>
          {(data?.meetings || []).length === 0 && <p className="mentor-muted">No meetings scheduled.</p>}
          <ul>
            {(data?.meetings || []).map((row) => (
              <li key={row.meeting_id}>{row.student_name} · {row.title} · {row.meeting_date?.replace('T', ' ').slice(0, 16)}</li>
            ))}
          </ul>
        </section>
      </div>
    </div>
  );
}
