import React, { useEffect, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import {
  Activity,
  BarChart3,
  Calendar,
  CalendarDays,
  Download,
  FileText,
  GitCompare,
  Info,
  LayoutDashboard,
  TrendingUp,
} from 'lucide-react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { downloadReport, fetchAnalysis, getUid } from '../../../../services/studentV1Api';
import AnalysisReportCards from '../../components/AnalysisReportCards';
import AnalyticsReportSidebar from '../../components/AnalyticsReportSidebar';
import ActivityProgressChart from '../../components/ActivityProgressChart';
import ChartTypeToolbar from '../../components/ChartTypeToolbar';
import ComparisonChart from '../../components/ComparisonChart';
import ComparisonInsightCards from '../../components/ComparisonInsightCards';
import ComparisonSidebarControls from '../../components/ComparisonSidebarControls';
import GlobalBenchmarkSection from '../../components/GlobalBenchmarkSection';
import AnalysisTabSkills from './AnalysisTabSkills';
import '../../../../assets/css/tracker-analysis.css';

const TABS = [
  { id: 'overview', label: 'Overview', icon: LayoutDashboard },
  { id: 'skills', label: 'Skills', icon: Activity },
  { id: 'comparison', label: 'Comparison', icon: GitCompare },
  { id: 'reports', label: 'Reports', icon: FileText },
];

const PIE_COLORS = ['#2563eb', '#60a5fa', '#1d4ed8', '#93c5fd'];

function AnalysisCard({ title, subtitle, children, className = '' }) {
  return (
    <div className={`tracker-analysis-card ${className}`}>
      <div className="tracker-analysis-card-head">
        <div>
          <h3>{title}</h3>
          {subtitle ? <p className="tracker-analysis-card-sub">{subtitle}</p> : null}
        </div>
        <button type="button" className="tracker-analysis-info" aria-label="More information">
          <Info size={16} />
        </button>
      </div>
      {children}
    </div>
  );
}

export default function AnalysisPage() {
  const { student_usn } = useParams();
  const [search, setSearch] = useSearchParams();
  const tab = search.get('tab') || 'overview';
  const [data, setData] = useState(null);
  const [loadErr, setLoadErr] = useState('');
  const [swotTab, setSwotTab] = useState('S');
  const [range, setRange] = useState('1M');

  useEffect(() => {
    (async () => {
      try {
        setLoadErr('');
        const uid = await getUid();
        setData(await fetchAnalysis(uid, tab));
      } catch (e) {
        setData(null);
        setLoadErr(e.message || 'Failed to load analysis');
      }
    })();
  }, [student_usn, tab]);

  const [busyType, setBusyType] = useState('');
  const [reportErr, setReportErr] = useState('');

  const onDownload = async (type) => {
    setBusyType(type);
    setReportErr('');
    try {
      const uid = await getUid();
      await downloadReport(uid, type);
    } catch (err) {
      setReportErr(err.message || 'Could not generate that report');
    } finally {
      setBusyType('');
    }
  };

  return (
    <div className="tracker-analysis-page">
      <h1 className="tracker-page-title">Analysis</h1>
      <p className="tracker-page-sub">Review your performance analysis and recommendations</p>
      <div className="tracker-analysis-tabs">
        {TABS.map((t) => {
          const Icon = t.icon;
          return (
            <button
              key={t.id}
              type="button"
              className={`tracker-analysis-tab${tab === t.id ? ' active' : ''}`}
              onClick={() => setSearch({ tab: t.id })}
            >
              <Icon size={18} strokeWidth={1.8} />
              {t.label}
            </button>
          );
        })}
      </div>
      {!data && !loadErr ? <div className="tracker-card">Loading…</div> : null}
      {loadErr ? <div className="tracker-card">{loadErr}</div> : null}
      {reportErr ? <div className="tracker-card">{reportErr}</div> : null}
      {data ? (
        <AnalysisTab
          tab={tab}
          data={data}
          studentUsn={student_usn}
          swotTab={swotTab}
          setSwotTab={setSwotTab}
          range={range}
          setRange={setRange}
          onDownload={onDownload}
          busyType={busyType}
        />
      ) : null}
    </div>
  );
}

function SkillGrowthBlock({ items }) {
  if (!items?.length) {
    return <p className="tracker-analysis-empty-hint">No skill growth data yet.</p>;
  }
  return items.map((g) => (
    <div key={g.skill} className="tracker-analysis-skill-growth-item">
      <div className="tracker-analysis-skill-growth-head">
        <span>{g.skill}</span>
        <span className="tracker-analysis-skill-growth-delta">
          +
          {g.growth_pct}
          % ↗
        </span>
      </div>
      <div className="tracker-analysis-skill-growth-compare">
        <div className="tracker-analysis-skill-growth-col">
          <div className="tracker-analysis-skill-growth-bar-track">
            <div
              className="tracker-analysis-skill-growth-bar-fill prev"
              style={{ width: `${Math.min(100, g.previous || 0)}%` }}
            />
          </div>
          <div className="tracker-analysis-skill-growth-meta">
            <small>Previous</small>
            <strong>
              {g.previous}
              %
            </strong>
          </div>
        </div>
        <div className="tracker-analysis-skill-growth-col">
          <div className="tracker-analysis-skill-growth-bar-track">
            <div
              className="tracker-analysis-skill-growth-bar-fill curr"
              style={{ width: `${Math.min(100, g.current || 0)}%` }}
            />
          </div>
          <div className="tracker-analysis-skill-growth-meta">
            <small>Current</small>
            <strong>
              {g.current}
              %
            </strong>
          </div>
        </div>
      </div>
    </div>
  ));
}

function AnalysisOverview({ data, studentUsn, onDownload }) {
  const sidebar = data.analytics_sidebar || {};
  const ctas = data.overview_ctas || {};
  const actCompletion = data.charts?.activity_completion;
  const actChartData = (actCompletion?.months || []).map((m, i) => ({
    month: m,
    total: actCompletion?.total?.[i] ?? 0,
    completed: actCompletion?.completed?.[i] ?? 0,
  }));
  const actYMax = Math.max(
    28,
    ...actChartData.flatMap((d) => [d.total, d.completed]),
  );
  const actYTicks = [0, 7, 14, 21, 28].filter((t) => t <= actYMax);
  if (actYTicks[actYTicks.length - 1] !== actYMax && actYMax > 28) {
    actYTicks.push(actYMax);
  }
  const skillDistRaw = data.charts?.skill_distribution;
  const pie = skillDistRaw?.items || (Array.isArray(skillDistRaw) ? skillDistRaw : []);
  const skillGrowth = data.charts?.skill_growth?.items || data.charts?.skill_growth || [];
  const perfTrend = (data.charts?.performance_trend?.scores || []).map((s, i) => ({
    week: data.charts?.performance_trend?.weeks?.[i],
    score: s,
  }));

  return (
    <div className="tracker-analysis-overview">
      <div className="tracker-analysis-col">
        <AnalysisCard
          title="Activity Completion Rate"
          subtitle={actCompletion?.subtitle || 'Monthly activity completion statistics'}
        >
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={actChartData}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="month" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} domain={[0, actYMax]} ticks={actYTicks.length ? actYTicks : [0, 7, 14, 21, 28]} />
              <Tooltip />
              <Legend />
              <Bar dataKey="total" fill="#cbd5e1" name="Total Activities" radius={[4, 4, 0, 0]} />
              <Bar dataKey="completed" fill="#2563eb" name="Completed" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </AnalysisCard>

        <AnalysisCard
          title="Performance Trend"
          subtitle={data.charts?.performance_trend?.subtitle || 'Weekly performance score'}
        >
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={perfTrend}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="week" tick={{ fontSize: 11 }} />
              <YAxis domain={[60, 100]} tick={{ fontSize: 11 }} />
              <Tooltip />
              <Line
                type="monotone"
                dataKey="score"
                stroke="#2563eb"
                strokeWidth={2}
                dot={{ r: 4, fill: '#2563eb', strokeWidth: 0 }}
                activeDot={{ r: 5 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </AnalysisCard>

        <AnalysisCard className="tracker-analysis-cta-card">
          <h4 className="tracker-analysis-cta-title">
            {ctas.monthly_report?.title || 'Monthly Report'}
          </h4>
          <p>{ctas.monthly_report?.description}</p>
          <button
            type="button"
            className="tracker-analysis-cta-btn"
            onClick={() => onDownload(ctas.monthly_report?.report_type || 'progress')}
          >
            <Download size={16} aria-hidden />
            {ctas.monthly_report?.cta_label || 'Download Report'}
          </button>
        </AnalysisCard>
      </div>

      <div className="tracker-analysis-col">
        <AnalysisCard
          title="Skill Distribution"
          subtitle={skillDistRaw?.subtitle || 'Your skills by category'}
        >
          <ResponsiveContainer width="100%" height={220}>
            <PieChart>
              <Pie data={pie} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={72} label={({ name, value }) => `${name} ${value}%`}>
                {pie.map((_, i) => (
                  <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </AnalysisCard>

        <AnalysisCard
          title="Skill Growth"
          subtitle={data.charts?.skill_growth?.subtitle || 'Improvement in your skills'}
        >
          <SkillGrowthBlock items={skillGrowth} />
        </AnalysisCard>

        <AnalysisCard className="tracker-analysis-cta-card">
          <h4 className="tracker-analysis-cta-title">
            {ctas.meeting_notes?.title || 'Meeting Notes'}
          </h4>
          <p>{ctas.meeting_notes?.description}</p>
          <Link to={`/student/${studentUsn}/meetings`} className="tracker-analysis-cta-btn">
            <Calendar size={16} aria-hidden />
            {ctas.meeting_notes?.cta_label || 'View All Notes'}
          </Link>
        </AnalysisCard>
      </div>

      <AnalyticsReportSidebar sidebar={sidebar} className="tracker-analysis-sidebar-span" />
    </div>
  );
}

function ComparisonPanel({ data, range, setRange }) {
  const [viewMode, setViewMode] = useState('visual');
  const [chartType, setChartType] = useState('bar');
  const comp = data.comparison || {};
  const periodOptions = comp.period_options || ['1M', '3M', '6M', '1Y'];
  const activePeriod = range || comp.range || '1M';
  const chartRows = comp.chart_rows;
  const cats = comp.categories || [];
  const cur = comp.current || [];
  const prev = comp.previous || [];
  const chartData = (chartRows?.length
    ? chartRows.map((r) => ({
        name: r.skill || r.name,
        current: r.current,
        previous: r.previous,
      }))
    : cats.map((c, i) => ({ name: c, current: cur[i], previous: prev[i] }))
  ).filter((row) => row.name);

  const compareNote = comp.compare_note || `Comparing current data with ${activePeriod} ago`;

  return (
    <div className="tracker-comparison-page">
      <div className="tracker-comparison-main-column">
        <div className="tracker-card tracker-comparison-chart-card tracker-comparison-progress-card">
          <div className="tracker-comparison-progress-head">
            <div className="tracker-comparison-progress-title">
              <TrendingUp size={20} className="tracker-comparison-progress-icon" aria-hidden />
              <h3>Progress Comparison</h3>
            </div>
            <div className="tracker-comparison-period-row">
              {periodOptions.map((p) => (
                <button
                  key={p}
                  type="button"
                  className={`tracker-comparison-period-btn${activePeriod === p ? ' active' : ''}`}
                  onClick={() => setRange(p)}
                >
                  {p}
                </button>
              ))}
            </div>
          </div>

          <div className="tracker-comparison-controls">
            <div className="tracker-comparison-toggle">
              <button
                type="button"
                className={`tracker-tab${viewMode === 'visual' ? ' active' : ''}`}
                onClick={() => setViewMode('visual')}
              >
                Visual Comparison
              </button>
              <button
                type="button"
                className={`tracker-tab${viewMode === 'data' ? ' active' : ''}`}
                onClick={() => setViewMode('data')}
              >
                Data Comparison
              </button>
            </div>
          </div>

          {viewMode === 'visual' ? (
            <>
              <div className="tracker-comparison-info-bar">
                <CalendarDays size={18} aria-hidden />
                <span>{compareNote}</span>
              </div>
              <div className="tracker-comparison-dark-chart">
                <ComparisonChart chartType={chartType} chartData={chartData} dark />
              </div>
            </>
          ) : (
            <table className="tracker-comparison-data-table">
              <thead>
                <tr>
                  <th>Skill</th>
                  <th>Previous</th>
                  <th>Current</th>
                  <th>Change</th>
                </tr>
              </thead>
              <tbody>
                {chartData.map((row) => {
                  const delta = (row.current ?? 0) - (row.previous ?? 0);
                  const pct = row.previous
                    ? ((delta / row.previous) * 100).toFixed(1)
                    : '0.0';
                  return (
                    <tr key={row.name}>
                      <td>{row.name}</td>
                      <td>{row.previous}%</td>
                      <td>{row.current}%</td>
                      <td className="tracker-comparison-data-positive">
                        +
                        {pct}
                        %
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}

          <ComparisonInsightCards comparison={comp} />
        </div>

        <GlobalBenchmarkSection
          globalBenchmark={data.global_benchmark}
          performanceAnalysis={data.performance_analysis}
        />
      </div>

      <aside className="tracker-comparison-right-rail">
        <ComparisonSidebarControls
          chartType={chartType}
          onChartTypeChange={setChartType}
          range={activePeriod}
          onRangeChange={setRange}
        />
        <div className="tracker-card tracker-comparison-activity-card">
          <div className="tracker-comparison-chart-head">
            <h3>Activity Progress</h3>
            <ChartTypeToolbar value={chartType} onChange={setChartType} />
          </div>
          <ActivityProgressChart chartType={chartType} activityProgress={data.activity_progress} />
        </div>
      </aside>
    </div>
  );
}

function AnalysisTab({ tab, data, studentUsn, swotTab, setSwotTab, range, setRange, onDownload, busyType }) {
  if (tab === 'overview') {
    return <AnalysisOverview data={data} studentUsn={studentUsn} onDownload={onDownload} />;
  }
  if (tab === 'reports') {
    return (
      <AnalysisReportCards reportCards={data.report_cards} onDownload={onDownload} busyType={busyType} />
    );
  }
  if (tab === 'skills') {
    return <AnalysisTabSkills data={data} swotTab={swotTab} setSwotTab={setSwotTab} />;
  }
  if (tab === 'comparison') {
    return <ComparisonPanel data={data} range={range} setRange={setRange} />;
  }
  return null;
}
