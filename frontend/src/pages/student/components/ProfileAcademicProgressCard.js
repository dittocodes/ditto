import React from 'react';
import { Award, Clock3 } from 'lucide-react';
import ProfileGpaChart from './ProfileGpaChart';

export default function ProfileAcademicProgressCard({ academic, honors = [] }) {
  const a = academic || {};

  return (
    <section className="tracker-profile-acad-card tracker-profile-progress-card">
      <div className="tracker-profile-acad-card-head">
        <Clock3 size={22} strokeWidth={1.8} aria-hidden />
        <h2>Academic Progress</h2>
      </div>
      <div className="tracker-profile-progress-body">
        <ProfileGpaChart gpaTrend={a.gpa_trend} creditProgress={a.credit_progress} />

        <div className="tracker-profile-honors-block">
          <h3>Academic Honors & Recognition</h3>
          {honors.map((h) => (
            <div key={h.title} className="tracker-profile-honor-row">
              <Award size={21} strokeWidth={1.8} aria-hidden />
              <div>
                <strong>{h.title}</strong>
                <span>{h.term}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
