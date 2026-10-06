import { ProfileType } from '@/types/profile';
import { mentorRequest } from './api';
import { LiveHome } from './dashboardService';

interface ProfileBody {
  profile: {
    name?: string;
    title?: string;
    department?: string;
    institution?: string;
    location?: string;
    email?: string;
    phone?: string;
    bio?: string;
    expertise?: { name?: string }[] | string[];
    education?: { degree?: string; name?: string; institution?: string; year?: number | string }[];
    awards?: { name?: string; year?: number | string }[];
    publications?: { name?: string }[] | string[];
  };
  statistics?: LiveHome;
}

const names = (items: { name?: string }[] | string[] | undefined) => (items || []).map((item) => (
  typeof item === 'string' ? item : item.name || ''
)).filter(Boolean);

const yearOf = (value: number | string | undefined) => {
  const year = Number(value);
  return Number.isFinite(year) ? year : 0;
};

const profileService = {
  getProfileData: async (): Promise<ProfileType> => {
    const body = await mentorRequest('/api/v1/mentor/profile') as ProfileBody;
    const profile = body.profile || {};
    const stats = body.statistics;
    const metrics = stats?.profile_metrics || {};
    const monthly = stats?.monthly || { months: [], sessions: [], progress: [] };
    return {
      id: 1,
      name: profile.name || 'Mentor',
      title: profile.title || profile.department || 'Mentor',
      department: profile.department || '',
      institution: profile.institution || '',
      location: profile.location || '',
      email: profile.email || '',
      phone: profile.phone || '',
      verified: true,
      rating: 0,
      bio: profile.bio || '',
      profileImage: '',
      areasOfExpertise: names(profile.expertise),
      awards: (profile.awards || []).map((item) => ({ name: item.name || 'Award', year: yearOf(item.year) })),
      education: (profile.education || []).map((item) => ({
        degree: item.degree || item.name || 'Education',
        institution: item.institution || '',
        year: yearOf(item.year),
      })),
      performanceMetrics: {
        responseRate: metrics.response_rate ?? 0,
        sessionCompletionRate: metrics.session_completion_rate ?? 0,
        feedbackScore: 0,
        menteeProgressRate: metrics.mentee_progress_rate ?? 0,
        researchGuidance: 0,
        responseKnown: metrics.response_rate != null,
        sessionKnown: metrics.session_completion_rate != null,
        progressKnown: metrics.mentee_progress_rate != null,
        attendanceRate: metrics.attendance_rate ?? null,
      },
      menteeSummary: {
        totalMenteesGuided: stats?.summary?.active || 0,
        currentlyActiveMentees: stats?.summary?.active || 0,
        sessionsCompleted: stats?.summary?.sessions_completed || 0,
        upcomingSessions: stats?.summary?.upcoming || 0,
      },
      publications: {
        totalPublications: names(profile.publications).length,
        publicationsWithMentees: null,
        ongoingResearchProjects: null,
        researchGrants: null,
      },
      menteeStats: {},
      publicationsWithMentees: {},
      upcomingDeadlines: (stats?.activities || [])
        .filter((item) => item.deadline && item.status !== 'completed')
        .slice(0, 5)
        .map((item) => ({ title: item.title, daysRemaining: 0 })),
      performanceData: {
        monthlySessions: monthly.sessions,
        monthlyProgress: monthly.progress,
        months: monthly.months,
      },
      sessionMix: stats?.session_mix || [],
      activities: (stats?.activities || []).slice(0, 8).map((item) => ({
        id: item.numeric_id,
        title: item.title,
        date: item.deadline || '',
        menteeCount: 1,
        description: item.studentName,
        details: { Category: item.category, Status: item.status },
        type: 'document',
      })),
      mentees: (stats?.students || []).map((student) => ({
        id: student.usn,
        name: student.name,
        progress: student.progress ?? 0,
        project: student.program || 'Assigned mentee',
      })),
      availabilitySlots: [],
    };
  },

  updateProfile: async (data: Record<string, unknown>) => mentorRequest('/api/v1/mentor/profile', {
    method: 'PATCH',
    body: JSON.stringify(data),
  }),
};

export default profileService;
