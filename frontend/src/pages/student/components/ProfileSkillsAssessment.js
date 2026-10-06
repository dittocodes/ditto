import React, { useState } from 'react';
import { Activity, BarChart2, LineChart, PieChart } from 'lucide-react';

function SkillLabel({ name }) {
  if (name === 'Data Analysis') {
    return (
      <>
        <span>Data</span>
        <span>Analysis</span>
      </>
    );
  }
  if (name === 'Database Design') {
    return (
      <>
        <span>Database</span>
        <span>Design</span>
      </>
    );
  }
  if (name === 'Web Development') {
    return (
      <>
        <span>Web</span>
        <span>Development</span>
      </>
    );
  }
  return <span>{name}</span>;
}

function HorizontalSkillsChart({ skills }) {
  return (
    <div className="tracker-profile-skills-chart">
      <div className="tracker-profile-skills-labels">
        {skills.map((s) => (
          <div key={s.name} className="tracker-profile-skill-label">
            <SkillLabel name={s.name} />
          </div>
        ))}
      </div>
      <div className="tracker-profile-skills-plot">
        <div className="tracker-profile-skills-grid-lines" aria-hidden>
          <div />
          <div />
          <div />
          <div />
          <div />
        </div>
        <div className="tracker-profile-skills-bars">
          {skills.map((s) => (
            <div key={s.name} className="tracker-profile-skill-bar-row">
              <div className="tracker-profile-skill-bar" style={{ width: `${s.pct ?? s.score ?? 0}%` }} />
              <span className="tracker-profile-skill-pct">{s.pct ?? s.score ?? 0}%</span>
            </div>
          ))}
        </div>
        <div className="tracker-profile-skills-axis">
          <span>0</span>
          <span>25</span>
          <span>50</span>
          <span>75</span>
          <span>100</span>
        </div>
      </div>
    </div>
  );
}

function AltChart({ type, skills }) {
  if (!skills.length) {
    return <p className="tracker-profile-empty">No skills recorded yet.</p>;
  }
  if (type === 'line') {
    const points = skills.map((s, i) => {
      const x = skills.length === 1 ? 400 : 20 + (i * 700) / (skills.length - 1);
      const y = 280 - ((Number(s.pct ?? s.score) || 0) / 100) * 240;
      return `${x},${y}`;
    }).join(' ');
    return (
      <div className="tracker-profile-alt-chart line">
        <svg viewBox="0 0 800 300" preserveAspectRatio="none">
          <polyline points={points} fill="none" stroke="#3587c9" strokeWidth="5" />
        </svg>
      </div>
    );
  }
  if (type === 'pie') {
    const avg = Math.round(
      skills.reduce((sum, s) => sum + (Number(s.pct ?? s.score) || 0), 0) / skills.length,
    );
    return (
      <div className="tracker-profile-alt-chart pie">
        <div className="tracker-profile-pie-ring">
          <div className="tracker-profile-pie-inner">{avg}%</div>
        </div>
      </div>
    );
  }
  if (type === 'activity') {
    return (
      <div className="tracker-profile-alt-chart activity">
        {skills.map((s) => (
          <div key={s.name} className="tracker-profile-activity-col">
            <div style={{ height: `${Number(s.pct ?? s.score) || 0}%` }} />
          </div>
        ))}
      </div>
    );
  }
  return <HorizontalSkillsChart skills={skills} />;
}

const CHART_BUTTONS = [
  { type: 'bar', icon: BarChart2 },
  { type: 'line', icon: LineChart },
  { type: 'pie', icon: PieChart },
  { type: 'activity', icon: Activity },
];

export default function ProfileSkillsAssessment({ skills = [], attained = [], className = '' }) {
  const [chartType, setChartType] = useState('bar');
  const items = skills.length ? skills : [];
  const rootClass = ['tracker-profile-skills-card', className].filter(Boolean).join(' ');

  return (
    <div className={rootClass}>
      <div className="tracker-profile-skills-head">
        <h2>Skills Assessment</h2>
        <div className="tracker-profile-chart-controls">
          {CHART_BUTTONS.map(({ type, icon: Icon }) => (
            <button
              key={type}
              type="button"
              className={`tracker-profile-chart-btn${chartType === type ? ' active' : ''}`}
              onClick={() => setChartType(type)}
              aria-label={type}
            >
              <Icon size={20} strokeWidth={1.7} aria-hidden />
            </button>
          ))}
        </div>
      </div>
      <AltChart type={chartType} skills={items} />
      {attained.length > 0 && (
        <ul className="tracker-attained-skills">
          {attained.map((skill) => (
            <li key={skill.name}>
              <span>{skill.name}</span>
              <span>{skill.certificate || skill.name}</span>
              <span>{skill.completed_on || 'Date not printed'}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
