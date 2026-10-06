import React from 'react';
import { BriefcaseBusiness, CheckCircle2 } from 'lucide-react';

export default function ProfileCareerProfileCard({ career }) {
  const c = career || {};
  const experience = c.experience || [];
  const mentor = c.mentor || {};

  return (
    <section className="tracker-profile-acad-card tracker-profile-career-profile-card">
      <div className="tracker-profile-acad-card-head">
        <BriefcaseBusiness size={22} strokeWidth={1.8} aria-hidden />
        <h2>Career Profile</h2>
      </div>

      <div className="tracker-profile-career-section">
        <h3>Career Goals</h3>
        <div className="tracker-profile-career-goal-box">{c.goals}</div>
      </div>

      <div className="tracker-profile-career-section">
        <h3>Experience</h3>
        <div className="tracker-profile-career-experience-list">
          {experience.map((e) => (
            <div key={`${e.title}-${e.org}`} className="tracker-profile-career-experience">
              <div className="tracker-profile-career-timeline" aria-hidden />
              <div>
                <strong>{e.title}</strong>
                <span className="tracker-profile-career-org">{e.org}{e.when ? ` · ${e.when}` : ''}</span>
                {(e.bullets || []).map((b) => (
                  <div key={b} className="tracker-profile-career-bullet">
                    <CheckCircle2 size={15} strokeWidth={2} aria-hidden />
                    <span>{b}</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="tracker-profile-career-section">
        <h3>Mentor</h3>
        <div className="tracker-profile-career-mentor">
          <div className="tracker-profile-career-mentor-avatar">{mentor.initials || 'MN'}</div>
          <div>
            <strong>{mentor.name}</strong>
            <span>{mentor.role_line}</span>
          </div>
        </div>
      </div>
    </section>
  );
}
