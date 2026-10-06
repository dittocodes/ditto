import React, { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  FaBook,
  FaBullseye,
  FaCalendarAlt,
  FaChartLine,
  FaCheckCircle,
  FaClock,
  FaMedal,
  FaTasks,
  FaUserFriends,
  FaUsers,
} from 'react-icons/fa';
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
  PolarAngleAxis,
  PolarGrid,
  PolarRadiusAxis,
  Radar,
  RadarChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { Globe2, Info } from 'lucide-react';
import { fetchOverview, getUid } from '../../../../services/studentV1Api';
import TrackerActivityCard from '../../components/TrackerActivityCard';
import TrackerActivityReminders from '../../components/TrackerActivityReminders';
import TrackerKpiCard from '../../components/TrackerKpiCard';
import TrackerMeetingsWidget from '../../components/TrackerMeetingsWidget';
import TrackerPageHeader from '../../components/TrackerPageHeader';
import TrackerPathwayTimeline from '../../components/TrackerPathwayTimeline';
import TrackerSectionHeader from '../../components/TrackerSectionHeader';
import TrackerStatCard from '../../components/TrackerStatCard';
import TrackerWelcomeToast from '../../components/TrackerWelcomeToast';

const COLORS = ['#2563eb', '#93c5fd', '#1d4ed8', '#60a5fa'];
const KPI_PAGE_SIZE = 4;

const STAT_ICONS = {
  activities: FaCheckCircle,
  meetings: FaCalendarAlt,
  score: FaChartLine,
  hours: FaClock,
};

const KPI_ICONS = {
  clock: FaClock,
  book: FaBook,
  target: FaBullseye,
  medal: FaMedal,
  chart: FaChartLine,
  tasks: FaTasks,
  users: FaUsers,
  check: FaCheckCircle,
};

export default function TrackerDashboardPage() {
  const { student_usn } = useParams();
  const [data, setData] = useState(null);
  const [err, setErr] = useState('');
  const [kpiPage, setKpiPage] = useState(0);
  const [showWelcomeToast, setShowWelcomeToast] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const uid = await getUid();
        setData(await fetchOverview(uid));
      } catch (e) {
        setErr(e.message);
      }
    })();
  }, [student_usn]);

  if (err) return <div className="tracker-card">{err}</div>;
  if (!data) return <div className="tracker-card">Loading dashboard…</div>;

  const kpis = data.kpis || [];
  const kpiPageCount = Math.max(1, Math.ceil(kpis.length / KPI_PAGE_SIZE));
  const kpiSlice = kpis.slice(kpiPage * KPI_PAGE_SIZE, (kpiPage + 1) * KPI_PAGE_SIZE);
  const reminders = data.activity_reminders || {};
  const radarData = (data.global_benchmark?.axes || []).map((name, i) => ({
    subject: name,
    You: data.global_benchmark?.your_score?.[i],
    Regional: data.global_benchmark?.regional_avg?.[i],
    Global: data.global_benchmark?.global_avg?.[i],
  }));
  const skillDist = data.charts?.skill_distribution?.items
    || (Array.isArray(data.charts?.skill_distribution) ? data.charts.skill_distribution : []);
  const activityProgress = data.charts?.activity_progress;
  const actProgData = (activityProgress?.months || []).map((m, i) => ({
    month: m,
    total: activityProgress?.total?.[i] ?? 0,
    completed: activityProgress?.completed?.[i] ?? 0,
  }));
  const panelItems = data.benchmark_panel?.items?.length
    ? data.benchmark_panel.items
    : (data.performance_analysis || []).slice(0, 3).map((r) => ({
      label: r.skill,
      score: r.score,
      insight: r.narrative,
    }));

  return (
    <div className="tracker-dashboard-page">
      {showWelcomeToast && (
        <TrackerWelcomeToast
          name={data.welcome_name}
          pendingActivities={reminders.pending_activities ?? 0}
          upcomingMeetings={reminders.upcoming_meetings ?? 0}
          onDismiss={() => setShowWelcomeToast(false)}
        />
      )}
      <TrackerPageHeader
        title="Dashboard"
        subtitle={`Welcome back, ${data.welcome_name}! Here's your progress overview.`}
        actions={(
          <div className="tracker-header-pills">
            <Link to={`/student/${student_usn}/meetings`} className="tracker-pill-primary">
              <FaCalendarAlt /> Schedule
            </Link>
            <Link to={`/student/${student_usn}/activities`} className="tracker-pill-outline">
              <FaClock /> Time Log
            </Link>
            <Link to={`/student/${student_usn}/chat`} className="tracker-pill-outline">
              <FaUserFriends /> Ditto
            </Link>
            <Link to={`/student/${student_usn}/profile?tab=documents`} className="tracker-pill-outline">
              <FaBook /> Resources
            </Link>
          </div>
        )}
      />

      <div className="tracker-stat-grid">
        {data.summary_cards?.map((c) => (
          <TrackerStatCard
            key={c.title}
            title={c.title}
            value={c.value}
            trendPct={c.trend_pct}
            progressPct={c.progress_pct}
            lastUpdated={c.last_updated}
            icon={STAT_ICONS[c.icon] || FaChartLine}
            detailLink={`/student/${student_usn}/analysis`}
          />
        ))}
      </div>

      <div className="tracker-card tracker-kpi-section">
        <TrackerSectionHeader
          title="Key Performance Indicators"
          pagination={{
            pageIndex: kpiPage,
            pageCount: kpiPageCount,
            onPageChange: setKpiPage,
          }}
        />
        <div className="tracker-kpi-grid">
          {kpiSlice.map((k) => (
            <TrackerKpiCard
              key={k.title}
              title={k.title}
              value={k.value}
              valueNumber={k.value_number}
              valueUnit={k.value_unit}
              trendPct={k.trend_pct}
              weeks={k.weeks}
              barHeights={k.bar_heights}
              icon={KPI_ICONS[k.icon] || FaChartLine}
              iconTone={k.icon_tone}
            />
          ))}
        </div>
      </div>

      <section className="tracker-card tracker-benchmark-combined">
        <div className="tracker-benchmark-combined-header">
          <div className="tracker-benchmark-combined-title">
            <Globe2 size={24} strokeWidth={1.8} />
            <span>Global Benchmark</span>
          </div>
          <button type="button" className="tracker-section-info" aria-label="More information">
            <Info size={17} />
          </button>
        </div>
        <div className="tracker-benchmark-combined-body">
          <div>
            <ResponsiveContainer width="100%" height={260}>
              <RadarChart data={radarData}>
                <PolarGrid />
                <PolarAngleAxis dataKey="subject" tick={{ fontSize: 10 }} />
                <PolarRadiusAxis angle={30} domain={[0, 100]} />
                <Radar name="You" dataKey="You" stroke="#2563eb" fill="#2563eb" fillOpacity={0.4} />
                <Radar name="Regional" dataKey="Regional" stroke="#22c55e" fill="#22c55e" fillOpacity={0.2} />
                <Radar name="Global" dataKey="Global" stroke="#f97316" fill="#f97316" fillOpacity={0.15} />
                <Legend />
              </RadarChart>
            </ResponsiveContainer>
          </div>
          <div>
            <div className="tracker-benchmark-panel-title">Performance Analysis</div>
            <div className="tracker-benchmark-panel-box">
              {panelItems.map((item) => (
                <div key={item.label} className="tracker-benchmark-panel-row">
                  <span>
                    {item.label}
                    {item.insight ? (
                      <span className="tracker-benchmark-panel-insight">{item.insight}</span>
                    ) : null}
                  </span>
                  <strong>{item.score}%</strong>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <div className="tracker-card" style={{ marginTop: '1rem' }}>
        <TrackerSectionHeader title="Learning Pathway" icon={FaBullseye} />
        <TrackerPathwayTimeline phases={data.learning_pathway?.phases || []} />
      </div>

      <div className="tracker-grid-2">
        <div className="tracker-card">
          <TrackerSectionHeader
            title="Activity Completion Rate"
            subtitle={data.charts?.activity_completion?.subtitle}
            showInfo
          />
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={(data.charts?.activity_completion?.months || []).map((m, i) => ({
              month: m,
              total: data.charts.activity_completion.total[i],
              completed: data.charts.activity_completion.completed[i],
            }))}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="month" />
              <YAxis />
              <Tooltip />
              <Legend />
              <Bar dataKey="total" fill="#cbd5e1" name="Total" />
              <Bar dataKey="completed" fill="#2563eb" name="Completed" />
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div className="tracker-card">
          <TrackerSectionHeader
            title="Skill Distribution"
            subtitle={data.charts?.skill_distribution?.subtitle}
            showInfo
          />
          <ResponsiveContainer width="100%" height={220}>
            <PieChart>
              <Pie data={skillDist} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={70} label>
                {skillDist.map((_, i) => (
                  <Cell key={i} fill={COLORS[i % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="tracker-grid-2">
        <div className="tracker-card">
          <TrackerSectionHeader
            title="Performance Trend"
            subtitle={data.charts?.performance_trend?.subtitle}
            showInfo
          />
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={(data.charts?.performance_trend?.scores || []).map((s, i) => ({
              week: data.charts.performance_trend.weeks[i],
              score: s,
            }))}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="week" />
              <YAxis domain={[60, 100]} />
              <Tooltip />
              <Line type="monotone" dataKey="score" stroke="#2563eb" strokeWidth={2} />
            </LineChart>
          </ResponsiveContainer>
        </div>
        <div className="tracker-card">
          <TrackerSectionHeader
            title="Skill Growth"
            subtitle={data.charts?.skill_growth?.subtitle}
            showInfo
          />
          {(data.charts?.skill_growth?.items || data.charts?.skill_growth || []).map((g) => (
            <div key={g.skill} className="tracker-skill-growth-row">
              <div className="tracker-skill-growth-labels">
                <span>{g.skill}</span>
                <span style={{ color: '#22c55e' }}>+{g.growth_pct}%</span>
              </div>
              <div className="tracker-skill-growth-bars">
                <div className="tracker-skill-growth-prev">
                  <small>Previous</small>
                  <strong>{g.previous}%</strong>
                </div>
                <div className="tracker-skill-growth-curr">
                  <small>Current</small>
                  <strong>{g.current}%</strong>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="tracker-grid-2">
        <div className="tracker-card">
          <TrackerSectionHeader
            title="Recent Activities"
            action={(
              <Link to={`/student/${student_usn}/document-records`} className="tracker-link-view-all">
                View All
              </Link>
            )}
          />
          <div className="tracker-activity-grid">
            {(data.recent_activities || []).slice(0, 6).map((a, i) => (
              <TrackerActivityCard
                key={i}
                activity={a}
                detailsHref={a.source === 'document' ? `/student/${student_usn}/document-records` : `/student/${student_usn}/activities`}
              />
            ))}
          </div>
          {!data.recent_activities?.length && <p style={{ color: '#64748b' }}>No recent activities.</p>}
        </div>
        <div className="tracker-card">
          <TrackerSectionHeader title="Skills Overview" showInfo />
          <ResponsiveContainer width="100%" height={160}>
            <BarChart layout="vertical" data={data.skills_overview || []}>
              <XAxis type="number" domain={[0, 100]} />
              <YAxis type="category" dataKey="name" width={100} tick={{ fontSize: 11 }} />
              <Tooltip />
              <Bar dataKey="pct" fill="#2563eb" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
          {(data.attained_skills || []).length > 0 && (
            <ul className="tracker-attained-skills">
              {data.attained_skills.map((skill) => (
                <li key={skill.name}>
                  <span>{skill.name}</span>
                  <span>{skill.completed_on || 'Date not printed'}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <TrackerActivityReminders reminders={data.activity_reminders} />

      <div className="tracker-grid-2" style={{ marginTop: '1rem' }}>
        <div className="tracker-card">
          <TrackerSectionHeader title="Activity progress" subtitle={activityProgress?.subtitle} showInfo />
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={actProgData.length ? actProgData : [{ month: '—', total: 0, completed: 0 }]}>
              <XAxis dataKey="month" />
              <YAxis />
              <Tooltip />
              <Legend />
              <Bar dataKey="total" fill="#cbd5e1" name="Total" />
              <Bar dataKey="completed" fill="#2563eb" name="Completed" />
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div className="tracker-card">
          <TrackerSectionHeader title="Meetings & calendar" />
          <TrackerMeetingsWidget
            upcoming={data.meeting_widgets?.upcoming}
            completed={data.meeting_widgets?.completed}
            cancelled={data.meeting_widgets?.cancelled}
            reminderText={data.meeting_widgets?.reminder_text}
            eventDates={data.meeting_widgets?.event_dates || []}
          />
        </div>
      </div>
    </div>
  );
}
