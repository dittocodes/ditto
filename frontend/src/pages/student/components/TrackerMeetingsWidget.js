import React, { useMemo, useState } from 'react';
import { Globe2, Users } from 'lucide-react';
import TrackerMiniCalendar from './TrackerMiniCalendar';

function formatDayLabel(d = new Date()) {
  return d.toLocaleDateString('en-GB', { weekday: 'long', month: 'long', day: 'numeric' });
}

function formatDatePickerValue(d = new Date()) {
  const day = d.getDate();
  const suffix =
    day % 10 === 1 && day !== 11
      ? 'st'
      : day % 10 === 2 && day !== 12
        ? 'nd'
        : day % 10 === 3 && day !== 13
          ? 'rd'
          : 'th';
  const month = d.toLocaleDateString('en-US', { month: 'long' });
  return `${month} ${day}${suffix}, ${d.getFullYear()}`;
}

export default function TrackerMeetingsWidget({
  upcoming = 0,
  completed = 0,
  cancelled = 0,
  eventDates = [],
  onDaySelect,
  selectedDayKey,
  meetingsOnSelectedDay = null,
  pickerDate,
}) {
  const [internalKey, setInternalKey] = useState(null);
  const dayKey = selectedDayKey !== undefined ? selectedDayKey : internalKey;
  const setDayKey = onDaySelect || setInternalKey;
  const todayLabel = formatDayLabel(new Date());
  const pickerLabel = formatDatePickerValue(pickerDate || new Date());

  const emptyMessage = useMemo(() => {
    if (meetingsOnSelectedDay && meetingsOnSelectedDay.length) {
      return null;
    }
    return 'No meetings scheduled for this date';
  }, [meetingsOnSelectedDay]);

  return (
    <div className="tracker-meetings-widget">
      <div className="tracker-meetings-widget-head">
        <span className="tracker-meetings-widget-title">
          <Globe2 size={18} aria-hidden />
          Meetings Calendar
        </span>
        <span className="tracker-meetings-today-pill">{todayLabel}</span>
      </div>

      <div className="tracker-meetings-date-picker">
        <CalendarIcon />
        <span>{pickerLabel}</span>
      </div>

      <TrackerMiniCalendar
        eventDates={eventDates}
        onDayClick={setDayKey}
        selectedDayKey={dayKey}
      />

      <div className="tracker-meetings-legend">
        <span><i className="dot upcoming" /> Upcoming</span>
        <span><i className="dot completed" /> Completed</span>
        <span><i className="dot cancelled" /> Cancelled</span>
      </div>

      {emptyMessage ? (
        <p className="tracker-meetings-empty">{emptyMessage}</p>
      ) : (
        <ul className="tracker-meetings-day-list">
          {(meetingsOnSelectedDay || []).map((m) => (
            <li key={m.meeting_id}>{m.title || m.subject}</li>
          ))}
        </ul>
      )}

      <div className="tracker-meetings-stats-panel">
        <div className="tracker-meetings-stats-head">
          <Users size={18} aria-hidden />
          <span>Meeting Statistics</span>
        </div>
        <div className="tracker-meetings-stats-grid">
          <div className="tracker-meetings-stat-box">
            <strong>{upcoming}</strong>
            <span>Upcoming</span>
          </div>
          <div className="tracker-meetings-stat-box">
            <strong>{completed}</strong>
            <span>Completed</span>
          </div>
        </div>
      </div>
    </div>
  );
}

function CalendarIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
      <rect x="3" y="5" width="18" height="16" rx="2" stroke="currentColor" strokeWidth="2" />
      <path d="M3 10h18M8 3v4M16 3v4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}
