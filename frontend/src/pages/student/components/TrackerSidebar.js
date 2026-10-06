import React, { useState } from 'react';
import { NavLink, useParams } from 'react-router-dom';
import {
  FaChartBar,
  FaChevronDown,
  FaChevronUp,
  FaClipboardList,
  FaFileAlt,
  FaHome,
  FaMapMarkerAlt,
  FaSignOutAlt,
  FaTasks,
  FaTimes,
  FaUser,
  FaUserGraduate,
  FaVideo,
  FaComments,
  FaBook,
  FaFolderOpen,
} from 'react-icons/fa';

const primaryNav = [
  { to: 'dashboard', label: 'Dashboard', icon: FaHome },
  { to: 'swot-form', label: 'SWOT Form', icon: FaClipboardList },
  { to: 'swot-report', label: 'SWOT Report', icon: FaFileAlt },
  { to: 'activities', label: 'Activities', icon: FaTasks },
  { to: 'meetings', label: 'Meetings', icon: FaVideo },
  { to: 'mentor-chat', label: 'Mentor', icon: FaComments },
  { to: 'profile', label: 'Profile', icon: FaUser },
  { to: 'knowledge-base', label: 'Documents', icon: FaBook },
  { to: 'document-records', label: 'Records', icon: FaFolderOpen },
  { to: 'analysis', label: 'Analysis', icon: FaChartBar },
];

const moreNav = [
  { to: 'chat', label: 'Ditto', icon: FaComments },
  { to: 'onboarding', label: 'Onboarding', icon: FaUserGraduate },
  { to: 'campus', label: 'Campus', icon: FaMapMarkerAlt },
];

export default function TrackerSidebar({ collapsed, onToggleCollapse, locked = false }) {
  const { student_usn } = useParams();
  const [moreOpen, setMoreOpen] = useState(false);
  const visiblePrimary = locked
    ? [
        { to: 'onboarding', label: 'Onboarding', icon: FaUserGraduate },
        { to: 'knowledge-base', label: 'Documents', icon: FaBook },
        { to: 'mentor-chat', label: 'Mentor', icon: FaComments },
      ]
    : primaryNav;
  const visibleMore = locked ? [] : moreNav;

  const linkClass = ({ isActive }) => `tracker-nav-item${isActive ? ' active' : ''}`;

  return (
    <aside className={`tracker-sidebar${collapsed ? ' collapsed' : ''}`}>
      <div className="tracker-sidebar-brand">
        <div className="tracker-brand-logo-box" aria-hidden>
          <div className="tracker-brand-main">MENTEE</div>
          <div className="tracker-brand-sub">TRACKER</div>
        </div>
        {!collapsed && <span className="tracker-sidebar-title-ref">Tracker</span>}
        <button type="button" className="tracker-sidebar-toggle" onClick={onToggleCollapse} aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}>
          {collapsed ? <FaChevronUp style={{ transform: 'rotate(-90deg)' }} /> : <FaTimes />}
        </button>
      </div>
      <nav className="tracker-sidebar-nav">
        {visiblePrimary.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={`/student/${student_usn}/${to}`}
            className={linkClass}
            title={collapsed ? label : undefined}
          >
            <Icon /> {!collapsed && label}
          </NavLink>
        ))}
        {!collapsed && !locked && (
          <>
            <button type="button" className="tracker-nav-item tracker-nav-more" onClick={() => setMoreOpen((o) => !o)}>
              More {moreOpen ? <FaChevronUp /> : <FaChevronDown />}
            </button>
            {moreOpen && visibleMore.map(({ to, label, icon: Icon }) => (
              <NavLink key={to} to={`/student/${student_usn}/${to}`} className={linkClass}>
                <Icon /> {label}
              </NavLink>
            ))}
          </>
        )}
      </nav>
      <NavLink to="/logout" className="tracker-nav-item tracker-nav-logout" title="Logout">
        <FaSignOutAlt /> {!collapsed && 'Logout'}
      </NavLink>
    </aside>
  );
}
