import React, { useRef, useState } from 'react';
import {
  Calendar,
  CalendarPlus,
  Clock,
  FileUp,
  MapPin,
  User,
  Video,
  XCircle,
} from 'lucide-react';

function formatDate(d) {
  if (!d) return '—';
  try {
    return new Date(d).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  } catch {
    return String(d);
  }
}

function formatTime(d, durationMins) {
  if (!d) return '—';
  try {
    const dt = new Date(d);
    const time = dt.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false });
    const mins = durationMins || 45;
    return `${time} (${mins} mins)`;
  } catch {
    return String(d);
  }
}

export default function TrackerMeetingCard({
  meeting,
  onJoin,
  onCalendar,
  onCancel,
  onUploadTranscript,
  busy,
  showCancel = true,
}) {
  const title = meeting.title || meeting.subject || `Meeting #${meeting.meeting_id}`;
  const status = (meeting.status || '').toLowerCase();
  const isUpcoming = ['approved', 'scheduled', 'pending'].includes(status);
  const pill = isUpcoming ? 'Upcoming' : status === 'completed' ? 'Completed' : status;
  const venueRaw = (meeting.venue || meeting.location || 'TBD').trim();
  const isOnlineVenue = venueRaw.toLowerCase() === 'online';
  const meetingOnline =
    (meeting.meeting_mode || '').toLowerCase() === 'online' || isOnlineVenue;
  const venueLabel = isOnlineVenue ? 'Online' : venueRaw;
  const canJoin =
    meeting.can_join !== false
    && isUpcoming
    && (meeting.google_meet_link || meetingOnline);
  const fileRef = useRef(null);
  const [uploadMsg, setUploadMsg] = useState('');

  const onFile = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file || !onUploadTranscript) return;
    setUploadMsg('');
    try {
      await onUploadTranscript(meeting.meeting_id, file);
      setUploadMsg('Transcript uploaded — processing started');
    } catch (err) {
      setUploadMsg(err.message || 'Upload failed');
    }
  };

  return (
    <article className="tracker-meeting-card">
      <div className="tracker-meeting-card-inner">
        <div className="tracker-meeting-card-main">
          <div className="tracker-meeting-card-head">
            <h3>{title}</h3>
            <span className={`tracker-meeting-status-pill${isUpcoming ? ' upcoming' : ''}`}>
              <Clock size={14} aria-hidden />
              {pill}
            </span>
          </div>
          <ul className="tracker-meeting-meta">
            <li className="tracker-meeting-meta-icon">
              <Calendar size={16} aria-hidden />
              {formatDate(meeting.meeting_date)}
            </li>
            <li className="tracker-meeting-meta-icon">
              <Clock size={16} aria-hidden />
              {formatTime(meeting.meeting_date, meeting.duration_mins)}
            </li>
            <li className="tracker-meeting-meta-icon">
              {isOnlineVenue ? <Video size={16} aria-hidden /> : <MapPin size={16} aria-hidden />}
              {venueLabel}
            </li>
            <li className="tracker-meeting-meta-icon">
              <User size={16} aria-hidden />
              {meeting.mentor_name || meeting.mentor || 'Mentor'}
            </li>
          </ul>
          {uploadMsg ? <p className="tracker-activity-action-msg">{uploadMsg}</p> : null}
        </div>
        <div className="tracker-meeting-actions">
          {isUpcoming && meeting.google_meet_link ? (
            <a
              href={meeting.google_meet_link}
              target="_blank"
              rel="noreferrer"
              className="tracker-meeting-btn primary"
            >
              <Video size={16} aria-hidden />
              Join Meeting
            </a>
          ) : null}
          {isUpcoming && !meeting.google_meet_link && canJoin && onJoin ? (
            <button type="button" className="tracker-meeting-btn primary" onClick={onJoin}>
              <Video size={16} aria-hidden />
              Join Meeting
            </button>
          ) : null}
          {onCalendar && (
            <button type="button" className="tracker-meeting-btn outline" onClick={onCalendar}>
              <CalendarPlus size={16} aria-hidden />
              Add to Calendar
            </button>
          )}
          {onUploadTranscript ? (
            <>
              <input
                ref={fileRef}
                type="file"
                accept=".txt,.pdf,.md,.doc,.docx"
                hidden
                onChange={onFile}
              />
              <button
                type="button"
                className="tracker-meeting-btn outline"
                disabled={busy}
                onClick={() => fileRef.current?.click()}
              >
                <FileUp size={16} aria-hidden />
                Upload Transcript
              </button>
            </>
          ) : null}
          {showCancel && isUpcoming && onCancel && (
            <button type="button" className="tracker-meeting-btn danger" disabled={busy} onClick={onCancel}>
              <XCircle size={16} aria-hidden />
              Cancel Meeting
            </button>
          )}
        </div>
      </div>
    </article>
  );
}
