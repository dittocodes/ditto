import { useQuery } from '@tanstack/react-query';
import { mentorRequest } from './api';

const REFRESH_MS = 15000;

export interface LiveMentee { name: string; usn: string; progress: number | null }
export interface LiveHome {
  mentor_name?: string;
  rules?: { summary?: string };
  counts?: {
    mentees?: number;
    activities?: number;
    meetings?: number;
    meetings_total?: number;
    completion?: number | null;
    average_score?: number | null;
    attendance_rate?: number | null;
    avg_duration_minutes?: number | null;
  };
  status_counts?: Record<string, number>;
  insights?: {
    overdue?: number;
    without_score?: number;
    upcoming?: number;
    progress?: string | null;
    best_category?: string | null;
    avg_duration?: string | null;
    active_mentees?: number;
  };
  students?: { usn: string; name: string; score?: number | null; progress?: number | null; program?: string }[];
  activities?: ActivityRow[];
  meetings?: MeetingRow[];
  all_meetings?: MeetingRow[];
  week?: { id: number; title: string; day: string; time: string; type: string; attendees: number }[];
  breakdown?: { name: string; value: number; color: string }[];
  completion_series?: { name: string; value: number }[];
  engagement_series?: { name: string; value: number }[];
  session_mix?: { name: string; value: number }[];
  monthly?: { months: string[]; sessions: number[]; progress: number[] };
  profile_metrics?: {
    response_rate?: number | null;
    session_completion_rate?: number | null;
    mentee_progress_rate?: number | null;
    attendance_rate?: number | null;
  };
  summary?: { active?: number; sessions_completed?: number; upcoming?: number };
}

export interface ActivityRow {
  id: string;
  numeric_id?: number;
  usn: string;
  studentName: string;
  title: string;
  category: string;
  termType: 'Short Term' | 'Mid Term' | 'Long Term';
  deadline: string;
  remarks: string | null;
  completionDays: number | null;
  benefitted: boolean;
  proof: null;
  status: 'pending' | 'in-progress' | 'completed' | 'overdue' | 'rejected';
}

export interface MeetingRow {
  id: number;
  meeting_id: string;
  title: string;
  date: string;
  time: string;
  dateTime?: string | null;
  day?: string;
  duration: number;
  location: string;
  attendees: string[];
  attendee?: string;
  status: 'confirmed' | 'pending' | 'completed' | 'cancelled';
  agenda?: string;
  notes?: string;
  isVirtual?: boolean;
  type?: string;
}

export const useHome = () => useQuery({
  queryKey: ['mentor-home'],
  queryFn: () => mentorRequest('/api/v1/mentor/home') as Promise<LiveHome>,
  refetchInterval: REFRESH_MS,
});

export const useMentees = () => {
  const home = useHome();
  const mentees: LiveMentee[] = (home.data?.students || []).map((student) => ({
    name: student.name,
    usn: student.usn,
    progress: student.progress ?? null,
  }));
  return { ...home, mentees };
};

export interface StatData { totalMentees: number; activities: number; meetings: number; avgCompletion: number }
export interface ChartData { name: string; value: number }
export interface InsightData { skillGrowth: string; bestPerformance: string; avgDuration: string; mentorRelationships: number }
export interface ActivityBreakdownData { name: string; value: number; color: string }
export interface ScheduledMeeting { id: number; title: string; day: string; time: string; type: string; attendees: number }

const colorOf = (token: string) => `hsl(var(--${token}))`;

export const useStatusCounts = () => {
  const home = useHome();
  const counts = home.data?.status_counts || {};
  return {
    ...home,
    data: ['completed', 'in-progress', 'overdue', 'rejected', 'pending'].map((status) => ({
      status,
      count: counts[status] || 0,
    })),
  };
};

export const useStats = () => {
  const home = useHome();
  const counts = home.data?.counts;
  const data: StatData | undefined = counts
    ? {
        totalMentees: counts.mentees || 0,
        activities: counts.activities || 0,
        meetings: counts.meetings || 0,
        avgCompletion: counts.completion ?? 0,
      }
    : undefined;
  return { ...home, data };
};

export const useCompletionData = () => {
  const home = useHome();
  return { ...home, data: home.data?.completion_series || [] };
};

export const useEngagementData = () => {
  const home = useHome();
  return { ...home, data: home.data?.engagement_series || [] };
};

export const useInsightsData = () => {
  const home = useHome();
  const insights = home.data?.insights;
  const data: InsightData | undefined = insights
    ? {
        skillGrowth: insights.progress || '—',
        bestPerformance: insights.best_category || '—',
        avgDuration: insights.avg_duration || '—',
        mentorRelationships: insights.active_mentees || 0,
      }
    : undefined;
  return { ...home, data };
};

export const useActivityBreakdown = () => {
  const home = useHome();
  const data: ActivityBreakdownData[] = (home.data?.breakdown || []).map((item) => ({
    ...item,
    color: colorOf(item.color),
  }));
  return { ...home, data };
};

export const useWeeklySchedule = () => {
  const home = useHome();
  return { ...home, data: (home.data?.week || []) as ScheduledMeeting[] };
};

export const useActivities = (status?: 'pending' | 'completed') => {
  const home = useHome();
  const rows = (home.data?.activities || []).filter((activity) => (
    !status || (status === 'completed' ? activity.status === 'completed' : activity.status !== 'completed')
  ));
  return {
    ...home,
    data: rows.slice(0, 3).map((activity) => ({
      id: activity.numeric_id,
      title: activity.title,
      category: activity.category,
      dueDate: activity.deadline,
      status: activity.status === 'completed' ? 'completed' as const : 'pending' as const,
      type: activity.termType === 'Short Term' ? 'short-term' as const : activity.termType === 'Mid Term' ? 'medium-term' as const : 'long-term' as const,
    })),
  };
};

export const useMeetings = () => {
  const home = useHome();
  return {
    ...home,
    data: (home.data?.meetings || []).slice(0, 3).map((meeting) => ({
      id: meeting.id,
      title: meeting.title,
      date: meeting.date,
      time: meeting.time,
      attendee: meeting.attendee || meeting.attendees.join(', '),
      status: meeting.status === 'pending' ? 'awaiting' as const : 'confirmed' as const,
      day: meeting.day || '',
    })),
  };
};
