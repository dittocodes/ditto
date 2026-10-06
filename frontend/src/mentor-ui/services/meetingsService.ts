import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { mentorRequest } from './api';
import { MeetingRow, useHome } from './dashboardService';

export interface MeetingData {
  id: number;
  meetingId: string;
  title: string;
  date: string;
  time: string;
  dateTime?: string;
  duration: string | number;
  location: string;
  attendees: string[];
  attendeeCount?: number;
  status: 'confirmed' | 'pending' | 'completed' | 'rescheduled' | 'cancelled';
  agenda?: string;
  notes?: string;
  isVirtual?: boolean;
  attended?: boolean;
}

export interface MeetingStats {
  totalMeetings: number;
  upcomingMeetings: number;
  attendanceRate: number | null;
  avgDuration: number | null;
  nextMeeting?: { day: string; time: string };
  mostCommonDuration: string;
}

const toMeeting = (row: MeetingRow): MeetingData => ({
  id: row.id,
  meetingId: row.meeting_id,
  title: row.title,
  date: row.date,
  time: row.time,
  dateTime: row.dateTime || undefined,
  duration: row.duration ? `${row.duration} minutes` : '—',
  location: row.location,
  attendees: row.attendee ? [row.attendee] : row.attendees,
  attendeeCount: 1,
  status: row.status,
  agenda: row.agenda,
  notes: row.notes,
  isVirtual: row.isVirtual,
});

export const useMeetingRecords = () => {
  const home = useHome();
  const rows = home.data?.all_meetings || [];
  return {
    ...home,
    upcoming: rows.filter((row) => row.status === 'confirmed' || row.status === 'pending').map(toMeeting),
    history: rows.filter((row) => row.status === 'completed' || row.status === 'cancelled').map(toMeeting),
  };
};

export const useMeetingStats = () => {
  const home = useHome();
  const counts = home.data?.counts;
  const upcoming = (home.data?.all_meetings || []).filter((row) => row.status === 'confirmed' || row.status === 'pending');
  const next = upcoming[0];
  const durations = (home.data?.all_meetings || []).map((row) => row.duration).filter((value) => value > 0);
  const common = durations.sort((a, b) => durations.filter((item) => item === b).length - durations.filter((item) => item === a).length)[0];
  const data: MeetingStats | undefined = counts
    ? {
        totalMeetings: counts.meetings_total || 0,
        upcomingMeetings: counts.meetings_upcoming || 0,
        attendanceRate: counts.attendance_rate ?? null,
        avgDuration: counts.avg_duration_minutes ?? null,
        nextMeeting: next ? { day: next.day || next.date, time: next.time } : undefined,
        mostCommonDuration: common ? `${common} minutes` : '—',
      }
    : undefined;
  return { ...home, data };
};

export const useUpcomingMeetings = () => {
  const records = useMeetingRecords();
  return { ...records, data: records.upcoming };
};

export const useMeetingHistory = () => {
  const records = useMeetingRecords();
  return { ...records, data: records.history };
};

export const useScheduleMeeting = () => {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async (body: { student_usn: string; meeting_date: string; venue: string; agenda: string; duration: number; meeting_mode: string }) => (
      mentorRequest('/api/v1/mentor/meetings', {
        method: 'POST',
        body: JSON.stringify({
          student_usns: [body.student_usn],
          meeting_date: body.meeting_date,
          venue: body.venue,
          agenda: body.agenda,
          duration: body.duration,
          meeting_mode: body.meeting_mode,
        }),
      })
    ),
    onSuccess: () => client.invalidateQueries({ queryKey: ['mentor-home'] }),
  });
};

export const useUpdateMeetingStatus = () => {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async ({ meetingId, status, dateTime }: { meetingId: string; status: string; dateTime?: string }) => (
      mentorRequest(`/api/v1/mentor/meetings/${meetingId}`, {
        method: 'PATCH',
        body: JSON.stringify({ status, meeting_date: dateTime }),
      })
    ),
    onSuccess: () => client.invalidateQueries({ queryKey: ['mentor-home'] }),
  });
};

export const useMeetingsQuery = () => useQuery({
  queryKey: ['mentor-meetings'],
  queryFn: () => mentorRequest('/api/v1/mentor/meetings'),
  refetchInterval: 15000,
});
