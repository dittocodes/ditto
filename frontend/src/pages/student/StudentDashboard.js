import React from 'react';
import { Outlet } from 'react-router-dom';
import StudentTrackerShell from './StudentTrackerShell';

/** Set VITE_TRACKER_UI=legacy in `.env.local` to render routes without the Tracker shell. */
const trackerMode = import.meta.env.VITE_TRACKER_UI ?? 'tracker';

const StudentDashboard = () => {
  if (trackerMode === 'legacy') {
    return <Outlet />;
  }
  return <StudentTrackerShell />;
};

export default StudentDashboard;
