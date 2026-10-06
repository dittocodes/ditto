import React from 'react';
import { BarChart3, Bookmark } from 'lucide-react';
import ProfileSkillsAssessment from '../../components/ProfileSkillsAssessment';

const SWOT_TABS = [
  { id: 'S', label: 'Strengths' },
  { id: 'W', label: 'Weaknesses' },
  { id: 'O', label: 'Opportunities' },
  { id: 'T', label: 'Threats' },
];

export default function AnalysisTabSkills({ data, swotTab, setSwotTab }) {
  const swot = data.swot || {};
  const items = data.swot_tabs?.[swotTab] || [];
  const mentorRecs = data.mentor_recommendations || swot.mentor_recommendations || [];
  const metrics = data.key_metrics || [];
  const skills = data.skill_assessment || [];
  const recommendations = data.recommendations || [];

  return (
    <div className="tracker-analysis-skills-layout">
      <section className="tracker-analysis-swot-card">
        <div className="tracker-analysis-swot-head">
          <h2>SWOT Analysis</h2>
          <span className="tracker-analysis-swot-updated">Updated: {swot.updated}</span>
        </div>

        <div className="tracker-analysis-swot-tabs">
          {SWOT_TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              className={`tracker-analysis-swot-tab${swotTab === t.id ? ' active' : ''}`}
              onClick={() => setSwotTab(t.id)}
            >
              {t.label}
            </button>
          ))}
        </div>

        <ul className="tracker-analysis-swot-list">
          {items.length ? items.map((item) => (
            <li key={String(item)}>{String(item)}</li>
          )) : (
            <li className="tracker-analysis-swot-empty">No items for this section yet.</li>
          )}
        </ul>

        <div className="tracker-analysis-mentor-box">
          <div className="tracker-analysis-mentor-title">Mentor Recommendations</div>
          <ul className="tracker-analysis-mentor-list">
            {mentorRecs.map((rec) => (
              <li key={rec} className="tracker-analysis-mentor-item">
                {rec}
              </li>
            ))}
          </ul>
        </div>
      </section>

      <div className="tracker-analysis-skills-right">
        <section className="tracker-analysis-metrics-card">
          <div className="tracker-analysis-metrics-head">
            <h2>Key Metrics</h2>
            <BarChart3 size={21} strokeWidth={1.8} className="tracker-analysis-metrics-icon" aria-hidden />
          </div>
          {metrics.map((m) => (
            <div key={m.label} className="tracker-analysis-metric-row">
              <div className="tracker-analysis-metric-labels">
                <span>{m.label}</span>
                <strong>{m.pct}%</strong>
              </div>
              <div className="tracker-analysis-metric-track">
                <div className="tracker-analysis-metric-fill" style={{ width: `${m.pct}%` }} />
              </div>
            </div>
          ))}
        </section>

        <div className="tracker-analysis-skills-assessment-wrap">
          <ProfileSkillsAssessment skills={skills} className="tracker-analysis-skills-chart-card" />
        </div>

        <section className="tracker-analysis-recs-card">
          <div className="tracker-analysis-recs-head">
            <h2>Recommendations</h2>
            <Bookmark size={21} strokeWidth={1.8} className="tracker-analysis-recs-icon" aria-hidden />
          </div>
          <div className="tracker-analysis-recs-list">
            {recommendations.map((text) => (
              <div key={text} className="tracker-analysis-rec-item">
                {text}
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
