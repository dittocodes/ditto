export interface DemoMentee { name: string; usn: string; progress: number }
export interface DemoActivity {
  id: string;
  usn: string;
  studentName: string;
  title: string;
  category: string;
  termType: 'Short Term' | 'Mid Term' | 'Long Term';
  deadline: string;
  remarks: string | null;
  completionDays: number | null;
  benefitted: boolean;
  proof: 'Submitted' | 'Partial' | null;
  status: 'pending' | 'in-progress' | 'completed' | 'overdue' | 'rejected';
}
export interface DemoMeeting {
  id: number;
  title: string;
  date: string;
  time: string;
  dateTime: string;
  duration: string;
  location: string;
  attendees: string[];
  attendeeCount: number;
  status: 'confirmed' | 'pending' | 'completed' | 'rescheduled' | 'cancelled';
  isVirtual: boolean;
  agenda?: string;
  notes?: string;
  attended?: boolean;
}

export const demoMentees: DemoMentee[] = [
  'Aishwarya Singh', 'Raj Kumar', 'Priya Shah', 'Vijay Rao', 'Sanjay Patel',
  'Ananya Das', 'Arjun Nair', 'Meera Iyer', 'Rohan Gupta', 'Kavya Menon',
  'Dev Shah', 'Nisha Rao', 'Aditya Kumar', 'Sneha Joshi', 'Kiran Reddy',
  'Pooja Sharma', 'Rahul Verma', 'Divya Nair', 'Akash Singh', 'Neha Gupta',
  'Varun Das', 'Riya Patel', 'Amit Joshi', 'Tara Menon',
].map((name, index) => ({
  name,
  usn: `STU${String(index + 1).padStart(3, '0')}`,
  progress: [92, 87, 68, 65, 42, 95, 91, 86][index % 8],
}));

const categories = [
  ...Array<string>(13).fill('Research'),
  ...Array<string>(10).fill('Technical'),
  ...Array<string>(8).fill('Career'),
  ...Array<string>(5).fill('Soft Skills'),
  ...Array<string>(2).fill('Other'),
];

const activityTitles: Record<string, string[]> = {
  Research: ['Review a research paper', 'Prepare a literature summary', 'Present research findings'],
  Technical: ['Complete a coding challenge', 'Build a portfolio project', 'Practice database queries'],
  Career: ['Update the professional CV', 'Prepare for a technical interview', 'Complete internship reflection'],
  'Soft Skills': ['Present a five-minute talk', 'Lead a study group', 'Write a reflection on teamwork'],
  Other: ['Complete community volunteering', 'Attend a professional workshop'],
};

export const demoActivities: DemoActivity[] = categories.map((category, index) => {
  const mentee = demoMentees[index % demoMentees.length];
  const status: DemoActivity['status'] = index < 18 ? 'completed' : index < 32 ? 'in-progress' : index < 36 ? 'overdue' : 'rejected';
  const titles = activityTitles[category];
  return {
    id: `ACT${String(index + 1).padStart(3, '0')}`,
    usn: mentee.usn,
    studentName: mentee.name,
    title: titles[index % titles.length],
    category,
    termType: (['Short Term', 'Mid Term', 'Long Term'] as const)[index % 3],
    deadline: status === 'overdue' ? '2026-10-03' : `2026-10-${String(12 + (index % 18)).padStart(2, '0')}`,
    remarks: status === 'completed' ? 'Proof reviewed and assessment passed.' : status === 'rejected' ? 'Please revise and resubmit your evidence.' : null,
    completionDays: status === 'completed' ? 7 + (index % 20) : null,
    benefitted: status === 'completed',
    proof: status === 'completed' || status === 'rejected' ? 'Submitted' : index % 2 === 0 ? 'Partial' : null,
    status,
  };
});

const meetingTitles = ['Weekly Progress Review', 'SWOT Analysis Discussion', 'Career Planning Session', 'Activity Submission Feedback'];

export const demoMeetings: DemoMeeting[] = Array.from({ length: 48 }, (_, index) => {
  const upcoming = index < 12;
  const day = upcoming ? 8 + index * 2 : 1 + (index % 28);
  const monthDay = day > 31 ? day - 31 : day;
  const month = upcoming && day > 31 ? '11' : upcoming ? '10' : '09';
  const iso = `2026-${month}-${String(monthDay).padStart(2, '0')}T${index % 2 === 0 ? '10:00' : '14:30'}:00`;
  const date = new Date(iso);
  const mentee = demoMentees[index % demoMentees.length];
  return {
    id: index + 1,
    title: meetingTitles[index % 4],
    dateTime: iso,
    date: date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
    time: date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }),
    duration: `${[30, 45, 60][index % 3]} minutes`,
    location: index % 2 === 0 ? 'Virtual' : 'Department Office',
    attendees: [mentee.usn],
    attendeeCount: 1,
    isVirtual: index % 2 === 0,
    status: upcoming ? (index % 3 === 1 ? 'pending' : 'confirmed') : 'completed',
    agenda: 'Review progress, validate submitted evidence and agree on the next activities.',
    notes: upcoming ? undefined : 'Reviewed progress and recorded the agreed next steps.',
    attended: upcoming ? undefined : index % 12 !== 0,
  };
});

export const menteeName = (usn: string) => demoMentees.find((mentee) => mentee.usn === usn)?.name ?? usn;

export const upcomingDemoMeetings = () => demoMeetings
  .filter((meeting) => meeting.status === 'confirmed' || meeting.status === 'pending' || meeting.status === 'rescheduled')
  .sort((a, b) => a.dateTime.localeCompare(b.dateTime));
