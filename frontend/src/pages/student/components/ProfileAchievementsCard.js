import React from 'react';
import { Award, CheckCircle2 } from 'lucide-react';

export default function ProfileAchievementsCard({ achievements = [] }) {
  return (
    <div className="tracker-profile-achievements-card">
      <div className="tracker-profile-card-head">
        <Award size={22} strokeWidth={1.8} aria-hidden />
        <h2>Recent Achievements</h2>
      </div>
      <div className="tracker-profile-achievements-grid">
        {achievements.map((a) => {
          const completed = (a.status || '').toLowerCase() === 'completed' || a.status === 'Completed';
          return (
            <div key={a.title} className="tracker-profile-achievement-item">
              <div
                className={`tracker-profile-achievement-icon${completed ? ' completed' : ' progress'}`}
              >
                <CheckCircle2 size={23} strokeWidth={1.8} aria-hidden />
              </div>
              <div className="tracker-profile-achievement-body">
                <h3>{a.title}</h3>
                <p>{a.date}</p>
                {a.tag ? <span className="tracker-profile-achievement-tag">{a.tag}</span> : null}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
