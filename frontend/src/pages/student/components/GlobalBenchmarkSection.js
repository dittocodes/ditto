import React from 'react';
import { Globe2, Info } from 'lucide-react';
import {
  Legend,
  PolarAngleAxis,
  PolarGrid,
  PolarRadiusAxis,
  Radar,
  RadarChart,
  ResponsiveContainer,
} from 'recharts';

export default function GlobalBenchmarkSection({ globalBenchmark, performanceAnalysis }) {
  const benchmark = globalBenchmark || {};
  const radarData = (benchmark.axes || []).map((name, i) => ({
    subject: name,
    'Your Score': benchmark.your_score?.[i],
    'Regional Average': benchmark.regional_avg?.[i],
    'Global Average': benchmark.global_avg?.[i],
  }));
  const rows = performanceAnalysis || [];

  return (
    <section className="tracker-card tracker-comparison-benchmark">
      <div className="tracker-comparison-benchmark-head">
        <div className="tracker-comparison-benchmark-title">
          <Globe2 size={22} strokeWidth={1.8} aria-hidden />
          <span>Global Benchmark</span>
        </div>
        <button type="button" className="tracker-analysis-info" aria-label="More information">
          <Info size={16} />
        </button>
      </div>
      <div className="tracker-comparison-benchmark-body">
        <div className="tracker-comparison-benchmark-chart">
          <ResponsiveContainer width="100%" height={280}>
            <RadarChart data={radarData}>
              <PolarGrid stroke="#e2e8f0" />
              <PolarAngleAxis dataKey="subject" tick={{ fontSize: 10, fill: '#64748b' }} />
              <PolarRadiusAxis angle={30} domain={[0, 100]} tick={{ fontSize: 9 }} />
              <Radar
                name="Your Score"
                dataKey="Your Score"
                stroke="#2563eb"
                fill="#2563eb"
                fillOpacity={0.35}
              />
              <Radar
                name="Regional Average"
                dataKey="Regional Average"
                stroke="#22c55e"
                fill="#22c55e"
                fillOpacity={0.2}
              />
              <Radar
                name="Global Average"
                dataKey="Global Average"
                stroke="#f97316"
                fill="#f97316"
                fillOpacity={0.15}
              />
              <Legend wrapperStyle={{ fontSize: 11, paddingTop: 8 }} />
            </RadarChart>
          </ResponsiveContainer>
        </div>
        <div className="tracker-comparison-benchmark-panel">
          <h4>Performance Analysis</h4>
          <div className="tracker-comparison-perf-list">
            {rows.map((row) => {
              const up = row.trend === 'up';
              return (
                <div key={row.skill} className="tracker-comparison-perf-item">
                  <div className="tracker-comparison-perf-item-head">
                    <strong>{row.skill}</strong>
                    <div className="tracker-comparison-perf-stats">
                      <span>
                        {row.score}
                        {' '}
                        / 100
                      </span>
                      <span>
                        Global Avg:
                        {' '}
                        {row.global_avg}
                      </span>
                      <span className={up ? 'tracker-comparison-perf-trend up' : 'tracker-comparison-perf-trend down'}>
                        {up ? '↑' : '↓'}
                        {' '}
                        {up ? '+' : '-'}
                        {row.trend_pct}
                        %
                      </span>
                    </div>
                  </div>
                  <div className="tracker-comparison-perf-bar">
                    <div
                      className={up ? 'fill-up' : 'fill-down'}
                      style={{ width: `${Math.min(100, row.score || 0)}%` }}
                    />
                  </div>
                  <p>{row.narrative}</p>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}
