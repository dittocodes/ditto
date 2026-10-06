import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { BarChart3, CirclePlus, Filter, SlidersHorizontal } from 'lucide-react';
import { apiGet, getUid, patchActivity, uploadActivityEvidence } from '../../../../services/studentV1Api';
import TrackerActivityCard from '../../components/TrackerActivityCard';
import TrackerPageHeader from '../../components/TrackerPageHeader';

const STATUS_TABS = [
  { id: 'all', label: 'All' },
  { id: 'pending', label: 'Pending' },
  { id: 'completed', label: 'Completed' },
  { id: 'overdue', label: 'Overdue' },
];

const STATUS_FILTER_OPTIONS = [
  { value: 'all', label: 'Status' },
  { value: 'pending', label: 'Pending' },
  { value: 'in_progress', label: 'In Progress' },
  { value: 'completed', label: 'Completed' },
  { value: 'overdue', label: 'Overdue' },
];

const TYPE_FILTER_OPTIONS = [
  { value: 'all', label: 'Type' },
  { value: 'short-term', label: 'Short-term' },
  { value: 'mid-term', label: 'Mid-term' },
  { value: 'long-term', label: 'Long-term' },
];

export default function TrackerActivitiesPage() {
  const { student_usn } = useParams();
  const [items, setItems] = useState([]);
  const [tab, setTab] = useState('all');
  const [q, setQ] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState('all');
  const [detail, setDetail] = useState(null);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [actionsOpen, setActionsOpen] = useState(false);
  const actionsRef = useRef(null);

  const load = async () => {
    const uid = await getUid();
    setItems(await apiGet(`/api/v1/students/${uid}/activities`));
  };

  useEffect(() => {
    load();
  }, [student_usn]);

  const handleProgressSave = async (activity, body) => {
    const uid = await getUid();
    await patchActivity(uid, activity.id, body);
    await load();
  };

  const handleEvidenceUpload = async (activity, file) => {
    const uid = await getUid();
    await uploadActivityEvidence(uid, activity.id, file);
    await load();
  };

  const filtered = useMemo(() => {
    const now = Date.now();
    return items.filter((a) => {
      if (a.origin === 'student_request' && (a.status === 'requested' || a.status === 'rejected')) return false;

      const status = (a.status || '').toLowerCase();
      const isOverdue = status !== 'completed' && a.due_date && new Date(a.due_date).getTime() < now;

      if (tab === 'overdue') {
        if (!isOverdue) return false;
      } else if (tab === 'pending' && status !== 'pending') {
        return false;
      } else if (tab === 'completed' && status !== 'completed') {
        return false;
      } else if (tab !== 'all' && tab !== 'overdue' && status !== tab) {
        return false;
      }

      if (statusFilter === 'overdue') {
        if (!isOverdue) return false;
      } else if (statusFilter !== 'all' && status !== statusFilter) {
        return false;
      }

      const termKey = (a.term_type || a.term || '').toLowerCase();
      if (typeFilter !== 'all' && termKey !== typeFilter) return false;

      if (q && !(`${a.title} ${a.description}`).toLowerCase().includes(q.toLowerCase())) return false;
      return true;
    });
  }, [items, tab, q, statusFilter, typeFilter]);

  useEffect(() => {
    if (!actionsOpen) return undefined;
    const onDoc = (e) => {
      if (actionsRef.current && !actionsRef.current.contains(e.target)) {
        setActionsOpen(false);
      }
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [actionsOpen]);

  const headerActions = (
    <div className="tracker-activities-header-actions">
      <button
        type="button"
        className={`tracker-activities-toolbar-btn${filtersOpen ? ' active' : ''}`}
        onClick={() => setFiltersOpen((v) => !v)}
      >
        <SlidersHorizontal size={18} strokeWidth={2} aria-hidden />
        Filters
      </button>
      <Link
        to={`/student/${student_usn}/submissions`}
        className="tracker-activities-toolbar-btn primary"
      >
        <CirclePlus size={18} strokeWidth={2} aria-hidden />
        Request Activity
      </Link>
      <div className="tracker-activities-actions-wrap" ref={actionsRef}>
        <button
          type="button"
          className={`tracker-activities-toolbar-btn${actionsOpen ? ' active' : ''}`}
          onClick={() => setActionsOpen((v) => !v)}
        >
          <BarChart3 size={18} strokeWidth={2} aria-hidden />
          Actions
        </button>
        {actionsOpen ? (
          <div className="tracker-activities-actions-menu" role="menu">
            <button type="button" role="menuitem" onClick={() => { setTab('all'); setActionsOpen(false); }}>
              Show all activities
            </button>
            <button type="button" role="menuitem" onClick={() => { setStatusFilter('in_progress'); setFiltersOpen(true); setActionsOpen(false); }}>
              Focus in progress
            </button>
          </div>
        ) : null}
      </div>
    </div>
  );

  return (
    <div className="tracker-activities-page">
      <div className="tracker-activities-top-bar">
        <TrackerPageHeader
          title="Activities"
          subtitle="Mentor tasks and SWOT activities. Certificates and marksheets are under Records."
          actions={headerActions}
        />
      </div>

      <div className="tracker-activities-tabs">
        {STATUS_TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            className={`tracker-activities-tab${tab === t.id ? ' active' : ''}`}
            onClick={() => setTab(t.id)}
          >
            {t.label}
          </button>
        ))}
      </div>

      {filtersOpen ? (
      <div className="tracker-activities-filter-row">
        <input
          className="tracker-activities-search"
          placeholder="Search activities..."
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <label className="tracker-activities-select-wrap">
          <Filter size={16} aria-hidden />
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
            {STATUS_FILTER_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </label>
        <label className="tracker-activities-select-wrap">
          <Filter size={16} aria-hidden />
          <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)}>
            {TYPE_FILTER_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </label>
      </div>
      ) : null}

      <div className="tracker-activity-grid tracker-activity-grid-mock">
        {filtered.map((a) => (
          <TrackerActivityCard
            key={a.id}
            activity={a}
            onDetails={setDetail}
            onProgressSave={handleProgressSave}
            onEvidenceUpload={handleEvidenceUpload}
          />
        ))}
      </div>

      {!filtered.length && <div className="tracker-card">No activities match your filters.</div>}

      {detail && (
        <div className="tracker-card" style={{ marginTop: 16 }}>
          <h3>{detail.title}</h3>
          <p>{detail.description}</p>
          <button type="button" className="tracker-tab" onClick={() => setDetail(null)}>Close</button>
        </div>
      )}
    </div>
  );
}
