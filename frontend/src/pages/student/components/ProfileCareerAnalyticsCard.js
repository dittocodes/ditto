import React from 'react';
import {
  Award,
  BarChart3,
  CalendarCheck,
  Clock3,
  Target,
  TrendingUp,
} from 'lucide-react';
import { getUid } from '../../../services/studentV1Api';
import TrackerFileUpload from './TrackerFileUpload';

function toneClass(tone) {
  const t = (tone || 'blue').toLowerCase();
  if (t === 'green' || t === 'purple' || t === 'orange') return t;
  return 'blue';
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

function normalizeIndicators(career) {
  if (Array.isArray(career.performance_indicators) && career.performance_indicators.length) {
    return career.performance_indicators;
  }
  if (Array.isArray(career.indicators) && career.indicators.length) {
    return career.indicators.map((ind) => ({
      label: ind.label || ind.value || '',
      tone: ind.tone || 'blue',
    }));
  }
  return [];
}

export default function ProfileCareerAnalyticsCard({ career, uploadFn }) {
  const c = career || {};
  const analytics = c.analytics || {};
  const skills = c.skill_breakdown || [];
  const indicators = normalizeIndicators(c);
  const achievements = c.achievements_semester || [];
  const recent = c.recent_activity || [];
  const growth = normalizeGrowthAnalysis(c.growth_analysis);

  return (
    <section className="tracker-profile-acad-card tracker-profile-career-analytics-card">
      <div className="tracker-profile-acad-card-head">
        <Award size={22} strokeWidth={1.8} aria-hidden />
        <h2>Skills Assessment</h2>
      </div>

      <div className="tracker-profile-career-analytics-box">
        <div className="tracker-profile-career-analytics-intro">
          <TrendingUp size={22} strokeWidth={1.8} aria-hidden />
          <div>
            <h3>{analytics.title || 'Analytics Report'}</h3>
            <p>{analytics.subtitle || 'Summary of your performance metrics'}</p>
          </div>
        </div>

        <div className="tracker-profile-career-metrics">
          <div className="tracker-profile-career-metric">
            <span>Activities</span>
            <strong>{analytics.activities?.value}</strong>
            <b>{analytics.activities?.trend}</b>
          </div>
          <div className="tracker-profile-career-metric">
            <span>Meetings</span>
            <strong>{analytics.meetings?.value}</strong>
            <b>{analytics.meetings?.trend}</b>
          </div>
        </div>

        <h4 className="tracker-profile-career-subhead">
          <BarChart3 size={18} aria-hidden />
          Skill Breakdown
        </h4>
        <div className="tracker-profile-career-skills">
          {skills.map((s) => {
            const pct = s.pct ?? s.score ?? 0;
            return (
              <div key={s.name} className="tracker-profile-career-skill">
                <div className="tracker-profile-career-skill-labels">
                  <strong>{s.name}</strong>
                  <span>{pct}%</span>
                </div>
                <div className="tracker-profile-career-skill-track">
                  <div style={{ width: `${pct}%` }} />
                </div>
              </div>
            );
          })}
        </div>

        <h4 className="tracker-profile-career-subhead">
          <Target size={18} aria-hidden />
          Performance Indicators
        </h4>
        <div className="tracker-profile-career-indicators">
          {indicators.map((ind) => (
            <span
              key={ind.label}
              className={`tracker-profile-career-indicator ${toneClass(ind.tone)}`}
            >
              {ind.label}
            </span>
          ))}
        </div>

        <h4 className="tracker-profile-career-subhead">
          <Award size={18} aria-hidden />
          Achievements This Semester
        </h4>
        <div className="tracker-profile-career-achievement-rows">
          {achievements.map((row) => {
            const done = String(row.status || '').toLowerCase().includes('complete');
            return (
              <div key={row.title} className="tracker-profile-career-achievement-row">
                <span>{row.title}</span>
                <b className={done ? 'completed' : 'in-progress'}>{row.status}</b>
              </div>
            );
          })}
        </div>

        <h4 className="tracker-profile-career-subhead">
          <CalendarCheck size={18} aria-hidden />
          Recent Activity
        </h4>
        <div className="tracker-profile-career-recent">
          {recent.map((row) => (
            <div key={`${row.title}-${row.when}`} className="tracker-profile-career-activity-row">
              <Clock3 size={18} aria-hidden />
              <div>
                <strong>{row.title}</strong>
                <span>{row.when}</span>
              </div>
            </div>
          ))}
        </div>

        <h4 className="tracker-profile-career-subhead">
          <TrendingUp size={18} aria-hidden />
          Growth Analysis
        </h4>
        <div className="tracker-profile-career-growth">
          {growth.map((g) => (
            <div key={g.label} className="tracker-profile-career-growth-item">
              <span>{g.label}</span>
              <strong>+{g.pct}% ↑</strong>
            </div>
          ))}
        </div>
      </div>

      {uploadFn ? (
        <div className="tracker-profile-career-upload">
          <TrackerFileUpload
            label="Upload résumé / portfolio"
            accept=".pdf,image/*"
            uploadFn={async (file) => {
              const uid = await getUid();
              return uploadFn(uid, file);
            }}
          />
        </div>
      ) : null}
    </section>
  );
}
