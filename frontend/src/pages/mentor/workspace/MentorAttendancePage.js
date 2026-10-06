import React, { useEffect, useMemo, useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import * as XLSX from 'xlsx';
import { mentorRequest } from './mentorApi';

export default function MentorAttendancePage() {
  const [data, setData] = useState({ students: [], sessions: [], marks: {} });
  const [sessionId, setSessionId] = useState('');
  const [name, setName] = useState('');
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState('all');
  const [view, setView] = useState('manual');

  const load = async () => {
    const json = await mentorRequest('/api/v1/mentor/attendance');
    setData(json);
    setSessionId((current) => current || json.sessions?.[0]?.session_id || '');
  };

  useEffect(() => {
    load().catch((err) => setError(err.message));
  }, []);

  const session = data.sessions.find((row) => row.session_id === sessionId);
  const marks = data.marks?.[sessionId] || {};
  const rows = useMemo(() => data.students.filter((student) => {
    const status = marks[student.usn]?.status || 'unmarked';
    if (filter !== 'all' && status !== filter) return false;
    return `${student.name} ${student.usn}`.toLowerCase().includes(query.toLowerCase());
  }), [data.students, marks, filter, query]);

  const present = data.students.filter((student) => marks[student.usn]?.status === 'present').length;
  const absent = data.students.filter((student) => marks[student.usn]?.status === 'absent').length;

  const mark = async (usn, status) => {
    await mentorRequest('/api/v1/mentor/attendance/mark', {
      method: 'POST',
      body: JSON.stringify({ session_id: sessionId, student_usn: usn, status }),
    });
    await load();
  };

  const create = async (event) => {
    event.preventDefault();
    const created = await mentorRequest('/api/v1/mentor/attendance/sessions', {
      method: 'POST',
      body: JSON.stringify({ session_name: name }),
    });
    setName('');
    await load();
    setSessionId(created.session_id);
  };

  const download = () => {
    const sheet = XLSX.utils.json_to_sheet(data.students.map((student) => ({
      Name: student.name,
      USN: student.usn,
      Status: marks[student.usn]?.status || 'unmarked',
      Method: marks[student.usn]?.method || '',
      Session: session?.session_name || '',
    })));
    const book = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(book, sheet, 'Attendance');
    XLSX.writeFile(book, 'mentor-attendance.xlsx');
  };

  return (
    <div className="mentor-page">
      <div className="mentor-row">
        <div>
          <h1>Mentee attendance</h1>
          <p className="mentor-muted">Marks are the same records the mentee sees.</p>
        </div>
        <button type="button" className="mentor-btn-ghost" onClick={download}>Export Excel</button>
      </div>
      {error && <p className="mentor-error">{error}</p>}
      <form className="mentor-actions" onSubmit={create}>
        <input className="mentor-input" placeholder="New session name" value={name} onChange={(e) => setName(e.target.value)} required />
        <button className="mentor-btn" type="submit">Create session</button>
        <select className="mentor-select" value={sessionId} onChange={(e) => setSessionId(e.target.value)}>
          <option value="">Choose session</option>
          {data.sessions.map((row) => <option key={row.session_id} value={row.session_id}>{row.session_name}</option>)}
        </select>
      </form>
      <div className="mentor-stats">
        <div className="mentor-stat"><span>Total mentees</span><strong>{data.students.length}</strong></div>
        <div className="mentor-stat"><span>Present</span><strong>{present}</strong></div>
        <div className="mentor-stat"><span>Absent</span><strong>{absent}</strong></div>
        <div className="mentor-stat"><span>Unmarked</span><strong>{Math.max(data.students.length - present - absent, 0)}</strong></div>
      </div>
      <div className="mentor-tabs">
        <button type="button" className={`mentor-btn-ghost${view === 'manual' ? ' active' : ''}`} onClick={() => setView('manual')}>Manual marking</button>
        <button type="button" className={`mentor-btn-ghost${view === 'qr' ? ' active' : ''}`} onClick={() => setView('qr')}>QR attendance</button>
      </div>
      {view === 'qr' && session && (
        <section className="mentor-card" style={{ marginBottom: 16, textAlign: 'center' }}>
          <h2>Session QR</h2>
          <QRCodeSVG value={session.qr_code_data} size={180} />
          <p className="mentor-muted">{session.session_name}</p>
        </section>
      )}
      {view === 'manual' && (
        <>
      <div className="mentor-filters" style={{ marginBottom: 12 }}>
        <input className="mentor-input" placeholder="Search mentee or USN" value={query} onChange={(e) => setQuery(e.target.value)} />
        <select className="mentor-select" value={filter} onChange={(e) => setFilter(e.target.value)}>
          <option value="all">All statuses</option>
          <option value="present">Present</option>
          <option value="absent">Absent</option>
          <option value="unmarked">Unmarked</option>
        </select>
        <button
          type="button"
          className="mentor-btn-ghost"
          disabled={!sessionId}
          onClick={async () => {
            for (const student of data.students) {
              await mentorRequest('/api/v1/mentor/attendance/mark', {
                method: 'POST',
                body: JSON.stringify({ session_id: sessionId, student_usn: student.usn, status: 'present' }),
              });
            }
            await load();
          }}
        >
          Mark all present
        </button>
      </div>
      <table className="mentor-table">
        <thead><tr><th>Mentee</th><th>USN</th><th>Status</th><th>Method</th><th></th></tr></thead>
        <tbody>
          {rows.map((student) => {
            const status = marks[student.usn]?.status || 'unmarked';
            return (
              <tr key={student.usn}>
                <td>{student.name}</td>
                <td>{student.usn}</td>
                <td>{status}</td>
                <td>{marks[student.usn]?.method || '—'}</td>
                <td className="mentor-actions">
                  <button type="button" className="mentor-btn-ghost" disabled={!sessionId} onClick={() => mark(student.usn, 'present')}>Present</button>
                  <button type="button" className="mentor-btn-ghost" disabled={!sessionId} onClick={() => mark(student.usn, 'absent')}>Absent</button>
                  <button type="button" className="mentor-btn-ghost" disabled={!sessionId} onClick={() => mark(student.usn, 'unmarked')}>Reset</button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
        </>
      )}
    </div>
  );
}
