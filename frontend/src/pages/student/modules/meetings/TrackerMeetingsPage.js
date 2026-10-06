import React, { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { CalendarCheck, CheckCircle2, Globe2, UserPlus } from 'lucide-react';
import { API_BASE_URL } from '../../../../api';
import { cancelMeeting, getUid, joinMeeting, uploadMeetingSummary } from '../../../../services/studentV1Api';
import TrackerMeetingCard from '../../components/TrackerMeetingCard';
import TrackerMeetingsWidget from '../../components/TrackerMeetingsWidget';

function toIcsDate(d) {
  const dt = new Date(d);
  const pad = (n) => String(n).padStart(2, '0');
  return `${dt.getUTCFullYear()}${pad(dt.getUTCMonth() + 1)}${pad(dt.getUTCDate())}T${pad(dt.getUTCHours())}${pad(dt.getUTCMinutes())}${pad(dt.getUTCSeconds())}Z`;
}

function downloadCalendarEvent(meeting) {
  const start = toIcsDate(meeting.meeting_date);
  const mins = meeting.duration_mins || 60;
  const end = toIcsDate(new Date(new Date(meeting.meeting_date).getTime() + mins * 60 * 1000));
  const ics = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Mentee Tracker//EN',
    'BEGIN:VEVENT',
    `UID:meeting-${meeting.meeting_id}@mentee-tracker`,
    `DTSTAMP:${start}`,
    `DTSTART:${start}`,
    `DTEND:${end}`,
    `SUMMARY:${meeting.title || `Mentor meeting #${meeting.meeting_id}`}`,
    `LOCATION:${meeting.venue || 'TBD'}`,
    'END:VEVENT',
    'END:VCALENDAR',
  ].join('\r\n');
  const blob = new Blob([ics], { type: 'text/calendar;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `meeting-${meeting.meeting_id}.ics`;
  a.click();
  URL.revokeObjectURL(url);
}

function normalizeMeeting(m) {
  return {
    ...m,
    title: m.title || m.subject || 'Mentor meeting',
    mentor_name: m.mentor_name || m.mentor_id || 'Mentor',
    venue: m.venue || m.location || 'TBD',
    duration_mins: m.duration_mins || m.duration || 45,
  };
}

function todayDateKey() {
  const n = new Date();
  const pad = (x) => String(x).padStart(2, '0');
  return `${n.getFullYear()}-${pad(n.getMonth() + 1)}-${pad(n.getDate())}`;
}

export default function TrackerMeetingsPage() {
  const { student_usn } = useParams();
  const [meetings, setMeetings] = useState([]);
  const [error, setError] = useState('');
  const [joinMsg, setJoinMsg] = useState('');
  const [busyId, setBusyId] = useState(null);
  const [meetTab, setMeetTab] = useState('upcoming');
  const [selectedCalKey, setSelectedCalKey] = useState(todayDateKey);

  const loadMeetings = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/student/${student_usn}/meetings`);
      if (!response.ok) throw new Error('Failed to fetch meetings');
      const data = await response.json();
      setMeetings((data.meetings || []).map(normalizeMeeting));
      setError('');
    } catch {
      setError('Could not load meetings.');
    }
  };

  useEffect(() => {
    loadMeetings();
  }, [student_usn]);

  const onJoinLiveKit = async (meetingId) => {
    try {
      setJoinMsg('');
      const { token, url } = await joinMeeting(meetingId);
      if (url && token) {
        setJoinMsg(`LiveKit room ready. Open ${url} with token (configure LIVEKIT_URL in .env).`);
      } else {
        setJoinMsg('Join token issued. Set LIVEKIT_URL in backend .env for video.');
      }
    } catch (e) {
      setJoinMsg(e.message || 'Join failed');
    }
  };

  const onCancel = async (meetingId) => {
    if (!window.confirm('Cancel this meeting?')) return;
    setBusyId(meetingId);
    try {
      await cancelMeeting(meetingId);
      await loadMeetings();
    } catch (e) {
      setJoinMsg(e.message || 'Cancel failed');
    } finally {
      setBusyId(null);
    }
  };

  const onUploadTranscript = async (meetingId, file) => {
    setBusyId(meetingId);
    try {
      const uid = await getUid();
      await uploadMeetingSummary(uid, meetingId, file);
      setJoinMsg('Transcript uploaded. Watch the processing banner for job status.');
    } finally {
      setBusyId(null);
    }
  };

  const upcoming = meetings.filter((m) => ['approved', 'scheduled', 'pending'].includes((m.status || '').toLowerCase()));
  const completed = meetings.filter((m) => (m.status || '').toLowerCase() === 'completed');
  const cancelled = meetings.filter((m) => (m.status || '').toLowerCase() === 'cancelled');
  const shown = meetTab === 'upcoming'
    ? [...upcoming].sort((a, b) => new Date(a.meeting_date) - new Date(b.meeting_date))
    : [...completed].sort((a, b) => new Date(b.meeting_date) - new Date(a.meeting_date));
  const calDates = meetings.map((m) => m.meeting_date).filter(Boolean);

  const meetingsOnDay = useMemo(() => {
    if (!selectedCalKey) return [];
    return meetings.filter((m) => {
      if (!m.meeting_date) return false;
      const d = new Date(m.meeting_date);
      const pad = (n) => String(n).padStart(2, '0');
      const key = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
      return key === selectedCalKey;
    });
  }, [meetings, selectedCalKey]);

  const pickerDate = useMemo(() => {
    if (selectedCalKey) {
      const [y, mo, da] = selectedCalKey.split('-').map(Number);
      return new Date(y, mo - 1, da);
    }
    return new Date();
  }, [selectedCalKey]);

  return (
    <div className="tracker-meetings-page">
      <header className="tracker-meetings-page-header">
        <div>
          <h1 className="tracker-meetings-page-title">
            <Globe2 size={26} strokeWidth={1.8} aria-hidden />
            Meetings &amp; Appointments
          </h1>
          <p className="tracker-meetings-page-sub">Schedule and manage your mentor meetings</p>
        </div>
      </header>

      {error && <div className="tracker-card tracker-meetings-alert error">{error}</div>}
      {joinMsg && <div className="tracker-card tracker-meetings-alert">{joinMsg}</div>}

      <div className="tracker-meetings-layout">
        <section className="tracker-meetings-main-panel">
          <div className="tracker-meeting-tabs">
            <button
              type="button"
              className={`tracker-meeting-tab${meetTab === 'upcoming' ? ' active' : ''}`}
              onClick={() => setMeetTab('upcoming')}
            >
              <CalendarCheck size={18} aria-hidden />
              Upcoming Meetings
            </button>
            <button
              type="button"
              className={`tracker-meeting-tab${meetTab === 'completed' ? ' active' : ''}`}
              onClick={() => setMeetTab('completed')}
            >
              <CheckCircle2 size={18} aria-hidden />
              Completed Meetings
            </button>
          </div>

          <div className="tracker-meetings-list">
            {shown.length === 0 && (
              <div className="tracker-meetings-list-empty">No {meetTab} meetings.</div>
            )}
            {shown.map((m) => (
              <TrackerMeetingCard
                key={m.meeting_id}
                meeting={m}
                onJoin={() => onJoinLiveKit(m.meeting_id)}
                onCalendar={() => downloadCalendarEvent(m)}
                onCancel={() => onCancel(m.meeting_id)}
                onUploadTranscript={onUploadTranscript}
                busy={busyId === m.meeting_id}
                showCancel={meetTab === 'upcoming'}
              />
            ))}
          </div>
        </section>

        <aside className="tracker-meetings-sidebar">
          <div className="tracker-meetings-request-card">
            <div className="tracker-meetings-sidebar-head">
              <Globe2 size={20} aria-hidden />
              <strong>Request Appointment</strong>
            </div>
            <p>Schedule a meeting with a mentor based on your availability.</p>
            <Link to={`/student/${student_usn}/appointments`} className="tracker-meetings-request-btn">
              <UserPlus size={18} aria-hidden />
              New Appointment Request
            </Link>
          </div>

          <div className="tracker-meetings-calendar-card">
            <TrackerMeetingsWidget
              upcoming={upcoming.length}
              completed={completed.length}
              cancelled={cancelled.length}
              eventDates={calDates}
              selectedDayKey={selectedCalKey}
              onDaySelect={setSelectedCalKey}
              meetingsOnSelectedDay={meetingsOnDay}
              pickerDate={pickerDate}
            />
          </div>
        </aside>
      </div>
    </div>
  );
}
