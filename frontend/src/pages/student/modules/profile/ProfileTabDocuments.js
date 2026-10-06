import React from 'react';
import {
  Award,
  BookOpen,
  CheckCircle2,
  Download,
  FileText,
  Globe2,
  ScrollText,
} from 'lucide-react';
import '../../../../assets/css/tracker-profile-documents.css';

export default function ProfileTabDocuments({
  data,
  onGenerateCv,
  onDownloadTranscript,
  onDownloadCertificates,
  onDownloadAll,
}) {
  const cv = data.documents?.cv_preview || {};
  const recent = data.documents?.recent || [];
  const skills = (cv.skills || []).slice(0, 6);
  const certifications = cv.certifications || [];
  const experience = cv.experience || [];
  const standards = cv.international_standards || [];

  const handleRecentDownload = (item) => {
    if (item.type === 'transcript' || item.label?.toLowerCase().includes('transcript')) {
      onDownloadTranscript?.();
      return;
    }
    if (item.type === 'cv_pdf' || item.label?.toLowerCase().includes('cv')) {
      onGenerateCv?.();
      return;
    }
    onDownloadTranscript?.();
  };

  return (
    <div className="tracker-profile-documents-layout">
      <div className="tracker-profile-documents-left">
        <div className="tracker-profile-doc-actions-card">
          <div className="tracker-profile-doc-actions-head">
            <FileText size={22} strokeWidth={1.8} aria-hidden />
            <h2>Document Actions</h2>
          </div>
          <div className="tracker-profile-doc-actions-panel">
            <p>Generate &amp; Download Documents</p>
            <button type="button" className="tracker-profile-doc-btn-gold" onClick={onGenerateCv}>
              <FileText size={18} aria-hidden />
              Generate CV
            </button>
            <button type="button" className="tracker-profile-doc-btn-outline" onClick={onDownloadTranscript}>
              <Download size={16} aria-hidden />
              Download Transcript
            </button>
            <button
              type="button"
              className="tracker-profile-doc-btn-outline"
              onClick={onDownloadCertificates || onDownloadTranscript}
            >
              <Download size={16} aria-hidden />
              Download Certificates
            </button>
            {onDownloadAll ? (
              <button type="button" className="tracker-profile-doc-btn-outline" onClick={onDownloadAll}>
                <Download size={16} aria-hidden />
                Download all reports (ZIP)
              </button>
            ) : null}
          </div>
        </div>

        <div className="tracker-profile-doc-recent-card">
          <h3>Recent Documents</h3>
          {recent.map((d) => (
            <div key={`${d.label}-${d.at}`} className="tracker-profile-doc-list-item">
              <span className={`tracker-profile-doc-icon ${d.icon || 'blue'}`}>
                <FileText size={16} aria-hidden />
              </span>
              <div className="tracker-profile-doc-list-copy">
                <strong>{d.label || d.type}</strong>
                <span>{d.at}</span>
              </div>
              <button
                type="button"
                className="tracker-profile-doc-download"
                aria-label={`Download ${d.label}`}
                onClick={() => handleRecentDownload(d)}
              >
                <Download size={18} />
              </button>
            </div>
          ))}
        </div>
      </div>

      <article className="tracker-profile-cv-preview-card">
        <div className="tracker-profile-cv-preview-head">
          <span className="tracker-profile-cv-preview-head-icon" aria-hidden>
            <FileText size={24} strokeWidth={1.8} />
          </span>
          <div>
            <h2>CV Preview</h2>
            <p>Summary of your skills and achievements</p>
          </div>
        </div>

        <section className="tracker-profile-cv-section">
          <h3 className="tracker-profile-cv-section-title">Personal Information</h3>
          <div className="tracker-profile-cv-personal">
            <p><strong>{cv.name || 'Alex Johnson'}</strong></p>
            <p>{cv.email || 'alex.johnson@university.edu'}</p>
            <p>{cv.program_line || `${cv.program || 'Computer Science'}, Year 3`}</p>
            <p>
              Student ID:
              {' '}
              {cv.student_id || data.personal?.usn || '—'}
            </p>
          </div>
        </section>

        {cv.education ? (
          <section className="tracker-profile-cv-section">
            <h3 className="tracker-profile-cv-section-title gold">
              <BookOpen size={18} aria-hidden />
              Education
            </h3>
            <div className="tracker-profile-cv-education">
              <p><strong>{cv.education.degree}</strong></p>
              <p>{cv.education.institution}</p>
              <p>
                GPA:
                {' '}
                {cv.education.gpa}
              </p>
            </div>
          </section>
        ) : null}

        <section className="tracker-profile-cv-section">
          <h3 className="tracker-profile-cv-section-title">Skills</h3>
          <div className="tracker-profile-cv-skills">
            {skills.map((s) => (
              <span key={s.name} className="tracker-profile-cv-skill-pill">
                {s.name}
                {' '}
                (
                {s.pct}
                %)
              </span>
            ))}
          </div>
        </section>

        <section className="tracker-profile-cv-section">
          <h3 className="tracker-profile-cv-section-title gold">
            <Award size={18} aria-hidden />
            Certifications
          </h3>
          <ul className="tracker-profile-cv-cert-list">
            {certifications.map((c) => (
              <li key={c}>
                <Award size={16} strokeWidth={2} aria-hidden />
                {c}
              </li>
            ))}
          </ul>
        </section>

        <section className="tracker-profile-cv-section">
          <h3 className="tracker-profile-cv-section-title">Experience</h3>
          {experience.map((e) => (
            <div key={`${e.title}-${e.org}`} className="tracker-profile-cv-exp-block">
              <strong>{e.title}</strong>
              <div className="tracker-profile-cv-exp-org">{e.org}{e.when ? ` · ${e.when}` : ''}</div>
              {(e.bullets || []).map((b) => (
                <div key={b} className="tracker-profile-cv-exp-bullet">
                  <CheckCircle2 size={16} strokeWidth={2.2} aria-hidden />
                  {b}
                </div>
              ))}
            </div>
          ))}
        </section>

        <section className="tracker-profile-cv-section">
          <h3 className="tracker-profile-cv-section-title">International Standards</h3>
          <div className="tracker-profile-cv-standards">
            {standards.map((row) => (
              <div key={row.label} className="tracker-profile-cv-standard-row">
                {row.icon === 'doc' ? (
                  <ScrollText size={18} aria-hidden />
                ) : (
                  <Globe2 size={18} aria-hidden />
                )}
                {row.label}
              </div>
            ))}
          </div>
        </section>
      </article>
    </div>
  );
}
