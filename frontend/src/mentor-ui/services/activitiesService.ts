import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { mentorRequest } from './api';
import { ActivityRow } from './dashboardService';

export type Activity = ActivityRow;

const termValue = (term: Activity['termType']) => (
  term === 'Mid Term' ? 'mid-term' : term === 'Long Term' ? 'long-term' : 'short-term'
);

export const useActivitiesData = () => useQuery({
  queryKey: ['activities'],
  queryFn: () => mentorRequest('/api/v1/mentor/activities') as Promise<Activity[]>,
  refetchInterval: 15000,
});

export interface ActivityRequest {
  id: number;
  title: string;
  description: string;
  term: string;
  student_name: string;
  usn: string;
}

export const useActivityRequests = () => useQuery({
  queryKey: ['activity-requests'],
  queryFn: () => mentorRequest('/api/v1/mentor/activity-requests') as Promise<ActivityRequest[]>,
  refetchInterval: 15000,
});

export const useDecideRequest = () => {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, decision, term }: { id: number; decision: 'approve' | 'reject'; term?: string }) => (
      mentorRequest(`/api/v1/mentor/activity-requests/${id}/${decision}`, {
        method: 'POST',
        body: JSON.stringify({ term: term || 'short-term' }),
      })
    ),
    onSuccess: () => {
      client.invalidateQueries({ queryKey: ['activity-requests'] });
      client.invalidateQueries({ queryKey: ['activities'] });
      client.invalidateQueries({ queryKey: ['mentor-home'] });
    },
  });
};

export const useSaveActivity = () => {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async (activity: Activity) => {
      const body = {
        student_usn: activity.usn,
        title: activity.title,
        category: activity.category,
        term: termValue(activity.termType),
        due_date: activity.deadline,
        status: activity.status,
        mentor_remarks: activity.remarks,
      };
      if (activity.numeric_id) {
        return mentorRequest(`/api/v1/mentor/activities/${activity.numeric_id}`, {
          method: 'PATCH',
          body: JSON.stringify(body),
        });
      }
      return mentorRequest('/api/v1/mentor/activities', { method: 'POST', body: JSON.stringify(body) });
    },
    onSuccess: () => {
      client.invalidateQueries({ queryKey: ['activities'] });
      client.invalidateQueries({ queryKey: ['mentor-home'] });
    },
  });
};
