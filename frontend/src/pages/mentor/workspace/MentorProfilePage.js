import React, { useEffect, useState } from 'react';
import { mentorFile, mentorRequest } from './mentorApi';

const GROUPS = ['certificate', 'academic', 'career', 'activity', 'uncategorised'];

function Fact({ label, value }) {
  if (value == null || value === '') return null;
  return <div className="mentor-stat"><span>{label}</span><strong>{value}</strong></div>;
}

export default function MentorProfilePage() {
  const [data, setData] = useState(null);
  const [activities, setActivities] = useState([]);
  const [tab, setTab] = useState('overview');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [draft, setDraft] = useState({ title: '', bio: '' });

  const load = async () => {
    const [profile, documents, meetingRows, activityRows] = await Promise.all([
      mentorRequest('/api/v1/mentor/profile'),
      mentorRequest('/api/v1/mentor/documents'),
      mentorRequest('/api/v1/mentor/meetings'),
      mentorRequest('/api/v1/mentor/activities'),
    ]);
    setData(profile);
    setDocs(documents);
    setMeetings(meetingRows);
    setActivities(activityRows);
    setDraft({ title: profile.profile.title || '', bio: profile.profile.bio || '' });
  };

  useEffect(() => {
    load().catch((err) => setError(err.message));
  }, []);

  const profile = data?.profile;

  const save = async (event) => {
    event.preventDefault();
    await mentorRequest('/api/v1/mentor/profile', { method: 'PATCH', body: JSON.stringify(draft) });
    setNotice('Profile saved.');
    await load();
  };

  const upload = async (event) => {
    const files = Array.from(event.target.files || []);
    event.target.value = '';
    if (!files.length) return;
    setNotice('Reading documents…');
    const body = new FormData();
    files.forEach((file) => body.append('files', file));
    await mentorRequest('/api/v1/mentor/documents', { method: 'POST', body });
    setNotice('Documents added. Skills and profile details that were printed are now on this page.');
    await load();
  };

  const recategorise = async (row, doc_group) => {
    await mentorRequest(`/api/v1/mentor/documents/${row.id}`, {
      method: 'PATCH',
      body: JSON.stringify({ doc_group, category: doc_group }),
    });
    await load();
  };

  if (!profile) {
    return <div className="mentor-page">{error ? <p className="mentor-error">{error}</p> : <p>Loading profile…</p>}</div>;
  }

  return (
    <div className="mentor-page">
      <div className="mentor-card">
        <h1>{profile.name}</h1>
        <p className="mentor-muted">{profile.title || profile.department} · {profile.email}</p>
        <p>{profile.bio}</p>
      </div>
      {error && <p className="mentor-error">{error}</p>}
      {notice && <p>{notice}</p>}
      <div className="mentor-tabs" style={{ marginTop: 16 }}>
        {['overview', 'mentees', 'schedule', 'activity', 'documents'].map((item) => (
          <button key={item} type="button" className={`mentor-btn-ghost${tab === item ? ' active' : ''}`} onClick={() => setTab(item)}>
            {item[0].toUpperCase() + item.slice(1)}
          </button>
        ))}
      </div>
      {tab === 'overview' && (
        <div className="mentor-grid">
          <section className="mentor-card">
            <h2>About</h2>
            <form className="mentor-form" onSubmit={save}>
              <input className="mentor-input" placeholder="Title" value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} />
              <textarea className="mentor-textarea" placeholder="Bio" value={draft.bio} onChange={(e) => setDraft({ ...draft, bio: e.target.value })} />
              <button className="mentor-btn" type="submit">Save</button>
            </form>
            <h3>Expertise</h3>
            <div className="mentor-pills">
              {(profile.expertise || []).length === 0 && <span className="mentor-muted">No skills yet. Upload a certificate or resume.</span>}
              {(profile.expertise || []).map((skill) => <span className="mentor-pill" key={skill}>{skill}</span>)}
            </div>
            <h3>Education</h3>
            <ul>{(profile.education || []).map((item, index) => <li key={index}>{item.degree} · {item.institution} {item.year || ''}</li>)}</ul>
            <h3>Experience</h3>
            <ul>{(profile.experience || []).map((item, index) => <li key={index}>{item.role}{item.org ? ` · ${item.org}` : ''}</li>)}</ul>
            <h3>Awards</h3>
            <ul>{(profile.awards || []).map((item, index) => <li key={index}>{item.name || item} {item.year || ''}</li>)}</ul>
          </section>
          <section>
            <div className="mentor-stats">
              <Fact label="Mentees" value={data.students.length} />
              <Fact label="Meetings" value={data.sessions} />
              <Fact label="Average score" value={data.average_score == null ? '—' : data.average_score} />
            </div>
          </section>
        </div>
      )}
      {tab === 'mentees' && (
        <table className="mentor-table">
          <thead><tr><th>Name</th><th>Programme</th><th>Documents</th><th>Activities</th><th>Score</th></tr></thead>
          <tbody>
            {data.students.map((student) => (
              <tr key={student.usn}>
                <td>{student.name}<br /><small>{student.usn}</small></td>
                <td>{student.program || '—'}</td>
                <td>{student.documents}</td>
                <td>{student.activities}</td>
                <td>{student.score == null ? '—' : student.score}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {tab === 'schedule' && (
        <table className="mentor-table">
          <thead><tr><th>Mentee</th><th>Agenda</th><th>When</th><th>Place</th></tr></thead>
          <tbody>
            {meetings.filter((row) => row.meeting_date && new Date(row.meeting_date).getTime() >= Date.now() && row.status !== 'cancelled').map((row) => (
              <tr key={row.meeting_id}>
                <td>{row.student_name}</td>
                <td>{row.title}</td>
                <td>{row.meeting_date.replace('T', ' ').slice(0, 16)}</td>
                <td>{row.venue}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {tab === 'activity' && (
        <table className="mentor-table">
          <thead><tr><th>Mentee</th><th>Title</th><th>Status</th><th>Remarks</th></tr></thead>
          <tbody>
            {activities.map((row) => (
              <tr key={row.id}>
                <td>{row.student_name}</td>
                <td>{row.title}</td>
                <td>{row.status_tag || row.status}</td>
                <td>{row.mentor_remarks || '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {tab === 'documents' && (
        <section className="mentor-card">
          <h2>Documents</h2>
          <p className="mentor-muted">Upload a resume, certificate, or record. A matching filename replaces the previous file. Printed skills, education, awards, and experience are added to your profile.</p>
          <input type="file" multiple onChange={upload} />
          <table className="mentor-table" style={{ marginTop: 16 }}>
            <thead><tr><th>File</th><th>Group</th><th>Status</th><th></th></tr></thead>
            <tbody>
              {docs.map((row) => (
                <tr key={row.id}>
                  <td>{row.filename}<br /><small>{row.summary}</small></td>
                  <td>
                    <select className="mentor-select" value={row.doc_group} onChange={(e) => recategorise(row, e.target.value)}>
                      {GROUPS.map((group) => <option key={group} value={group}>{group}</option>)}
                    </select>
                  </td>
                  <td>{row.status}</td>
                  <td><button type="button" className="mentor-btn-ghost" onClick={() => mentorFile(`/api/v1/mentor/documents/${row.id}/file`)}>View</button></td>
                </tr>
              ))}
            </tbody>
          </table>
          {docs.length === 0 && <p className="mentor-muted">No documents yet.</p>}
        </section>
      )}
    </div>
  );
}
