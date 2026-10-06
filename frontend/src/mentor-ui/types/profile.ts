
export interface MenteeType {
  id: string;
  name: string;
  avatar?: string;
  project: string;
  progress: number;
}

export interface ActivityType {
  id: number;
  title: string;
  date: string;
  menteeCount: number;
  description: string;
  details: Record<string, string>;
  type: string;
}

export interface TimeSlotType {
  startTime: string;
  endTime: string;
}

export interface AvailabilitySlotType {
  day: string;
  slots: TimeSlotType[];
}

export interface EducationType {
  degree: string;
  institution: string;
  year: number;
}

export interface AwardType {
  name: string;
  year: number;
}

export interface PerformanceMetricsType {
  responseRate: number;
  sessionCompletionRate: number;
  feedbackScore: number;
  menteeProgressRate: number;
  researchGuidance: number;
  responseKnown?: boolean;
  sessionKnown?: boolean;
  progressKnown?: boolean;
  attendanceRate?: number | null;
}

export interface MenteeSummaryType {
  totalMenteesGuided: number;
  currentlyActiveMentees: number;
  sessionsCompleted: number;
  upcomingSessions: number;
}

export interface PublicationsType {
  totalPublications: number | null;
  publicationsWithMentees: number | null;
  ongoingResearchProjects: number | null;
  researchGrants: number | null;
}

export interface ProfileType {
  id: number;
  name: string;
  title: string;
  department: string;
  institution: string;
  location: string;
  email: string;
  phone: string;
  verified: boolean;
  rating: number;
  bio: string;
  profileImage: string;
  areasOfExpertise: string[];
  awards: AwardType[];
  education: EducationType[];
  performanceMetrics: PerformanceMetricsType;
  menteeSummary: MenteeSummaryType;
  publications: PublicationsType;
  menteeStats: Record<string, number>;
  publicationsWithMentees: Record<string, number>;
  upcomingDeadlines: { title: string; daysRemaining: number }[];
  performanceData: {
    monthlySessions: number[];
    monthlyProgress: number[];
    months: string[];
  };
  activities: ActivityType[];
  mentees: MenteeType[];
  availabilitySlots: AvailabilitySlotType[];
  sessionMix?: { name: string; value: number }[];
}
