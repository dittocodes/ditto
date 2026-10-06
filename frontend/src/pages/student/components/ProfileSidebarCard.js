import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Award,
  BookOpen,
  Building2,
  Calendar,
  CheckCircle2,
  Clock3,
  ExternalLink,
  Mail,
  MapPin,
  Phone,
  ShieldCheck,
  Smartphone,
  User,
  UserRoundCheck,
} from 'lucide-react';
import { addStudentLink } from '../../../services/studentV1Api';

function initials(name, fallback) {
  if (!name) return fallback || '??';
  const parts = String(name).trim().split(/\s+/);
  if (parts.length >= 2) return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
  return name.slice(0, 2).toUpperCase();
}

function InfoBlock({ title, children }) {
  return (
    <section className="tracker-profile-info-section">
      <h3>{title}</h3>
      <div className="tracker-profile-info-list">{children}</div>
    </section>
  );
}

function InfoRow({ icon: Icon, children }) {
  return (
    <div className="tracker-profile-info-row">
      {Icon && <Icon size={18} strokeWidth={1.8} aria-hidden />}
      <span>{children}</span>
    </div>
  );
}

export default function ProfileSidebarCard({ personal, stats, studentUsn, uid, onLinksChange }) {
  const p = personal || {};
  const contact = p.contact || {};
  const academic = p.academic || {};
  const location = p.location || {};
  const [adding, setAdding] = useState(false);

  const onAddLink = async () => {
    if (!uid) return;
    const url = window.prompt('Link URL (https://...)');
    if (!url) return;
    const type = window.prompt('Type (linkedin, portfolio, github)', 'portfolio') || 'portfolio';
    setAdding(true);
    try {
      await addStudentLink(uid, type, url);
      onLinksChange?.();
    } catch (e) {
      window.alert(e.message || 'Could not add link');
    } finally {
      setAdding(false);
    }
  };

  const tags = p.tags || [];
  const showTop = tags.includes('Top Performer') || p.top_performer;
  const showVerified = p.verified || tags.includes('Verified');

  return (
    <div className="tracker-profile-sidebar-card">
      <div className="tracker-profile-hero">
        <div className="tracker-profile-identity">
          <div className="tracker-profile-avatar-wrap">
            <div className="tracker-profile-avatar">{p.initials || initials(p.name)}</div>
            {showVerified && (
              <span className="tracker-profile-avatar-verified" title="Verified">
                <CheckCircle2 size={17} strokeWidth={2.5} aria-hidden />
              </span>
            )}
          </div>
          <div className="tracker-profile-identity-text">
            <h2>{p.name}</h2>
            <p>{p.program_line || p.program}</p>
            <div className="tracker-profile-identity-badges">
              {showTop && (
                <span className="tracker-profile-badge performer">
                  <Award size={14} strokeWidth={2} aria-hidden />
                  Top Performer
                </span>
              )}
              {showVerified && (
                <span className="tracker-profile-badge verified">
                  <ShieldCheck size={14} strokeWidth={2} aria-hidden />
                  Verified
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      {stats && stats.length > 0 && (
        <div className="tracker-profile-quick-stats">
          {stats.map((s) => (
            <div key={s.label} className="tracker-profile-quick-stat">
              <span>{s.label}</span>
              <strong>{s.value}</strong>
            </div>
          ))}
        </div>
      )}

      <InfoBlock title="Contact Information">
        <InfoRow icon={Mail}>{contact.email || p.email || '—'}</InfoRow>
        <InfoRow icon={Phone}>{contact.phone || '—'}</InfoRow>
        {contact.phone_alt && <InfoRow icon={Smartphone}>{contact.phone_alt}</InfoRow>}
      </InfoBlock>

      <InfoBlock title="Academic Information">
        <InfoRow icon={User}>ID: {academic.student_id || p.usn}</InfoRow>
        <InfoRow icon={Building2}>{academic.department || p.program}</InfoRow>
        <InfoRow icon={BookOpen}>{academic.year_label || academic.year}</InfoRow>
        <InfoRow icon={UserRoundCheck}>Mentor: {academic.mentor || p.mentor}</InfoRow>
      </InfoBlock>

      <InfoBlock title="Location & Status">
        <InfoRow icon={MapPin}>Location: {location.campus || '—'}</InfoRow>
        <InfoRow icon={Calendar}>Joined: {location.joined || '—'}</InfoRow>
        <InfoRow icon={Clock3}>Last Login: {location.last_login || '—'}</InfoRow>
      </InfoBlock>

      <section className="tracker-profile-external-section">
        <div className="tracker-profile-external-head">
          <span className="tracker-profile-external-title">
            <ExternalLink size={17} strokeWidth={1.8} aria-hidden />
            <strong>External Links</strong>
          </span>
          {uid ? (
            <button type="button" className="tracker-profile-add-link" disabled={adding} onClick={onAddLink}>
              Add Link
            </button>
          ) : null}
        </div>
        <div className="tracker-profile-link-tags">
          {(p.links || []).map((l, index) =>
            l.url ? (
              <a key={l.id || `${l.type || l.label}-${index}`} href={l.url} target="_blank" rel="noreferrer">
                {l.label}
              </a>
            ) : (
              <span key={`${l.label}-${index}`}>{l.label}</span>
            )
          )}
        </div>
      </section>

      <div className="tracker-profile-action-buttons">
        <Link to={`/student/${studentUsn}/createprofile`} className="tracker-profile-btn edit">
          Edit Profile
        </Link>
        <Link to="/change-password" className="tracker-profile-btn password">
          Update Password
        </Link>
      </div>
    </div>
  );
}
