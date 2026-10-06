import { Users, FileText, Calendar, Clock, Plus, BarChart3 } from 'lucide-react';
import StatCard from '@/components/dashboard/StatCard';
import { useStats, useStatusCounts, useMentees, useHome } from '@/services/dashboardService';
import { mentorBase } from '@/paths';
import ActivityCompletionChart from '@/components/dashboard/ActivityCompletionChart';
import StudentEngagementChart from '@/components/dashboard/StudentEngagementChart';
import ActivityList from '@/components/dashboard/ActivityList';
import MeetingList from '@/components/dashboard/MeetingList';
import WeeklySchedule from '@/components/dashboard/WeeklySchedule';
import InsightsGrid from '@/components/dashboard/InsightsGrid';
import ActivityBreakdownChart from '@/components/dashboard/ActivityBreakdownChart';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { useNavigate } from 'react-router-dom';

const statusLabels: Record<string, string> = { completed: 'Completed', 'in-progress': 'In Progress', overdue: 'Overdue', rejected: 'Rejected', pending: 'Pending' };
const statusColors: Record<string, string> = { completed: 'text-success', 'in-progress': 'text-primary', overdue: 'text-destructive', rejected: 'text-muted-foreground', pending: 'text-warning' };
export default function Dashboard() {
  const { data: stats, isLoading } = useStats();
  const { data: statuses = [] } = useStatusCounts();
  const { mentees } = useMentees();
  const home = useHome();
  const base = mentorBase();
  const navigate = useNavigate();
  return <div className="mx-auto max-w-[1600px] space-y-6">
    <div className="flex flex-wrap items-center justify-between gap-3 border-b pb-5">
      <div><h2 className="text-xl font-semibold">Mentorship Workspace</h2><p className="text-xs text-muted-foreground mt-1">{home.data?.rules?.summary || 'Live records · refreshes every 15 seconds'}</p></div>
      <div className="flex flex-wrap gap-2">
        <Button size="sm" onClick={() => navigate(`${base}/meetings?action=new`)}><Calendar className="h-4 w-4" />Schedule Meeting</Button>
        <Button size="sm" variant="outline" onClick={() => navigate(`${base}/activities?action=new`)}><Plus className="h-4 w-4" />Add Activity</Button>
        <Button size="sm" variant="outline" onClick={() => navigate(`${base}/profile?tab=performance`)}><BarChart3 className="h-4 w-4" />View Reports</Button>
      </div>
    </div>
    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
      <StatCard title="Total Mentees" value={stats?.totalMentees ?? 0} description="Current cohort" icon={<Users size={20} />} isLoading={isLoading} />
      <StatCard title="Activities" value={stats?.activities ?? 0} description="Across all terms" icon={<FileText size={20} />} isLoading={isLoading} iconBgColor="bg-info/10" iconColor="text-info" />
      <StatCard title="Upcoming Meetings" value={stats?.meetings ?? 0} description="Scheduled sessions" icon={<Calendar size={20} />} isLoading={isLoading} iconBgColor="bg-warning/10" iconColor="text-warning" />
      <StatCard title="Activity Completion" value={`${stats?.avgCompletion ?? 0}%`} description="Approved activities / total" icon={<Clock size={20} />} isLoading={isLoading} iconBgColor="bg-success/10" iconColor="text-success" />
    </div>
    <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
      <Card><CardHeader className="border-b"><h3 className="text-lg font-medium">Activity Status</h3></CardHeader><CardContent className="pt-5 space-y-4">
        {statuses.filter(item => item.count > 0).map(item => {
          const percentage = stats?.activities ? Math.round(item.count / stats.activities * 100) : 0;
          const bar = item.status === 'completed' ? 'bg-success' : item.status === 'overdue' ? 'bg-destructive' : item.status === 'rejected' ? 'bg-muted-foreground' : 'bg-primary';
          return <div key={item.status}><div className="flex justify-between mb-2 text-sm"><span className={statusColors[item.status]}>{statusLabels[item.status]}</span><span>{item.count} ({percentage}%)</span></div><Progress value={percentage} indicatorClassName={bar} className="h-2" /></div>;
        })}
      </CardContent></Card>
      <div className="xl:col-span-2"><ActivityCompletionChart /></div>
    </div>
    <div className="grid grid-cols-1 xl:grid-cols-2 gap-6"><StudentEngagementChart /><ActivityBreakdownChart /></div>
    <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
      <InsightsGrid />
      <Card className="xl:col-span-2"><CardHeader className="border-b"><h3 className="text-lg font-medium">Mentee Progress Overview</h3></CardHeader><CardContent className="pt-5 space-y-4">
        {mentees.slice(0, 5).map(mentee => {
          const progress = mentee.progress ?? 0;
          return <div key={mentee.usn}><div className="flex items-center justify-between gap-2 mb-2 text-sm"><div className="flex items-center gap-2"><Avatar className="h-7 w-7"><AvatarFallback className="text-xs bg-primary/10 text-primary">{mentee.name.split(' ').map(n => n[0]).join('')}</AvatarFallback></Avatar><span>{mentee.name}</span></div><span className={mentee.progress == null ? 'text-muted-foreground' : progress >= 80 ? 'text-success' : progress >= 60 ? 'text-warning' : 'text-destructive'}>{mentee.progress == null ? '—' : `${progress}%`}</span></div><Progress value={progress} className="h-2" /></div>;
        })}
        {mentees.length === 0 && <p className="text-sm text-muted-foreground">No mentees are assigned yet.</p>}
        <div className="text-center pt-2"><Button size="sm" variant="outline" onClick={() => navigate(`${base}/profile?tab=mentees`)}>View All Mentees</Button></div>
      </CardContent></Card>
    </div>
    <div className="grid grid-cols-1 xl:grid-cols-3 gap-6"><WeeklySchedule /><ActivityList /><MeetingList /></div>
  </div>;
}
