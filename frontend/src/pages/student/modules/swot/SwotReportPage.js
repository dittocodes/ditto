import React, { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { FaFileAlt } from 'react-icons/fa';
import { apiGet, getUid } from '../../../../services/studentV1Api';

const LABELS = { S: 'Strengths', W: 'Weaknesses', O: 'Opportunities', T: 'Threats' };

export default function SwotReportPage() {
  const { student_usn } = useParams();
  const [report, setReport] = useState(null);

  useEffect(() => {
    (async () => {
      const uid = await getUid();
      setReport(await apiGet(`/api/v1/students/${uid}/swot`));
    })();
  }, [student_usn]);

  if (report?.empty) {
    return (
      <div className="tracker-card" style={{ textAlign: 'center', padding: '4rem' }}>
        <div className="tracker-swot-empty-icon" aria-hidden>
          <FaFileAlt />
        </div>
        <h2>No SWOT Report Available</h2>
        <p>You haven&apos;t created a SWOT analysis yet. Please complete the SWOT form to generate your report.</p>
        <Link to={`/student/${student_usn}/swot-form`} className="tracker-btn-primary" style={{ display: 'inline-block', marginTop: 16, textDecoration: 'none' }}>
          Create SWOT Analysis
        </Link>
      </div>
    );
  }

  const state = report?.structured_state || {};
  const lists = {
    S: state.strengths || [],
    W: state.weaknesses || [],
    O: state.opportunities || [],
    T: state.threats || [],
  };

  return (
    <div>
      <h1 className="tracker-page-title">SWOT Report</h1>
      <p className="tracker-page-sub">{report?.narrative || 'Your personalized SWOT analysis'}</p>
      <div className="tracker-swot-grid">
        {(['S', 'W', 'O', 'T']).map((key) => (
          <div key={key} className={`tracker-swot-quadrant ${key.toLowerCase()}`}>
            <h3>{LABELS[key]}</h3>
            <ul style={{ margin: 0, paddingLeft: 18 }}>
              {(lists[key] || []).map((item, i) => (
                <li key={i} style={{ marginBottom: 6 }}>{String(item)}</li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      <Link to={`/student/${student_usn}/swot-form`} className="tracker-btn-primary" style={{ display: 'inline-block', marginTop: 16, textDecoration: 'none' }}>
        Update SWOT
      </Link>
    </div>
  );
}
