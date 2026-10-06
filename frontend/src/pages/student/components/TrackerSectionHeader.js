import React from 'react';
import { FaInfoCircle } from 'react-icons/fa';

export default function TrackerSectionHeader({
  title,
  subtitle,
  icon: Icon,
  showInfo = false,
  onInfoClick,
  action,
  pagination,
}) {
  const pager = pagination;
  return (
    <div className="tracker-section-header">
      <div className="tracker-section-header-left">
        {Icon && <Icon className="tracker-section-icon" aria-hidden />}
        <div>
          <h3 className="tracker-section-title">{title}</h3>
          {subtitle && <p className="tracker-section-subtitle">{subtitle}</p>}
        </div>
      </div>
      <div className="tracker-section-header-right">
        {pager && pager.pageCount > 1 && (
          <div className="tracker-section-pager" aria-label="Section pagination">
            <button
              type="button"
              disabled={pager.pageIndex <= 0}
              onClick={() => pager.onPageChange(pager.pageIndex - 1)}
              aria-label="Previous page"
            >
              ‹
            </button>
            <span>
              {pager.pageIndex + 1}
              {' / '}
              {pager.pageCount}
            </span>
            <button
              type="button"
              disabled={pager.pageIndex >= pager.pageCount - 1}
              onClick={() => pager.onPageChange(pager.pageIndex + 1)}
              aria-label="Next page"
            >
              ›
            </button>
          </div>
        )}
        {action}
        {showInfo && (
          <button type="button" className="tracker-section-info" aria-label="More information" onClick={onInfoClick}>
            <FaInfoCircle />
          </button>
        )}
      </div>
    </div>
  );
}
