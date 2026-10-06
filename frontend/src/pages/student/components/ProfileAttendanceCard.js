import React from 'react';
import { CalendarDays } from 'lucide-react';

export default function ProfileAttendanceCard({ items = [] }) {
  return (
    <section className="tracker-profile-acad-card tracker-profile-attendance-card">
      <div className="tracker-profile-acad-card-head">
        <CalendarDays size={22} strokeWidth={1.8} aria-hidden />
        <h2>Attendance History</h2>
      </div>
      <div className="tracker-profile-attendance-list">
        {items.map((item) => {
          const absent = (item.status || '').toLowerCase() === 'absent';
          return (
            <div
              key={`${item.title}-${item.date}`}
              className={`tracker-profile-attendance-item${absent ? ' absent' : ''}`}
            >
              <div>
                <strong>{item.title}</strong>
                <small>
                  {item.date}
                  {item.time ? ` • ${item.time}` : ''}
                </small>
              </div>
              <span className="tracker-profile-attendance-status">{item.status}</span>
            </div>
          );
        })}
      </div>
    </section>
  );
}
