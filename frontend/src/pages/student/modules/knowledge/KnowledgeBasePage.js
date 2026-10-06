import React, { useEffect, useMemo, useState } from 'react';
import {
  fetchKnowledge,
  getUid,
  updateKnowledgeCategory,
  uploadKnowledgeDoc,
} from '../../../../services/studentV1Api';
import './knowledge-vault.css';

const GROUPS = [
  { id: 'academic', label: 'Academic' },
  { id: 'certificate', label: 'Certifications' },
  { id: 'career', label: 'Career' },
  { id: 'activity', label: 'Campus proofs' },
  { id: 'uncategorised', label: 'Still being read' },
];

const MONTHS = {
  jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6,
  jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12,
};

const pipelineLabel = {
  verified: 'Verified',
  stored: 'Stored',
  reading: 'Pending review',
  failed: 'Could not read',
};

const groupLabel = (id) => GROUPS.find((group) => group.id === id)?.label || 'Documents';

function parseWhen(value) {
  const text = String(value || '').trim();
  if (!text) return null;
  const iso = text.match(/(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return { year: Number(iso[1]), month: Number(iso[2]), day: Number(iso[3]) };
  const monthName = text.toLowerCase().match(/\b(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\b/);
  const year = text.match(/\b(19|20)\d{2}\b/);
  if (year && monthName) {
    return { year: Number(year[0]), month: MONTHS[monthName[1]], day: 1 };
  }
  if (year) return { year: Number(year[0]), month: 6, day: 1 };
  return null;
}

function semesterOf(when) {
  if (!when) return { id: 'undated', name: 'No printed date', sort: 0 };
  const season = when.month <= 5 ? 'Spring' : when.month <= 7 ? 'Summer' : 'Fall';
  return { id: `${when.year}-${season}`, name: `${season} ${when.year}`, sort: when.year * 100 + when.month };
}

function loggedLabel(value) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

export default function KnowledgeBasePage() {
  const [items, setItems] = useState([]);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [query, setQuery] = useState('');
  const [group, setGroup] = useState('all');
  const [pipeline, setPipeline] = useState('all');
  const [view, setView] = useState('repository');
  const [branch, setBranch] = useState('all');
  const [menuId, setMenuId] = useState(null);
  const [editId, setEditId] = useState(null);
  const [metaId, setMetaId] = useState(null);
  const [draftGroup, setDraftGroup] = useState('academic');
  const [draftCategory, setDraftCategory] = useState('');

  const load = async () => {
    const data = await fetchKnowledge();
    setItems(data.items || []);
  };

  useEffect(() => {
    load().catch((err) => setError(err.message || 'Could not load your documents'));
  }, []);

  useEffect(() => {
    if (!items.some((item) => item.pipeline === 'reading')) return undefined;
    const timer = setInterval(() => {
      load().catch(() => {});
    }, 4000);
    return () => clearInterval(timer);
  }, [items]);

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return items.filter((item) => {
      if (group !== 'all' && item.doc_group !== group) return false;
      if (pipeline !== 'all' && item.pipeline !== pipeline) return false;
      if (!needle) return true;
      const haystack = [
        item.title, item.filename, item.issuer, item.category, item.summary,
        ...(item.skills || []),
        ...(item.chips || []).map((chip) => `${chip.label} ${chip.value}`),
      ].join(' ').toLowerCase();
      return haystack.includes(needle);
    });
  }, [items, query, group, pipeline]);

  const verified = items.filter((item) => item.pipeline === 'verified').length;
  const pending = items.filter((item) => item.pipeline === 'reading').length;
  const categories = new Set(items.map((item) => item.doc_group).filter((id) => id && id !== 'uncategorised')).size;

  const onUpload = async (event) => {
    const files = Array.from(event.target.files || []);
    event.target.value = '';
    if (!files.length) return;
    setBusy(true);
    setError('');
    const failures = [];
    try {
      const uid = await getUid();
      for (const file of files) {
        try {
          await uploadKnowledgeDoc(uid, file);
        } catch (err) {
          failures.push(`${file.name}: ${err.message || 'Upload failed'}`);
        }
      }
      await load();
      if (failures.length) setError(failures.join(' '));
    } catch (err) {
      setError(err.message || 'Upload failed');
    } finally {
      setBusy(false);
    }
  };

  const saveCategory = async (item) => {
    try {
      await updateKnowledgeCategory(item.id, draftGroup, draftCategory);
      setEditId(null);
      await load();
    } catch (err) {
      setError(err.message || 'Could not update the category');
    }
  };

  const openEdit = (item) => {
    setMenuId(null);
    setEditId(item.id);
    setDraftGroup(item.doc_group === 'uncategorised' ? 'academic' : item.doc_group);
    setDraftCategory(item.category || '');
  };

  const timeline = useMemo(() => {
    const branchOf = (item) => {
      if (item.doc_group === 'certificate') return 'credential';
      if (item.doc_group === 'academic') return 'academic';
      if (item.doc_group === 'career') return 'career';
      return 'activity';
    };
    const rows = filtered.filter((item) => {
      if (branch === 'credential') return item.doc_group === 'certificate';
      if (branch === 'academic') return item.doc_group === 'academic';
      if (branch === 'career') return item.doc_group === 'career';
      return true;
    });
    const buckets = new Map();
    rows.forEach((item) => {
      const when = parseWhen(item.event_date) || parseWhen(item.logged_at);
      const term = item.event_date ? semesterOf(when) : { id: 'undated', name: 'No printed date', sort: 0 };
      if (!buckets.has(term.id)) buckets.set(term.id, { ...term, events: [] });
      buckets.get(term.id).events.push({ ...item, nodeType: branchOf(item), when });
    });
    return [...buckets.values()]
      .sort((a, b) => b.sort - a.sort)
      .map((term) => ({
        ...term,
        events: term.events.sort((a, b) => ((b.when?.year || 0) * 10000 + (b.when?.month || 0) * 100 + (b.when?.day || 0)) - ((a.when?.year || 0) * 10000 + (a.when?.month || 0) * 100 + (a.when?.day || 0))),
      }));
  }, [filtered, branch]);

  const renderMenu = (item) => (
    menuId === item.id ? (
      <div className="kb-menu">
        {item.view_url ? <a href={item.view_url} target="_blank" rel="noreferrer">View scan</a> : null}
        {item.view_url ? <a href={item.view_url} download>Download</a> : null}
        <button type="button" onClick={() => openEdit(item)}>Re-categorize</button>
        <button type="button" onClick={() => { setMetaId(metaId === item.id ? null : item.id); setMenuId(null); }}>View metadata</button>
      </div>
    ) : null
  );

  return (
    <div className="kb-vault">
      <div className="kb-head">
        <div>
          <h1 className="kb-title">Knowledge Vault & Documents</h1>
          <p className="kb-sub">
            {verified} verified {verified === 1 ? 'document' : 'documents'} across {categories} {categories === 1 ? 'category' : 'categories'}
            {pending ? ` · ${pending} pending review` : ''}
          </p>
        </div>
        <label className="kb-upload">
          {busy ? 'Uploading…' : '+ Upload Documents'}
          <input type="file" accept="image/*,.pdf,.doc,.docx" multiple hidden disabled={busy} onChange={onUpload} />
        </label>
      </div>
      {error ? <div className="kb-alert">{error}</div> : null}
      <div className="kb-toolbar">
        <input className="kb-search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search documents, skills, or issuers" aria-label="Search documents" />
        <select className="kb-select" value={group} onChange={(e) => setGroup(e.target.value)} aria-label="Category">
          <option value="all">All categories</option>
          {GROUPS.map((entry) => <option key={entry.id} value={entry.id}>{entry.label}</option>)}
        </select>
        <select className="kb-select" value={pipeline} onChange={(e) => setPipeline(e.target.value)} aria-label="Status">
          <option value="all">All statuses</option>
          <option value="verified">Verified</option>
          <option value="stored">Stored</option>
          <option value="reading">Pending review</option>
          <option value="failed">Could not read</option>
        </select>
        <div className="kb-views">
          <button type="button" className={`kb-view ${view === 'repository' ? 'active' : ''}`} onClick={() => setView('repository')}>Repository</button>
          <button type="button" className={`kb-view ${view === 'timeline' ? 'active' : ''}`} onClick={() => setView('timeline')}>Timeline tree</button>
        </div>
      </div>

      {!items.length ? <div className="kb-empty">No documents stored yet. Upload a certificate, marksheet, or career file to start the vault.</div> : null}
      {items.length && !filtered.length ? <div className="kb-empty">No documents match this search.</div> : null}

      {view === 'repository' ? GROUPS.map((section) => {
        const rows = filtered.filter((item) => (section.id === 'uncategorised' ? !GROUPS.some((entry) => entry.id === item.doc_group) || item.doc_group === 'uncategorised' : item.doc_group === section.id));
        if (!rows.length) return null;
        return (
          <section key={section.id} className="kb-section">
            <h2>{section.label}</h2>
            {rows.map((item) => (
              <article key={item.id} className="kb-card">
                <div className="kb-card-top">
                  <div>
                    <div className="kb-kicker">{groupLabel(item.doc_group)}</div>
                    <h3>{item.title}</h3>
                    <p className="kb-file">
                      Source: {item.filename || 'Stored document'}
                      {item.logged_at ? ` · Uploaded ${loggedLabel(item.logged_at)}` : ''}
                    </p>
                  </div>
                  <div className="kb-actions">
                    <span className={`kb-badge ${item.pipeline}`}>{pipelineLabel[item.pipeline] || item.pipeline}</span>
                    {item.view_url ? <a className="kb-text" href={item.view_url} target="_blank" rel="noreferrer">View</a> : null}
                    <button type="button" className="kb-text" aria-label="Document actions" onClick={() => setMenuId(menuId === item.id ? null : item.id)}>•••</button>
                    {renderMenu(item)}
                  </div>
                </div>
                {item.chips?.length ? (
                  <div className="kb-chips">
                    {item.chips.map((chip) => <span key={chip.label} className="kb-chip">{chip.label}: {chip.value}</span>)}
                  </div>
                ) : null}
                {item.skills?.length ? (
                  <div className="kb-skills">
                    {item.skills.map((skill) => <span key={skill} className="kb-skill">{skill}</span>)}
                  </div>
                ) : null}
                {item.impact ? <div className="kb-impact">{item.impact}</div> : null}
                <div className="kb-card-foot">
                  <span>Category: {groupLabel(item.doc_group)}{item.category ? ` > ${item.category}` : ''}</span>
                  <button type="button" className="kb-text" onClick={() => openEdit(item)}>Re-categorize</button>
                </div>
                {editId === item.id ? (
                  <div className="kb-drawer">
                    <label>Domain
                      <select value={draftGroup} onChange={(e) => setDraftGroup(e.target.value)}>
                        {GROUPS.filter((entry) => entry.id !== 'uncategorised').map((entry) => <option key={entry.id} value={entry.id}>{entry.label}</option>)}
                      </select>
                    </label>
                    <label>Specific label
                      <input value={draftCategory} onChange={(e) => setDraftCategory(e.target.value)} placeholder="Certificate, marksheet, internship" />
                    </label>
                    <div>
                      <button type="button" className="kb-view active" onClick={() => saveCategory(item)}>Save category</button>
                    </div>
                  </div>
                ) : null}
                {metaId === item.id ? <p className="kb-meta">{item.summary || 'No extracted text is stored for this file.'}</p> : null}
              </article>
            ))}
          </section>
        );
      }) : (
        <div className="kb-timeline">
          <div className="kb-pills">
            {[
              ['all', 'All nodes'],
              ['credential', 'Only credentials'],
              ['academic', 'Only marksheets'],
              ['career', 'Only career'],
            ].map(([id, label]) => (
              <button key={id} type="button" className={`kb-pill ${branch === id ? 'active' : ''}`} onClick={() => setBranch(id)}>{label}</button>
            ))}
          </div>
          {timeline.map((term) => (
            <section key={term.id} className="kb-semester">
              <div className="kb-semester-pill">{term.name}</div>
              <div className="kb-branch">
                {term.events.map((item) => (
                  <div key={item.id} className={`kb-node ${item.nodeType}`}>
                    <div className="kb-marker" />
                    <div className="kb-node-card">
                      <div className="kb-node-head">
                        <span className="kb-node-date">
                          {item.event_date ? `Earned ${item.event_date}` : 'No printed date'}
                          {item.logged_at ? ` · Logged ${loggedLabel(item.logged_at)}` : ''}
                        </span>
                        <span className={`kb-badge ${item.pipeline}`}>{pipelineLabel[item.pipeline] || item.status}</span>
                      </div>
                      <h3>{item.title}</h3>
                      <p className="kb-file">{[item.issuer, item.chips?.find((chip) => chip.label === 'Score')?.value].filter(Boolean).join(' · ') || item.filename}</p>
                      {item.impact ? <div className="kb-impact">{item.impact}</div> : null}
                      <div className="kb-actions" style={{ marginTop: 8 }}>
                        {item.view_url ? <a className="kb-text" href={item.view_url} target="_blank" rel="noreferrer">View scan</a> : null}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
