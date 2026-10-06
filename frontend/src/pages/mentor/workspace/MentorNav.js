import React, { useState } from 'react';
import { NavLink, useParams } from 'react-router-dom';
import { BarChart2, Calendar, MessageSquare, QrCode, UserCircle, Activity } from 'lucide-react';

const items = [
  { name: 'Dashboard', icon: BarChart2, to: 'dashboard' },
  { name: 'Activities', icon: Activity, to: 'activities' },
  { name: 'Meetings', icon: Calendar, to: 'meetings' },
  { name: 'Mentee Chat', icon: MessageSquare, to: 'chat' },
  { name: 'Attendance', icon: QrCode, to: 'attendance' },
  { name: 'Profile', icon: UserCircle, to: 'profile' },
];

export default function MentorNav() {
  const { mentor_id } = useParams();
  const [open, setOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const base = `/mentor/${mentor_id}`;

  return (
    <aside className={`mentor-nav${collapsed ? ' collapsed' : ''}`}>
      <button type="button" onClick={() => setCollapsed((value) => !value)} aria-label="Toggle navigation">Menu</button>
      <div className="mentor-nav-brand">BIOGRED</div>
      {items.map(({ name, icon: Icon, to }) => (
        <NavLink key={to} to={`${base}/${to}`} className={({ isActive }) => (isActive ? 'active' : undefined)}>
          <Icon size={18} /> <span>{name}</span>
        </NavLink>
      ))}
      <div className="mentor-nav-extra">
        <button type="button" onClick={() => setOpen((value) => !value)}>Account</button>
        {open && (
          <>
            <NavLink to={`${base}/consolidated-internal-marks`}>Internal marks</NavLink>
            <NavLink to={`${base}/counseling`}>Student support</NavLink>
            <NavLink to="/logout">Log out</NavLink>
          </>
        )}
      </div>
    </aside>
  );
}
