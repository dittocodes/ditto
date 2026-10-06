import React from 'react';

export default function TrackerWelcomeToast({ name, pendingActivities = 0, upcomingMeetings = 0, onDismiss }) {
  return (
    <div className="tracker-welcome-toast" role="status">
      <button type="button" className="tracker-welcome-toast-close" aria-label="Dismiss" onClick={onDismiss}>
        ×
      </button>
      <p>
        Welcome back,
        {' '}
        {name}
        ! You have
        {' '}
        {pendingActivities}
        {' '}
        pending activit
        {pendingActivities === 1 ? 'y' : 'ies'}
        {' '}
        and
        {' '}
        {upcomingMeetings}
        {' '}
        upcoming meeting
        {upcomingMeetings === 1 ? '' : 's'}
        .
      </p>
    </div>
  );
}
