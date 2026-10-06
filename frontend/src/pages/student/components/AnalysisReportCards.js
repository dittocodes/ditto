import React from 'react';
import {
  Activity,
  Download,
  FileText,
  TrendingUp,
  Award,
} from 'lucide-react';

const REPORT_META = {
  swot: { icon: FileText, color: 'yellow' },
  progress: { icon: TrendingUp, color: 'blue' },
  academic: { icon: Award, color: 'purple' },
  skills: { icon: Activity, color: 'green' },
};

const DEFAULT_CARDS = [
  {
    type: 'swot',
    title: 'SWOT Analysis Report',
    description: 'Complete SWOT report with detailed analysis',
    color: 'yellow',
  },
  {
    type: 'progress',
    title: 'Progress Report',
    description: 'Detailed progress tracking over time',
    color: 'blue',
  },
  {
    type: 'academic',
    title: 'Academic Performance',
    description: 'Academic progress and grade analysis',
    color: 'purple',
  },
  {
    type: 'skills',
    title: 'Skills Assessment',
    description: 'Comprehensive skills evaluation',
    color: 'green',
  },
];

export default function AnalysisReportCards({ reportCards, onDownload, busyType }) {
  const source = Array.isArray(reportCards) && reportCards.length ? reportCards : DEFAULT_CARDS;
  const cards = source.map((c) => ({
    ...c,
    description: c.description || DEFAULT_CARDS.find((d) => d.type === c.type)?.description || '',
    color: c.color || REPORT_META[c.type]?.color || 'blue',
  }));

  return (
    <div className="tracker-analysis-report-grid">
      {cards.map((card) => {
        const meta = REPORT_META[card.type] || { icon: FileText, color: card.color };
        const Icon = meta.icon;
        const tone = card.color || meta.color;
        return (
          <article key={card.type} className={`tracker-analysis-report-card tone-${tone}`}>
            <div className="tracker-analysis-report-card-top">
              <div className="tracker-analysis-report-copy">
                <h3>{card.title}</h3>
                <p>{card.description}</p>
              </div>
              <span className={`tracker-analysis-report-icon tone-${tone}`} aria-hidden>
                <Icon size={22} strokeWidth={2} />
              </span>
            </div>
            <button
              type="button"
              className={`tracker-analysis-report-download tone-${tone}`}
              disabled={busyType === card.type}
              onClick={() => onDownload(card.type)}
            >
              <Download size={18} strokeWidth={2} aria-hidden />
              {busyType === card.type ? 'Generating…' : 'Download Report'}
            </button>
          </article>
        );
      })}
    </div>
  );
}
