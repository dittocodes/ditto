import React, { useEffect, useMemo, useState } from 'react';
import * as XLSX from 'xlsx';
import { mentorRequest } from './mentorApi';

export default function MentorActivities() {
  const [rows, setRows] = useState([]);
  const [students, setStudents] = useState([]);
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState('all');
  const [term, setTerm] = useState('all');
  const [page, setPage] = useState(1);
  const [error, setError] = useState('');
  const [form, setForm] = useState({ student_usn: '', title: '', description: '', term: 'short-term', due_date: '' });

  const load = async () => {
    const [activities, home] = await Promise.all([
      mentorRequest('/api/v1/mentor/activities'),
      mentorRequest('/api/v1/mentor/home'),
    ]);
    setRows(activities);
    setStudents(home.students || []);
  };

  useEffect(() => {
    load().catch((err) => setError(err.message));
  }, []);

  const visible = useMemo(() => rows.filter((row) => {
    if (status !== 'all' && row.status !== status) return false;
    if (term !== 'all' && (row.term || '') !== term) return false;
    const hay = `${row.title} ${row.student_name} ${row.usn}`.toLowerCase();
    return hay.includes(query.toLowerCase());
  }), [rows, query, status, term]);
  const pageCount = Math.max(1, Math.ceil(visible.length / 10));
  const currentPage = Math.min(page, pageCount);
  const pageRows = visible.slice((currentPage - 1) * 10, currentPage * 10);

  const create = async (event) => {
    event.preventDefault();
    setError('');
    try {
      await mentorRequest('/api/v1/mentor/activities', { method: 'POST', body: JSON.stringify(form) });
      setForm({ student_usn: '', title: '', description: '', term: 'short-term', due_date: '' });
      await load();
    } catch (err) {
      setError(err.message);
    }
  };

  const update = async (row, patch) => {
    await mentorRequest(`/api/v1/mentor/activities/${row.id}`, { method: 'PATCH', body: JSON.stringify(patch) });
    await load();
  };

  const download = () => {
    const sheet = XLSX.utils.json_to_sheet(visible.map((row) => ({
      Student: row.student_name,
      USN: row.usn,
      Title: row.title,
      Term: row.term_tag || row.term || '',
      Status: row.status_tag || row.status,
      Progress: row.progress_pct ?? '',
    })));
    const book = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(book, sheet, 'Activities');
    XLSX.writeFile(book, 'mentor-activities.xlsx');
  };

  return (
    <div className="mentor-page">
      <div className="mentor-row">
        <div>
          <h1>Activities</h1>
          <p className="mentor-muted">Assignments for your mentees. They see the same list on their tracker.</p>
        </div>
        <button type="button" className="mentor-btn-ghost" onClick={download}>Export Excel</button>
      </div>
      {error && <p className="mentor-error">{error}</p>}
      <form className="mentor-card mentor-form" onSubmit={create}>
        <strong>Add activity</strong>
        <select className="mentor-select" value={form.student_usn} onChange={(e) => setForm({ ...form, student_usn: e.target.value })} required>
          <option value="">Choose mentee</option>
          {students.map((student) => <option key={student.usn} value={student.usn}>{student.name}</option>)}
        </select>
        <input className="mentor-input" placeholder="Title" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} required />
        <input className="mentor-input" placeholder="Details" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
        <div className="mentor-actions">
          <select className="mentor-select" value={form.term} onChange={(e) => setForm({ ...form, term: e.target.value })}>
            <option value="short-term">Short term</option>
            <option value="mid-term">Mid term</option>
            <option value="long-term">Long term</option>
          </select>
          <input className="mentor-input" type="date" value={form.due_date} onChange={(e) => setForm({ ...form, due_date: e.target.value })} />
          <button className="mentor-btn" type="submit">Add activity</button>
        </div>
      </form>
      <div className="mentor-filters" style={{ margin: '16px 0' }}>
        <input className="mentor-input" placeholder="Search" value={query} onChange={(e) => setQuery(e.target.value)} />
        <select className="mentor-select" value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="all">All statuses</option>
          <option value="pending">Pending</option>
          <option value="in_progress">In progress</option>
          <option value="completed">Completed</option>
          <option value="overdue">Overdue</option>
        </select>
        <select className="mentor-select" value={term} onChange={(e) => setTerm(e.target.value)}>
          <option value="all">All terms</option>
          <option value="short-term">Short term</option>
          <option value="mid-term">Mid term</option>
          <option value="long-term">Long term</option>
        </select>
      </div>
      <table className="mentor-table">
        <thead>
          <tr><th>Mentee</th><th>Title</th><th>Term</th><th>Status</th><th>Remarks</th></tr>
        </thead>
        <tbody>
          {pageRows.map((row) => (
            <tr key={row.id}>
              <td>{row.student_name}<br /><small>{row.usn}</small></td>
              <td>{row.title}</td>
              <td>{row.term_tag || '—'}</td>
              <td>
                <select className="mentor-select" value={row.status} onChange={(e) => update(row, { status: e.target.value })}>
                  <option value="pending">Pending</option>
                  <option value="in_progress">In progress</option>
                  <option value="completed">Completed</option>
                  <option value="overdue">Overdue</option>
                </select>
              </td>
              <td>
                <input
                  className="mentor-input"
                  defaultValue={row.mentor_remarks || ''}
                  onBlur={(e) => {
                    if (e.target.value !== (row.mentor_remarks || '')) update(row, { mentor_remarks: e.target.value });
                  }}
                />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {visible.length === 0 && <p className="mentor-muted">No activities match.</p>}
      {pageCount > 1 && (
        <div className="mentor-actions" style={{ marginTop: 12 }}>
          <button type="button" className="mentor-btn-ghost" disabled={currentPage <= 1} onClick={() => setPage(currentPage - 1)}>Previous</button>
          <span>Page {currentPage} of {pageCount}</span>
          <button type="button" className="mentor-btn-ghost" disabled={currentPage >= pageCount} onClick={() => setPage(currentPage + 1)}>Next</button>
        </div>
      )}
    </div>
  );
}
