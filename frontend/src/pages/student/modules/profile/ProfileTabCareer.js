import React from 'react';
import ProfileCareerProfileCard from '../../components/ProfileCareerProfileCard';
import ProfileCareerAnalyticsCard from '../../components/ProfileCareerAnalyticsCard';
import ProfileLearningResourcesCard from '../../components/ProfileLearningResourcesCard';

export default function ProfileTabCareer({ data, uploadFn }) {
  const c = data.career;
  if (!c || data.blank) return <div className="tracker-card">No career data yet.</div>;

  return (
    <div className="tracker-profile-career-layout">
      <div className="tracker-profile-career-left">
        <ProfileCareerProfileCard career={c} />
      </div>
      <div className="tracker-profile-career-right">
        <ProfileCareerAnalyticsCard career={c} uploadFn={uploadFn} />
        <ProfileLearningResourcesCard items={c.learning_resources} />
      </div>
    </div>
  );
}
