import React, { useEffect, useState } from 'react';
import { Outlet, useLocation, useNavigate, useParams } from 'react-router-dom';
import TrackerSidebar from './components/TrackerSidebar';
import SupportAssistantWidget from './components/SupportAssistantWidget';
import ProcessingStatusBanner from './components/ProcessingStatusBanner';
import { apiGet } from '../../services/studentV1Api';
import '../../assets/css/tracker-theme.css';
import '../../assets/css/tracker-dashboard-ref.css';

export default function StudentTrackerShell() {
  const { student_usn } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const stored = sessionStorage.getItem('onboarding_complete');
  const [onboardingComplete, setOnboardingComplete] = useState(stored === '1');
  const [checked, setChecked] = useState(stored === '0' || stored === '1');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await apiGet('/api/v1/students/me/onboarding');
        if (cancelled) return;
        const complete = Boolean(data.onboarding_complete);
        sessionStorage.setItem('onboarding_complete', complete ? '1' : '0');
        sessionStorage.setItem('sample_content', data.sample_content ? '1' : '0');
        setOnboardingComplete(complete);
      } catch {
        /* keep the login flag when the status call fails */
      } finally {
        if (!cancelled) setChecked(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [location.pathname]);

  useEffect(() => {
    if (!checked || onboardingComplete) return;
    const path = location.pathname;
    if (!path.endsWith('/onboarding') && !path.endsWith('/knowledge-base') && !path.endsWith('/mentor-chat')) {
      navigate(`/student/${student_usn}/onboarding`, { replace: true });
    }
  }, [checked, onboardingComplete, location.pathname, navigate, student_usn]);

  const locked = checked && !onboardingComplete;

  return (
    <div className={`tracker-app tracker-ref${sidebarCollapsed ? ' sidebar-collapsed' : ''}`}>
      <TrackerSidebar
        collapsed={sidebarCollapsed}
        onToggleCollapse={() => setSidebarCollapsed((c) => !c)}
        locked={locked}
      />
      <main className="tracker-main">
        <ProcessingStatusBanner />
        <Outlet />
      </main>
      {locked || location.pathname.endsWith('/chat') ? null : <SupportAssistantWidget />}
    </div>
  );
}
