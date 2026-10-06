import React from 'react';
import { Link } from 'react-router-dom';
import { Award, Medal, Shield } from 'lucide-react';

const BADGE_ICONS = {
  Expert: Medal,
  Verified: Shield,
  Mentor: Award,
};

function normalizeBadge(b) {
  if (typeof b === 'string') {
    const tone = b === 'Verified' ? 'green' : b === 'Mentor' ? 'purple' : 'blue';
    return { label: b, tone };
  }
  return b;
}

export default function ProfileCompetencyCard({ competency, studentUsn }) {
  const c = competency || {};
  const skills = c.skills || [];
  const badges = (c.badges || []).map(normalizeBadge);
  const score = c.score ?? 4.8;
  const stars = '★'.repeat(Math.min(5, Math.max(1, c.stars || Math.round(score))));

  return (
    <section className="tracker-profile-acad-card tracker-profile-competency-card">
      <div className="tracker-profile-competency-head">
        <div className="tracker-profile-acad-card-head no-border">
          <Shield size={22} strokeWidth={1.8} aria-hidden />
          <h2>Competency Rating</h2>
        </div>
        <div className="tracker-profile-competency-score">
          <span className="tracker-profile-competency-number">{score}/5.0</span>
          <span className="tracker-profile-competency-stars" aria-hidden>
            {stars}
          </span>
        </div>
      </div>

      <div className="tracker-profile-competency-skills">
        {skills.map((s) => (
          <div key={s.name} className="tracker-profile-competency-skill">
            <div className="tracker-profile-competency-skill-label">
              <span>{s.name}</span>
              <strong>{s.score}/5.0</strong>
            </div>
            <div className="tracker-profile-competency-track">
              <div style={{ width: `${(Number(s.score) / 5) * 100}%` }} />
            </div>
          </div>
        ))}
      </div>

      <div className="tracker-profile-competency-badges-title">
        <Award size={20} aria-hidden />
        <strong>Competency Badges</strong>
      </div>
      <div className="tracker-profile-competency-badges">
        {badges.map((b) => {
          const Icon = BADGE_ICONS[b.label] || Award;
          return (
            <div key={b.label} className={`tracker-profile-comp-badge ${b.tone || 'blue'}`}>
              <div className="tracker-profile-comp-badge-icon">
                <Icon size={21} aria-hidden />
              </div>
              <span>{b.label}</span>
            </div>
          );
        })}
      </div>

      <Link to={`/student/${studentUsn}/analysis`} className="tracker-profile-competency-link">
        View Detailed Assessment
      </Link>
    </section>
  );
}
