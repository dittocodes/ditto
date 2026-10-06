import React from 'react';
import ProfileAcademicProfileCard from '../../components/ProfileAcademicProfileCard';
import ProfileAttendanceCard from '../../components/ProfileAttendanceCard';
import ProfileAcademicProgressCard from '../../components/ProfileAcademicProgressCard';
import ProfileCompetencyCard from '../../components/ProfileCompetencyCard';

export default function ProfileTabAcademic({ data, studentUsn, uploadFn }) {
  const a = data.academic;
  if (!a || data.blank) return <div className="tracker-card">No academic data yet.</div>;

  return (
    <div className="tracker-profile-academic-layout">
      <div className="tracker-profile-academic-left">
        <ProfileAcademicProfileCard academic={a} uploadFn={uploadFn} />
        <ProfileAttendanceCard items={data.attendance_history} />
      </div>
      <div className="tracker-profile-academic-right">
        <ProfileAcademicProgressCard academic={a} honors={data.honors} />
        <ProfileCompetencyCard competency={data.competency} studentUsn={studentUsn} />
      </div>
    </div>
  );
}
