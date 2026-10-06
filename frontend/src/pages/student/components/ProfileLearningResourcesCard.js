import React from 'react';
import { BookOpen } from 'lucide-react';

function normalizeResources(items) {
  if (!Array.isArray(items)) return [];
  return items.map((r, i) => {
    if (typeof r === 'string') {
      return {
        title: r,
        description: '',
        badge: 'Recommended',
        rating: '',
        key: `res-${i}`,
      };
    }
    return { ...r, key: r.title || `res-${i}` };
  });
}

export default function ProfileLearningResourcesCard({ items }) {
  const resources = normalizeResources(items);

  return (
    <section className="tracker-profile-acad-card tracker-profile-career-resources-card">
      <div className="tracker-profile-acad-card-head">
        <BookOpen size={22} strokeWidth={1.8} aria-hidden />
        <h2>Learning Resources</h2>
      </div>

      <div className="tracker-profile-career-resource-list">
        {resources.map((r) => (
          <div key={r.key} className="tracker-profile-career-resource">
            <div>
              <strong>{r.title}</strong>
              <span>{r.description}</span>
              {r.badge ? <small>{r.badge}</small> : null}
            </div>
            {r.rating ? <b>{r.rating}</b> : null}
          </div>
        ))}
      </div>
    </section>
  );
}
