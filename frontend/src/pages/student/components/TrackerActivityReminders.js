import React from 'react';
import { FaBell } from 'react-icons/fa';

export default function TrackerActivityReminders({ reminders, onCta }) {
  const r = reminders || {};
  return (
    <div className="tracker-card tracker-reminders-card">
      <div className="tracker-reminders-head">
        <FaBell aria-hidden />
        <h3>Activity Reminders</h3>
      </div>
      <p className="tracker-reminders-message">{r.message || 'Stay on track with your activities and meetings.'}</p>
      <div className="tracker-reminders-stats">
        <span><strong>{r.upcoming_meetings ?? 0}</strong> upcoming meetings</span>
        <span><strong>{r.pending_activities ?? 0}</strong> pending activities</span>
      </div>
      <button type="button" className="tracker-btn-primary" onClick={onCta}>
        {r.cta_label || 'Set Reminders'}
      </button>
    </div>
  );
}
