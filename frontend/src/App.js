import React from 'react';
import { BrowserRouter as Router, Navigate, Routes, Route, useParams } from 'react-router-dom';
import PrivateRoute from './ProtectedRoute';
import LandingPage from './pages/Landing';
import LandingPageMobile from './pages/mobile/Landing';
import './assets/css/MobileResponsive.css';
import './assets/css/PixelOptimized.css';
import Appointments from './pages/mentor/components/Appointments';
import StudentSignup from './pages/auth/StudentSignup';
import Login from './pages/auth/Login';
import Logout from './pages/auth/Logout';
import ForgotPassword from './pages/auth/ForgotPassword';
import MentorDashboard from './pages/mentor/MentorDashboard';
import AssignedStudents from './pages/mentor/components/AssignedStudents';
import ActivityTracking from './pages/mentor/components/ActivityTracking';
import StudentDashboard from './pages/student/StudentDashboard';
import StudentDashboardHome from './pages/student/components/StudentDashboardHome';
import StudentProfile from './pages/student/components/StudentProfile';
import PsychometricForm from './pages/student/components/PsychometricForm';
import ReportPage from './pages/student/components/Report';
import ActivitiesPage from './pages/student/components/Activities';
import StudentLoggedActivities from './pages/student/components/StudentLoggedActivities';
import StudentMeetings from './pages/student/components/Meetings';
import ActivitiesSubmissions from './pages/student/components/ActivitiesSubmission';
import ActivitiesApproval from './pages/mentor/components/ActivityApproval';
import AdminDashboard from './pages/admin/AdminDashboard';
import AdminProfile from './pages/admin/components/AdminProfile';
import AdminActivities from './pages/admin/components/AdminActivities';
import AdminStudents from './pages/admin/components/AdminStudents';
import AdminCounselingDashboard from './pages/admin/components/AdminCounselingDashboard';
import AdminKnowledgeBase from './pages/admin/components/AdminKnowledgeBase';
import AdminCampus from './pages/admin/components/AdminCampus';
import AdminLive from './pages/admin/components/AdminLive';
import AdminDemoPipeline from './pages/admin/components/AdminDemoPipeline';
import LinkPage from './pages/Links';
import TermsOfService from './pages/components/TermsofService';
import PrivacyPolicy from './pages/components/PrivacyPolicy';
import StudentScheduleMeeting from './pages/student/components/Appointments';
import McaForm from './pages/student/components/McaForm'; // <-- Import MCA Form
import GenerateObservation from './pages/student/components/GenerateObservation';
import DownloadMCA from './pages/student/components/DownloadMCA';
import AcademicPerformance from './pages/student/components/AcademicPerformance';
import ExperientialLearning from './pages/student/components/ExperienceLearning';
import PF16Form from './pages/student/components/PF16Form';
import IBPForm from './pages/student/components/IBPForm';
import Counseling from './pages/student/components/Counseling';
import CounselingDashboard from './pages/mentor/components/CounselingDashboard';
import StudentsExperienceLearning from './pages/mentor/components/StudentsExperienceLearning';
import StudentDetailPage from './pages/mentor/components/StudentDetailPage';
import Chatbot from './pages/Chatbot';
import MentorConsolidatedInternalMarks from './pages/mentor/components/MentorConsolidatedInternalMarks';
import MentorDesignHome from './mentor-ui/pages/Index';
import MentorDesignActivities from './mentor-ui/pages/Activities';
import MentorDesignMeetings from './mentor-ui/pages/Meetings';
import MentorDesignChat from './mentor-ui/pages/Chat';
import MentorDesignAttendance from './mentor-ui/pages/Attendance';
import MentorDesignProfile from './mentor-ui/pages/Profile';
import MentorCampus from './mentor-ui/pages/Campus';
import MentorCreateEvent from './mentor-ui/pages/CreateEvent';
import MentorAssistant from './mentor-ui/pages/Assistant';
import MentorChatPage from './pages/student/modules/chat/MentorChatPage';
import StudentAttendance from './pages/student/components/Attendance';
import LeaderDashboard from './pages/leader/LeaderDashboard';
import LeaderStats from './pages/leader/LeaderStats';
import LeaderStudents from './pages/leader/LeaderStudents';
import LeaderMentors from './pages/leader/LeaderMentors';
import WorkingCommitteeDashboard from './pages/workingCommittee/WorkingCommitteeDashboard';
import WorkingCommitteeStats from './pages/workingCommittee/WorkingCommitteeStats';
import WorkingCommitteeDepartments from './pages/workingCommittee/WorkingCommitteeDepartments';
import WorkingCommitteeStudents from './pages/workingCommittee/WorkingCommitteeStudents';
import WorkingCommitteeMentors from './pages/workingCommittee/WorkingCommitteeMentors';
import DepartmentFacultyDashboard from './pages/departmentFaculty/DepartmentFacultyDashboard';
import DepartmentFacultyStats from './pages/departmentFaculty/DepartmentFacultyStats';
import DepartmentFacultyStudents from './pages/departmentFaculty/DepartmentFacultyStudents';
import DepartmentFacultyMentors from './pages/departmentFaculty/DepartmentFacultyMentors';
import HODDashboard from './pages/hod/HODDashboard';
import HODStats from './pages/hod/HODStats';
import HODStudents from './pages/hod/HODStudents';
import ProgramFacultyDashboard from './pages/programFaculty/ProgramFacultyDashboard';
import ProgramFacultyStats from './pages/programFaculty/ProgramFacultyStats';
import ProgramFacultyStudents from './pages/programFaculty/ProgramFacultyStudents';
import ProgramFacultyMentors from './pages/programFaculty/ProgramFacultyMentors';
import TrackerDashboardPage from './pages/student/modules/dashboard/TrackerDashboardPage';
import ProfileDashboardPage from './pages/student/modules/profile/ProfileDashboardPage';
import AnalysisPage from './pages/student/modules/analysis/AnalysisPage';
import SwotFormPage from './pages/student/modules/swot/SwotFormPage';
import SwotReportPage from './pages/student/modules/swot/SwotReportPage';
import TrackerActivitiesPage from './pages/student/modules/activities/TrackerActivitiesPage';
import TrackerMeetingsPage from './pages/student/modules/meetings/TrackerMeetingsPage';
import OnboardingWizardPage from './pages/student/modules/onboarding/OnboardingWizardPage';
import CampusPage from './pages/student/modules/campus/CampusPage';
import ChatPage from './pages/student/modules/chat/ChatPage';
import KnowledgeBasePage from './pages/student/modules/knowledge/KnowledgeBasePage';
import DocumentRecordsPage from './pages/student/modules/knowledge/DocumentRecordsPage';

function CreateProfileRedirect() {
  const { student_usn } = useParams();
  return <Navigate to={`/student/${student_usn}/onboarding`} replace />;
}

const App = () => {
  return (
    <Router>
      <Routes>
        {/* Public Routes */}
        <Route path="/" element={<LandingPage />} />
        <Route path="/mobile" element={<LandingPageMobile />} />
        <Route path="/student_signup" element={<StudentSignup />} />
        <Route path="/login" element={<Login />} />
        <Route path="/forgotpassword" element={<ForgotPassword />} />
        <Route path="/biogred" element={<LinkPage />} />
        <Route path="/logout" element={<Logout />} />
        <Route path="/terms-of-service" element={<TermsOfService />} />
        <Route path="/privacy-policy" element={<PrivacyPolicy />} />

        {/* Mentor Dashboard with Nested Routes */}
        <Route path="/mentor/:mentor_id" element={<PrivateRoute userId="mentor_id" element={<MentorDashboard />} />}>
          <Route index element={<MentorDesignHome />} />
          <Route path="dashboard" element={<MentorDesignHome />} />
          <Route path="profile" element={<MentorDesignProfile />} />
          <Route path="activities" element={<MentorDesignActivities />} />
          <Route path="meetings" element={<MentorDesignMeetings />} />
          <Route path="chat" element={<MentorDesignChat />} />
          <Route path="chat/:student_usn" element={<MentorDesignChat />} />
          <Route path="assistant" element={<MentorAssistant />} />
          <Route path="attendance" element={<MentorDesignAttendance />} />
          <Route path="assigned_students" element={<AssignedStudents />} />
          <Route path="consolidated-internal-marks" element={<MentorConsolidatedInternalMarks />} />
          <Route path="activity_tracking" element={<ActivityTracking />} />
          <Route path="approvals" element={<ActivitiesApproval />} />
          <Route path="appointments" element={<Appointments />} />
          <Route path="counseling" element={<CounselingDashboard />} />
          <Route path="campus" element={<MentorCampus />} />
          <Route path="create-event" element={<MentorCreateEvent />} />
          <Route path="experience_learning" element={<StudentsExperienceLearning />} />
          <Route path="student/:student_usn" element={<StudentDetailPage />} />
        </Route>

        {/* Admin Dashboard with Nested Routes */}
        <Route path="/admin/:admin_id" element={<PrivateRoute userId="admin_id" element={<AdminDashboard />} />}>
          <Route index element={<AdminLive />} />
          <Route path="live" element={<AdminLive />} />
          <Route path="profile" element={<AdminProfile />} />
          <Route path="allstudents" element={<AdminStudents />} />
          <Route path="activities" element={<AdminActivities />} />
          <Route path="counseling" element={<AdminCounselingDashboard />} />
          <Route path="knowledge-base" element={<AdminKnowledgeBase />} />
          <Route path="campus" element={<AdminCampus />} />
          <Route path="demo-pipeline" element={<AdminDemoPipeline />} />
        </Route>

        {/* Student Dashboard with Nested Routes */}
        <Route path="/student/:student_usn" element={<PrivateRoute userId="student_usn" element={<StudentDashboard />} />}>
          <Route index element={<TrackerDashboardPage />} />
          <Route path="dashboard" element={<TrackerDashboardPage />} />
          <Route path="profile" element={<ProfileDashboardPage />} />
          <Route path="analysis" element={<AnalysisPage />} />
          <Route path="swot-form" element={<SwotFormPage />} />
          <Route path="swot-report" element={<SwotReportPage />} />
          <Route path="activities" element={<TrackerActivitiesPage />} />
          <Route path="meetings" element={<TrackerMeetingsPage />} />
          <Route path="onboarding" element={<OnboardingWizardPage />} />
          <Route path="campus" element={<CampusPage />} />
          <Route path="chat" element={<ChatPage />} />
          <Route path="mentor-chat" element={<MentorChatPage />} />
          <Route path="knowledge-base" element={<KnowledgeBasePage />} />
          <Route path="document-records" element={<DocumentRecordsPage />} />
          <Route path="createprofile" element={<CreateProfileRedirect />} />
          <Route path="psychometric" element={<PsychometricForm />} />
          <Route path="mca_form" element={<McaForm />} /> {/* <-- Add this line */}
          <Route path="report" element={<ReportPage />} />
          <Route path="logged_activities" element={<StudentLoggedActivities />} />
          <Route path="scheduled_meetings" element={<StudentMeetings />} />
          <Route path="submissions" element={<ActivitiesSubmissions />} />
          <Route path="appointments" element={<StudentScheduleMeeting />} />
          <Route path="counseling" element={<Counseling />} />
          <Route path="attendance" element={<StudentAttendance />} />
          <Route path="academic-performance" element={<AcademicPerformance />} />
          <Route path="experiential-learning" element={<ExperientialLearning />} />
          <Route path="pf16-form" element={<PF16Form />} />
          <Route path="ibp-form" element={<IBPForm />} />
          <Route path="generate_observation" element={<GenerateObservation />} />
          <Route path="download_mca" element={<DownloadMCA />} />
        </Route>

        {/* Leader Dashboard */}
        <Route path="/leader/:leader_id" element={<PrivateRoute userId="leader_id" requiredRole="leader" element={<LeaderDashboard />} />}>
          <Route index element={<LeaderStats />} />
          <Route path="students" element={<LeaderStudents />} />
          <Route path="mentors" element={<LeaderMentors />} />
        </Route>

        {/* Working Committee Dashboard (second stage: 3 members, each with allocated departments) */}
        <Route path="/working-committee/:member_id" element={<PrivateRoute userId="member_id" requiredRole="working_committee" element={<WorkingCommitteeDashboard />} />}>
          <Route index element={<WorkingCommitteeStats />} />
          <Route path="departments" element={<WorkingCommitteeDepartments />} />
          <Route path="students" element={<WorkingCommitteeStudents />} />
          <Route path="mentors" element={<WorkingCommitteeMentors />} />
        </Route>

        {/* Department Faculty Dashboard */}
        <Route path="/department-faculty/:member_id" element={<PrivateRoute userId="member_id" requiredRole="department_faculty" element={<DepartmentFacultyDashboard />} />}>
          <Route index element={<DepartmentFacultyStats />} />
          <Route path="students" element={<DepartmentFacultyStudents />} />
          <Route path="mentors" element={<DepartmentFacultyMentors />} />
        </Route>

        {/* HOD Dashboard */}
        <Route path="/hod/:member_id" element={<PrivateRoute userId="member_id" requiredRole="hod" element={<HODDashboard />} />}>
          <Route index element={<HODStats />} />
          <Route path="students" element={<HODStudents />} />
        </Route>

        {/* Program Faculty Dashboard */}
        <Route path="/program-faculty/:member_id" element={<PrivateRoute userId="member_id" requiredRole="program_faculty" element={<ProgramFacultyDashboard />} />}>
          <Route index element={<ProgramFacultyStats />} />
          <Route path="students" element={<ProgramFacultyStudents />} />
          <Route path="mentors" element={<ProgramFacultyMentors />} />
        </Route>
      </Routes>
    </Router>
  );
};

export default App;