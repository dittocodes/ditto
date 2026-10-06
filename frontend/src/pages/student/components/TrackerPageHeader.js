import React from 'react';

export default function TrackerPageHeader({ title, subtitle, actions }) {
  return (
    <div className="tracker-page-header">
      <div>
        <h1 className="tracker-page-title">{title}</h1>
        {subtitle && <p className="tracker-page-sub">{subtitle}</p>}
      </div>
      {actions && <div className="tracker-page-header-actions">{actions}</div>}
    </div>
  );
}
