import React, { useEffect, useMemo, useState } from 'react';
import * as XLSX from 'xlsx';
import { mentorRequest } from './mentorApi';

export default function MentorMeetings() {
  const [rows, setRows] = useState([]);
  const [students, setStudents] = useState([]);
  const [tab, setTab] = useState('upcoming');
  const [query, setQuery] = useState('');
  const [error, setError] = useState('');
  const [form, setForm] = useState({ student_usn: '', meeting_date: '', venue: '', agenda: '', meeting_mode: 'offline' });

  const load = async () => {
    const [meetings, home] = await Promise.all([
      mentorRequest('/api/v1/mentor/meetings'),
      mentorRequest('/api/v1/mentor/home'),
    ]);
    setRows(meetings);
    setStudents(home.students || []);
  };

  useEffect(() => {
    load().catch((err) => setError(err.message));
  }, []);

  const now = Date.now();
  const visible = useMemo(() => rows.filter((row) => {
    const time = row.meeting_date ? new Date(row.meeting_date).getTime() : 0;
    const upcoming = time >= now && row.status !== 'cancelled';
    if (tab === 'upcoming' && !upcoming) return false;
    if (tab === 'history' && upcoming) return false;
    return `${row.title} ${row.student_name} ${row.venue}`.toLowerCase().includes(query.toLowerCase());
  }), [rows, tab, query, now]);

  const create = async (event) => {
    event.preventDefault();
    setError('');
    try {
      await mentorRequest('/api/v1/mentor/meetings', {
        method: 'POST',
        body: JSON.stringify({
          student_usns: [form.student_usn],
          meeting_date: form.meeting_date,
          venue: form.venue,
          agenda: form.agenda,
          meeting_mode: form.meeting_mode,
        }),
      });
      setForm({ student_usn: '', meeting_date: '', venue: '', agenda: '', meeting_mode: 'offline' });
      await load();
    } catch (err) {
      setError(err.message);
    }
  };

  const setStatus = async (row, status) => {
    await mentorRequest(`/api/v1/mentor/meetings/${row.meeting_id}`, {
      method: 'PATCH',
      body: JSON.stringify({ status }),
    });
    await load();
  };

  const upcomingCount = rows.filter((row) => {
    const time = row.meeting_date ? new Date(row.meeting_date).getTime() : 0;
    return time >= Date.now() && row.status !== 'cancelled';
  }).length;

  const download = () => {
    const sheet = XLSX.utils.json_to_sheet(visible.map((row) => ({
      Student: row.student_name,
      Title: row.title,
      When: row.meeting_date,
      Venue: row.venue,
      Status: row.status,
    })));
    const book = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(book, sheet, 'Meetings');
    XLSX.writeFile(book, 'mentor-meetings.xlsx');
  };

  return (
    <div className="mentor-page">
      <div className="mentor-row">
        <div>
          <h1>Meetings</h1>
          <p className="mentor-muted">Scheduled meetings appear on each mentee’s meetings page.</p>
        </div>
        <button type="button" className="mentor-btn-ghost" onClick={download}>Export Excel</button>
      </div>
      {error && <p className="mentor-error">{error}</p>}
      <div className="mentor-stats">
        <div className="mentor-stat"><span>Upcoming</span><strong>{upcomingCount}</strong></div>
        <div className="mentor-stat"><span>History</span><strong>{Math.max(rows.length - upcomingCount, 0)}</strong></div>
        <div className="mentor-stat"><span>Online</span><strong>{rows.filter((row) => row.meeting_mode === 'online').length}</strong></div>
        <div className="mentor-stat"><span>Mentees</span><strong>{students.length}</strong></div>
      </div>
      <form className="mentor-card mentor-form" onSubmit={create}>
        <strong>Schedule a meeting</strong>
        <select className="mentor-select" required value={form.student_usn} onChange={(e) => setForm({ ...form, student_usn: e.target.value })}>
          <option value="">Choose mentee</option>
          {students.map((student) => <option key={student.usn} value={student.usn}>{student.name}</option>)}
        </select>
        <input className="mentor-input" type="datetime-local" required value={form.meeting_date} onChange={(e) => setForm({ ...form, meeting_date: e.target.value })} />
        <input className="mentor-input" placeholder="Agenda" value={form.agenda} onChange={(e) => setForm({ ...form, agenda: e.target.value })} />
        <div className="mentor-actions">
          <select className="mentor-select" value={form.meeting_mode} onChange={(e) => setForm({ ...form, meeting_mode: e.target.value })}>
            <option value="offline">Offline</option>
            <option value="online">Online</option>
          </select>
          <input className="mentor-input" placeholder={form.meeting_mode === 'online' ? 'Link or leave as Online' : 'Venue'} value={form.venue} onChange={(e) => setForm({ ...form, venue: e.target.value })} />
          <button className="mentor-btn" type="submit">Schedule</button>
        </div>
      </form>
      <div className="mentor-tabs" style={{ marginTop: 16 }}>
        <button type="button" className={`mentor-btn-ghost${tab === 'upcoming' ? ' active' : ''}`} onClick={() => setTab('upcoming')}>Upcoming</button>
        <button type="button" className={`mentor-btn-ghost${tab === 'history' ? ' active' : ''}`} onClick={() => setTab('history')}>History</button>
        <input className="mentor-input" placeholder="Search" value={query} onChange={(e) => setQuery(e.target.value)} />
      </div>
      <table className="mentor-table">
        <thead><tr><th>Mentee</th><th>Agenda</th><th>When</th><th>Place</th><th>Status</th></tr></thead>
        <tbody>
          {visible.map((row) => (
            <tr key={row.meeting_id}>
              <td>{row.student_name}</td>
              <td>{row.title}</td>
              <td>{row.meeting_date?.replace('T', ' ').slice(0, 16)}</td>
              <td>{row.venue}</td>
              <td className="mentor-actions">
                <span>{row.status || '—'}</span>
                <button type="button" className="mentor-btn-ghost" onClick={() => setStatus(row, 'completed')}>Done</button>
                <button type="button" className="mentor-btn-ghost" onClick={() => setStatus(row, 'cancelled')}>Cancel</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {visible.length === 0 && <p className="mentor-muted">No meetings in this list.</p>}
    </div>
  );
}
