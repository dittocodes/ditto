import React from 'react';
import { FaCheck, FaLock } from 'react-icons/fa';

export default function TrackerPathwayTimeline({ phases = [] }) {
  return (
    <div className="tracker-pathway">
      {phases.map((p, idx) => {
        const status = p.status || 'locked';
        const isLast = idx === phases.length - 1;
        return (
          <div key={p.title} className={`tracker-pathway-item status-${status}`}>
            <div className="tracker-pathway-rail">
              <div className="tracker-pathway-dot">
                {status === 'completed' && <FaCheck />}
                {status === 'locked' && <FaLock />}
              </div>
              {!isLast && <div className="tracker-pathway-line" />}
            </div>
            <div className="tracker-pathway-card">
              <div className="tracker-pathway-card-head">
                <strong>{p.title}</strong>
                <span className="tracker-pathway-duration">{p.duration}</span>
              </div>
              {p.subtitle && <p className="tracker-pathway-sub">{p.subtitle}</p>}
              {(p.skills || []).length > 0 && (
                <div className="tracker-skill-pills">
                  {p.skills.map((s) => (
                    <span key={s} className={`tracker-skill-pill status-${status}`}>{s}</span>
                  ))}
                </div>
              )}
              {status === 'active' && (
                <>
                  <div className="tracker-stat-bar" style={{ marginTop: 10 }}>
                    <div className="tracker-stat-bar-fill" style={{ width: `${p.progress_pct || 0}%` }} />
                  </div>
                  <div className="tracker-pathway-progress-meta">
                    <span>Progress: {p.progress_pct || 0}%</span>
                    {p.est_completion && <span>Est. completion: {p.est_completion}</span>}
                  </div>
                </>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
