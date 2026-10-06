import React from 'react';
import {
  Award,
  BarChart3,
  Calendar,
  Clock3,
  Target,
  TrendingUp,
} from 'lucide-react';

function SidebarSection({ icon: Icon, title, children }) {
  return (
    <section className="tracker-analytics-section">
      <div className="tracker-analytics-section-head">
        <span className="tracker-analytics-section-icon" aria-hidden>
          <Icon size={16} strokeWidth={2} />
        </span>
        <span>{title}</span>
      </div>
      <div className="tracker-analytics-section-body">{children}</div>
    </section>
  );
}

function formatTrend(trend) {
  if (!trend) return '';
  if (trend.includes('↑')) return trend;
  return `↑ ${trend.replace(/^\+/, '+')}`;
}

function normalizeGrowthAnalysis(raw) {
  if (Array.isArray(raw) && raw.length) {
    return raw.map((g) => ({
      label: g.label || 'Growth',
      pct: Number(g.pct ?? g.growth_pct ?? 0),
    }));
  }
  if (raw && typeof raw === 'object') {
    if (raw.label != null && raw.pct != null) {
      return [{ label: raw.label, pct: Number(raw.pct) }];
    }
    return [
      { label: 'Technical Growth', pct: Number(raw.skills_pct ?? 42) },
      { label: 'Soft Skills', pct: Number(raw.meetings_pct ?? 23) },
    ];
  }
  return [
    { label: 'Technical Growth', pct: 42 },
    { label: 'Soft Skills', pct: 23 },
  ];
}

export default function AnalyticsReportSidebar({ sidebar, className = '' }) {
  const s = sidebar || {};
  const growthRows = normalizeGrowthAnalysis(s.growth_analysis);

  return (
    <aside className={`tracker-analytics-report ${className}`.trim()}>
      <div className="tracker-analytics-report-head">
        <span className="tracker-analytics-report-icon" aria-hidden>
          <TrendingUp size={22} strokeWidth={2} />
        </span>
        <div>
          <h3>{s.title || 'Analytics Report'}</h3>
          <p>{s.subtitle || 'Summary of your performance metrics'}</p>
        </div>
      </div>

      <div className="tracker-analytics-stat-row">
        <div className="tracker-analytics-stat-box">
          <span className="tracker-analytics-stat-label">Activities</span>
          <strong>{s.activities?.value || '—'}</strong>
          <div className="tracker-analytics-stat-trend">{formatTrend(s.activities?.trend)}</div>
        </div>
        <div className="tracker-analytics-stat-box">
          <span className="tracker-analytics-stat-label">Meetings</span>
          <strong>{s.meetings?.value || '—'}</strong>
          <div className="tracker-analytics-stat-trend">{formatTrend(s.meetings?.trend)}</div>
        </div>
      </div>

      <SidebarSection icon={BarChart3} title="Skill Breakdown">
        {(s.skill_breakdown || []).map((skill) => (
          <div key={skill.name} className="tracker-analytics-skill-row">
            <div className="tracker-analytics-skill-row-top">
              <span>{skill.name}</span>
              <span>
                {skill.pct}
                %
              </span>
            </div>
            <div className="tracker-analytics-skill-bar">
              <div className="tracker-analytics-skill-bar-fill" style={{ width: `${skill.pct}%` }} />
            </div>
          </div>
        ))}
      </SidebarSection>

      <SidebarSection icon={Target} title="Performance Indicators">
        <div className="tracker-analytics-badges">
          {(s.badges || []).map((b) => (
            <span key={b.label} className={`tracker-analytics-badge ${b.tone}`}>
              {b.label}
            </span>
          ))}
        </div>
      </SidebarSection>

      <SidebarSection icon={Award} title="Achievements This Semester">
        {(s.achievements_semester || []).map((a) => (
          <div key={a.title} className="tracker-analytics-achievement">
            <span>{a.title}</span>
            <span className={`tracker-analytics-status ${a.status === 'Completed' ? 'completed' : 'progress'}`}>
              {a.status}
            </span>
          </div>
        ))}
      </SidebarSection>

      <SidebarSection icon={Calendar} title="Recent Activity">
        {(s.recent_activity || []).map((r) => (
          <div key={`${r.title}-${r.when}`} className="tracker-analytics-activity-item">
            <span className="tracker-analytics-activity-icon" aria-hidden>
              <Clock3 size={14} strokeWidth={2} />
            </span>
            <div>
              <strong>{r.title}</strong>
              <small>{r.when}</small>
            </div>
          </div>
        ))}
      </SidebarSection>

      <SidebarSection icon={TrendingUp} title="Growth Analysis">
        <div className="tracker-analytics-growth-grid">
          {growthRows.map((g) => (
            <div key={g.label} className="tracker-analytics-growth-card">
              <span>{g.label}</span>
              <strong>
                +
                {g.pct}
                % ↑
              </strong>
            </div>
          ))}
        </div>
      </SidebarSection>
    </aside>
  );
}
