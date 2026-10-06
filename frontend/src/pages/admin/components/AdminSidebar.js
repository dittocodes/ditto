import React from 'react';
import { Link, useParams } from 'react-router-dom';
import '../../../assets/css/AdminSidebar.css';
import { FaUser, FaClipboardList, FaChartLine, FaComments, FaBook, FaBolt } from 'react-icons/fa';

const AdminSidebar = () => {
  const { admin_id } = useParams(); // Fetch the admin_id from the URL
  return (
    <div className="admin-sidebar__container">
      <Link to={`/admin/${admin_id}/profile`}>
        <div className="admin-sidebar-logo-left"></div>
      </Link>
      <ul className="admin-sidebar__menu">
        <li>
          <Link to={`/admin/${admin_id}/live`} className="admin-sidebar__menu-item">
            <FaBolt />&nbsp;&nbsp;&nbsp;&nbsp;Live
          </Link>
        </li>
        <li>
          <Link to={`/admin/${admin_id}/activities`} className="admin-sidebar__menu-item">
            <FaClipboardList />&nbsp;&nbsp;&nbsp;&nbsp;Activities
          </Link>
        </li>

        {/* Activity Tracking */}
        <li>
          <Link to={`/admin/${admin_id}/allstudents`} className="admin-sidebar__menu-item">
            <FaChartLine />&nbsp;&nbsp;&nbsp;&nbsp;Students
          </Link>
        </li>

        {/* Counseling Oversight */}
        <li>
          <Link to={`/admin/${admin_id}/counseling`} className="admin-sidebar__menu-item">
            <FaComments />&nbsp;&nbsp;&nbsp;&nbsp;Student Support
          </Link>
        </li>

        <li>
          <Link to={`/admin/${admin_id}/demo-pipeline`} className="admin-sidebar__menu-item">
            <FaBook />&nbsp;&nbsp;&nbsp;&nbsp;Demo pipeline
          </Link>
        </li>

        <li>
          <Link to={`/admin/${admin_id}/knowledge-base`} className="admin-sidebar__menu-item">
            <FaBook />&nbsp;&nbsp;&nbsp;&nbsp;Knowledge Base
          </Link>
        </li>

        <li>
          <Link to={`/admin/${admin_id}/campus`} className="admin-sidebar__menu-item">
            <FaClipboardList />&nbsp;&nbsp;&nbsp;&nbsp;Campus
          </Link>
        </li>

        {/* Profile */}
        <li>
          <Link to={`/admin/${admin_id}/profile`} className="admin-sidebar__menu-item">
            <FaUser />&nbsp;&nbsp;&nbsp;&nbsp;Profile
          </Link>
        </li>
      </ul>
    </div>
  );
};

export default AdminSidebar;
