import React, { useEffect, useState } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { FileText, GraduationCap } from 'lucide-react';
import {
  fetchProfile,
  generateCv,
  getUid,
  downloadReport,
  downloadReportPack,
  uploadAcademicDoc,
  uploadCareerDoc,
} from '../../../../services/studentV1Api';
import TrackerFileUpload from '../../components/TrackerFileUpload';
import ProfileSidebarCard from '../../components/ProfileSidebarCard';
import ProfileAchievementsCard from '../../components/ProfileAchievementsCard';
import ProfileSkillsAssessment from '../../components/ProfileSkillsAssessment';
import ProfileTabAcademic from './ProfileTabAcademic';
import ProfileTabCareer from './ProfileTabCareer';
import ProfileTabDocuments from './ProfileTabDocuments';

const TABS = [
  { id: 'overview', label: 'Overview' },
  { id: 'academic', label: 'Academic' },
  { id: 'career', label: 'Career' },
  { id: 'documents', label: 'Documents' },
];

export default function ProfileDashboardPage() {
  const { student_usn } = useParams();
  const [search, setSearch] = useSearchParams();
  const tab = search.get('tab') || 'overview';
  const [data, setData] = useState(null);
  const [uid, setUid] = useState(null);
  const [cvMsg, setCvMsg] = useState('');

  const load = async (activeTab) => {
    const resolved = await getUid();
    setUid(resolved);
    setData(await fetchProfile(resolved, activeTab));
  };

  useEffect(() => {
    load(tab).catch(() => setData(null));
  }, [student_usn, tab]);

  const onGenerateCv = async () => {
    try {
      const resolved = uid || (await getUid());
      const job = await generateCv(resolved);
      setCvMsg(job?.status === 'completed' ? 'CV PDF ready — see Documents tab.' : 'CV generation started…');
      setData(await fetchProfile(resolved, tab));
    } catch (e) {
      setCvMsg(e.message || 'CV generation failed');
    }
  };

  const setTab = (t) => setSearch({ tab: t });

  return (
    <div className="tracker-profile-dashboard">
      <header className="tracker-profile-page-header">
        <div>
          <h1>Profile Dashboard</h1>
          <p>View and manage your personal information and academic progress</p>
        </div>
        <button type="button" className="tracker-profile-generate-cv" onClick={onGenerateCv}>
          <FileText size={19} strokeWidth={1.8} aria-hidden />
          Generate CV
        </button>
      </header>

      {cvMsg && <p className="tracker-profile-cv-msg">{cvMsg}</p>}

      <div className="tracker-profile-tabs">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            className={`tracker-profile-tab${tab === t.id ? ' active' : ''}`}
            onClick={() => setTab(t.id)}
          >
            {t.label}
          </button>
        ))}
      </div>

      {!data ? (
        <div className="tracker-card">Loading…</div>
      ) : (
        <ProfileTabRouter
          tab={tab}
          data={data}
          studentUsn={student_usn}
          uid={uid}
          onGenerateCv={onGenerateCv}
          onReload={() => load(tab)}
          setTab={setTab}
        />
      )}
    </div>
  );
}

function ProfileTabRouter({ tab, data, studentUsn, uid, onGenerateCv, onReload, setTab }) {
  if (tab === 'overview') {
    return (
      <div className="tracker-profile-dashboard-grid">
        <ProfileSidebarCard
          personal={data.personal}
          stats={data.profile_stats}
          studentUsn={studentUsn}
          uid={uid}
          onLinksChange={onReload}
        />
        <div className="tracker-profile-dashboard-right">
          <ProfileAchievementsCard achievements={data.achievements} />
          <ProfileSkillsAssessment skills={data.skill_breakdown} attained={data.attained_skills} />
        </div>
      </div>
    );
  }

  if (tab === 'academic') {
    return (
      <ProfileTabAcademic
        data={data}
        studentUsn={studentUsn}
        uploadFn={uploadAcademicDoc}
      />
    );
  }

  if (tab === 'career') {
    return (
      <ProfileTabCareer
        data={data}
        uploadFn={uploadCareerDoc}
      />
    );
  }

  if (tab === 'documents') {
    return (
      <ProfileTabDocuments
        data={data}
        onGenerateCv={onGenerateCv}
        onDownloadTranscript={async () => {
          const resolved = uid || (await getUid());
          await downloadReport(resolved, 'academic');
        }}
        onDownloadCertificates={async () => {
          const resolved = uid || (await getUid());
          await downloadReport(resolved, 'progress');
        }}
        onDownloadAll={async () => {
          const resolved = uid || (await getUid());
          await downloadReportPack(resolved);
        }}
      />
    );
  }

  return (
    <div className="tracker-profile-placeholder-tab">
      <GraduationCap size={38} aria-hidden />
      <h2>{tab}</h2>
      <p>{tab} information will appear here.</p>
      <button type="button" onClick={() => setTab('overview')}>
        Back to Overview
      </button>
    </div>
  );
}
