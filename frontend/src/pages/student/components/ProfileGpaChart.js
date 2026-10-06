import React, { useState } from 'react';
import { Activity, BarChart2, LineChart, PieChart } from 'lucide-react';

const CHART_BTNS = [
  { type: 'bar', icon: BarChart2 },
  { type: 'line', icon: LineChart },
  { type: 'pie', icon: PieChart },
  { type: 'activity', icon: Activity },
];

export default function ProfileGpaChart({ gpaTrend = [], creditProgress }) {
  const [chartType, setChartType] = useState('bar');
  const [hover, setHover] = useState(null);
  const semesters = gpaTrend.length ? gpaTrend : [];
  const req = creditProgress?.required || { earned: 0, total: 0 };
  const elec = creditProgress?.elective || { earned: 0, total: 0 };
  const reqPct = req.total ? Math.min(100, (req.earned / req.total) * 100) : 0;
  const elecPct = elec.total ? Math.min(100, (elec.earned / elec.total) * 100) : 0;

  return (
    <div className="tracker-profile-gpa-panel">
      <div className="tracker-profile-gpa-panel-head">
        <h3>Semester GPA Trend</h3>
        <div className="tracker-profile-chart-controls">
          {CHART_BTNS.map(({ type, icon: Icon }) => (
            <button
              key={type}
              type="button"
              className={`tracker-profile-chart-btn${chartType === type ? ' active' : ''}`}
              onClick={() => setChartType(type)}
              aria-label={type}
            >
              <Icon size={19} strokeWidth={1.7} aria-hidden />
            </button>
          ))}
        </div>
      </div>

      {chartType === 'bar' ? (
        <div className="tracker-profile-gpa-chart">
          <div className="tracker-profile-gpa-y">
            {[4, 3, 2, 1, 0].map((n) => (
              <span key={n}>{n}</span>
            ))}
          </div>
          <div className="tracker-profile-gpa-plot">
            <div className="tracker-profile-gpa-grid" aria-hidden>
              <div />
              <div />
              <div />
              <div />
              <div />
            </div>
            <div className="tracker-profile-gpa-bars">
              {semesters.map((sem, index) => (
                <div key={sem.term} className="tracker-profile-gpa-bar-wrap">
                  {hover === index && (
                    <div className="tracker-profile-gpa-tooltip">
                      <strong>{sem.term}</strong>
                      <span>GPA : {sem.gpa}</span>
                    </div>
                  )}
                  <div
                    className="tracker-profile-gpa-bar"
                    style={{ height: `${(Number(sem.gpa) / 4) * 100}%` }}
                    onMouseEnter={() => setHover(index)}
                    onMouseLeave={() => setHover(null)}
                  />
                  <span className="tracker-profile-gpa-x">{sem.term}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      ) : (
        <div className="tracker-profile-gpa-alt">
          {chartType === 'line' && semesters.length > 0 && (
            <svg viewBox="0 0 800 260" preserveAspectRatio="none">
              <polyline
                points={semesters.map((sem, i) => {
                  const x = semesters.length === 1 ? 400 : 20 + (i * 700) / (semesters.length - 1);
                  const y = 240 - (Number(sem.gpa) / 4) * 200;
                  return `${x},${y}`;
                }).join(' ')}
                fill="none"
                stroke="#3488cb"
                strokeWidth="5"
              />
            </svg>
          )}
          {chartType === 'pie' && (
            <div className="tracker-profile-pie-ring">
              <div className="tracker-profile-pie-inner">{semesters[semesters.length - 1]?.gpa ?? '—'}</div>
            </div>
          )}
          {chartType === 'activity' && (
            <div className="tracker-profile-alt-chart activity">
              {semesters.map((sem) => (
                <div key={sem.term} className="tracker-profile-activity-col">
                  <div style={{ height: `${(Number(sem.gpa) / 4) * 100}%` }} />
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      <div className="tracker-profile-credit-progress">
        <div>
          <span>Required Credits</span>
          <div className="tracker-profile-credit-track required">
            <div style={{ width: `${reqPct}%` }} />
          </div>
        </div>
        <strong>
          {req.earned}/{req.total}
        </strong>
        <div>
          <span>Elective Credits</span>
          <div className="tracker-profile-credit-track elective">
            <div style={{ width: `${elecPct}%` }} />
          </div>
        </div>
        <strong>
          {elec.earned}/{elec.total}
        </strong>
      </div>
    </div>
  );
}
