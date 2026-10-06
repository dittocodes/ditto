import React, { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { fetchKnowledge } from '../../../../services/studentV1Api';
import TrackerActivityCard from '../../components/TrackerActivityCard';

export default function DocumentRecordsPage() {
  const { student_usn } = useParams();
  const [items, setItems] = useState([]);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchKnowledge()
      .then((data) => setItems(data.items || []))
      .catch((err) => setError(err.message || 'Could not load document records'));
  }, []);

  return (
    <div>
      <h1 className="tracker-page-title">Records</h1>
      <p className="tracker-page-sub">
        Certificates, marksheets, and career files read from your uploads. Mentor tasks and SWOT activities stay on Activities.
      </p>
      {error ? <div className="tracker-card">{error}</div> : null}
      {!error && !items.length ? (
        <div className="tracker-card">
          No document records yet. Add a file from <Link to={`/student/${student_usn}/knowledge-base`}>Documents</Link>.
        </div>
      ) : null}
      <div className="tracker-activity-grid">
        {items.map((item) => {
          const issuer = item.issuer || item.chips?.find((chip) => chip.label === 'Issuer')?.value;
          const ready = item.pipeline === 'verified' || item.pipeline === 'stored';
          return (
            <TrackerActivityCard
              key={item.id}
              activity={{
                title: item.title,
                description: issuer ? `Issued by ${issuer}` : item.filename,
                status: ready ? 'completed' : item.pipeline,
                status_tag: ready ? 'Added' : (item.pipeline === 'failed' ? 'Could not read' : 'Pending review'),
                term_tag: 'Document',
                progress_pct: ready ? 100 : 0,
                icon: ready ? 'completed' : 'pending',
                source: 'document',
              }}
              detailsHref={item.view_url || `/student/${student_usn}/knowledge-base`}
            />
          );
        })}
      </div>
    </div>
  );
}
