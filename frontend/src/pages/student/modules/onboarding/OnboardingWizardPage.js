import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  Check,
  ChevronRight,
  ClipboardCheck,
  FileText,
  PartyPopper,
  ShieldCheck,
  Upload,
  User,
} from 'lucide-react';
import { API_BASE_URL } from '../../../../api';
import {
  apiPut,
  getUid,
  pollJobUntilDone,
  submitProfileReview,
  trackProcessingJob,
  updateKnowledgeCategory,
  uploadKnowledgeDoc,
} from '../../../../services/studentV1Api';
import '../../../../assets/css/tracker-onboarding.css';

const STEPS = [
  {
    title: 'Student ID',
    icon: ShieldCheck,
    heading: 'Student ID (optional)',
    description: 'Upload an ID to fill your name and programme, or skip this and type the details yourself.',
  },
  {
    title: 'Profile',
    icon: User,
    heading: 'Create your profile',
    description: 'These details are saved as you type. You can leave and continue later.',
  },
  {
    title: 'Documents',
    icon: FileText,
    heading: 'Upload evidence',
    description: 'Upload any record. It is categorised automatically, and you can change that later in Documents.',
  },
  {
    title: 'Review',
    icon: ClipboardCheck,
    heading: 'Review & submit',
    description: 'Check your profile, then submit. Documents can keep processing after you finish.',
  },
  {
    title: 'Done',
    icon: PartyPopper,
    heading: 'You’re all set',
    description: 'Your documents will keep updating the dashboards in the background.',
  },
];

const DOC_GROUPS = [
  { id: 'academic', label: 'Academic record' },
  { id: 'career', label: 'Career document' },
  { id: 'certificate', label: 'Certificate' },
  { id: 'activity', label: 'External activity' },
];

function groupLabel(id) {
  return DOC_GROUPS.find((group) => group.id === id)?.label || 'Reading';
}

const BLOOD_GROUPS = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];

function linkFromProfile(links, type) {
  const row = (links || []).find((l) => (l.type || l.label || '').toLowerCase().includes(type));
  return row?.url || '';
}

function linkedinUsername(url) {
  if (!url) return '';
  return String(url).split('?')[0].replace(/^(https?:\/\/)?(www\.)?linkedin\.com\/in\//, '').replace(/\/$/, '');
}

function splitProgram(program) {
  const text = String(program || '');
  const match = text.match(/^(BSc\.|MSc\.)\s+in\s+(.+)$/i);
  if (!match) return { level: '', department: '' };
  const level = /^msc/i.test(match[1]) ? 'MSc.' : 'BSc.';
  return { level, department: match[2].trim() };
}

function splitBatch(batch) {
  const match = String(batch || '').match(/^(\d{4})-(\d{4})$/);
  if (!match) return { start: '', duration: '' };
  const years = parseInt(match[2], 10) - parseInt(match[1], 10);
  return { start: match[1], duration: years > 0 ? String(years) : '' };
}

function picked(draftValue, fallback) {
  return draftValue !== undefined && draftValue !== null ? draftValue : fallback;
}

export default function OnboardingWizardPage() {
  const { student_usn } = useParams();
  const [step, setStep] = useState(0);
  const [maxStep, setMaxStep] = useState(0);
  const [consent, setConsent] = useState(false);
  const [idUploaded, setIdUploaded] = useState(false);
  const [uploadStatus, setUploadStatus] = useState('');
  const [uploadBusy, setUploadBusy] = useState(false);
  const [mentors, setMentors] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [startYear, setStartYear] = useState('');
  const [duration, setDuration] = useState('');
  const [programLevel, setProgramLevel] = useState('');
  const [department, setDepartment] = useState('');
  const [linkedinUser, setLinkedinUser] = useState('');
  const [portfolio, setPortfolio] = useState('');
  const [github, setGithub] = useState('');
  const [profileForm, setProfileForm] = useState({
    student_name: '',
    student_phoneno: '',
    mother_contact: '',
    father_contact: '',
    parent_guardian_contact: '',
    gender: '',
    blood_group: '',
    date_of_birth: '',
    semester: '',
    assigned_mentor: '',
    email: '',
  });
  const [documents, setDocuments] = useState([]);
  const [docKind, setDocKind] = useState('academic');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [saveState, setSaveState] = useState('');
  const resumedJobs = useRef(false);

  const yearOptions = useMemo(
    () => Array.from({ length: 15 }, (_, i) => new Date().getFullYear() - 10 + i),
    [],
  );
  const durationOptions = [2, 3, 4, 5, 6, 7];
  const batch = startYear && duration ? `${startYear}-${parseInt(startYear, 10) + parseInt(duration, 10)}` : '';
  const programLabel = programLevel && department ? `${programLevel} in ${department}` : '';
  const linkedinUrl = linkedinUser.trim() ? `https://linkedin.com/in/${linkedinUser.trim().replace(/^\/+|\/+$/g, '')}` : '';
  const filteredMentors = mentors.filter(
    (m) => m.mentor_department && department && m.mentor_department.trim().toLowerCase() === department.trim().toLowerCase(),
  );

  useEffect(() => {
    fetch(`${API_BASE_URL}/mentors`)
      .then((r) => (r.ok ? r.json() : []))
      .then((data) => {
        const rows = Array.isArray(data) ? data : [];
        setMentors(rows);
        const deptMap = new Map();
        rows.map((m) => m.mentor_department).filter(Boolean).forEach((dept) => {
          const key = dept.trim().toLowerCase();
          if (!deptMap.has(key)) deptMap.set(key, dept.trim());
        });
        setDepartments(Array.from(deptMap.values()).sort());
      })
      .catch(() => setDepartments([]));
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const token = sessionStorage.getItem('access_token');
        const res = await fetch(`${API_BASE_URL}/api/v1/students/me/onboarding`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok || cancelled) {
          if (!cancelled) setLoaded(true);
          return;
        }
        const data = await res.json();
        const draft = data.draft || {};
        const student = data.student || {};
        const savedProfile = draft.profile || {};
        const fromProgram = splitProgram(student.student_program);
        const fromBatch = splitBatch(student.student_batch);
        const links = student.links || [];
        const savedStep = Number.isFinite(draft.step) ? draft.step : 0;
        setStep(Math.min(4, Math.max(0, savedStep)));
        setMaxStep(Math.min(4, Math.max(savedStep, Number.isFinite(draft.max_step) ? draft.max_step : 0)));
        setConsent(Boolean(draft.consent));
        setIdUploaded(Boolean(draft.id_uploaded));
        setUploadStatus(draft.upload_status || '');
        setDocKind(draft.doc_kind || 'academic');
        setDocuments(Array.isArray(draft.documents) ? draft.documents : []);
        setProgramLevel(picked(draft.program_level, fromProgram.level) || '');
        setDepartment(picked(draft.department, fromProgram.department) || '');
        setStartYear(String(picked(draft.start_year, fromBatch.start) || ''));
        setDuration(String(picked(draft.duration, fromBatch.duration) || ''));
        setLinkedinUser(picked(draft.linkedin_user, linkedinUsername(student.linkedin)) || '');
        setPortfolio(picked(draft.portfolio, linkFromProfile(links, 'portfolio')) || '');
        setGithub(picked(draft.github, linkFromProfile(links, 'github')) || '');
        setProfileForm({
          student_name: picked(savedProfile.student_name, student.student_name) || '',
          student_phoneno: String(picked(savedProfile.student_phoneno, student.student_phoneno) || '').replace(/\D/g, '').slice(-10),
          mother_contact: picked(savedProfile.mother_contact, student.mother_contact) || '',
          father_contact: picked(savedProfile.father_contact, student.father_contact) || '',
          parent_guardian_contact: picked(savedProfile.parent_guardian_contact, student.parent_guardian_contact) || '',
          gender: picked(savedProfile.gender, student.gender) || '',
          blood_group: picked(savedProfile.blood_group, student.blood_group) || '',
          date_of_birth: String(picked(savedProfile.date_of_birth, student.date_of_birth) || '').slice(0, 10),
          semester: String(picked(savedProfile.semester, student.semester) || ''),
          assigned_mentor: picked(savedProfile.assigned_mentor, student.assigned_mentor) || '',
          email: student.email || '',
        });
      } catch {
        /* a new account can start from the first step */
      } finally {
        if (!cancelled) setLoaded(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [student_usn]);

  const progressPct = useMemo(() => ((step + 1) / STEPS.length) * 100, [step]);

  const goToStep = (index) => {
    if (index <= maxStep && index >= 0 && index < STEPS.length) {
      setStep(index);
      setError('');
    }
  };

  const advance = (next) => {
    setMaxStep((m) => Math.max(m, next));
    setStep(next);
    setError('');
  };

  const setField = (name, value) => setProfileForm((prev) => ({ ...prev, [name]: value }));

  const profileEdits = () => {
    const edits = {
      student_name: profileForm.student_name.trim(),
      student_phoneno: profileForm.student_phoneno.trim(),
      mother_contact: profileForm.mother_contact.trim(),
      father_contact: profileForm.father_contact.trim(),
      student_program: programLabel,
      student_batch: batch,
      assigned_mentor: profileForm.assigned_mentor,
      linkedin: linkedinUrl,
    };
    if (profileForm.parent_guardian_contact.trim()) edits.parent_guardian_contact = profileForm.parent_guardian_contact.trim();
    if (profileForm.gender) edits.gender = profileForm.gender;
    if (profileForm.blood_group) edits.blood_group = profileForm.blood_group;
    if (profileForm.date_of_birth) edits.date_of_birth = profileForm.date_of_birth;
    if (profileForm.semester) edits.semester = parseInt(profileForm.semester, 10);
    return edits;
  };

  const draftPayload = useMemo(() => ({
    step,
    max_step: maxStep,
    consent,
    id_uploaded: idUploaded,
    upload_status: uploadStatus,
    doc_kind: docKind,
    documents,
    program_level: programLevel,
    department,
    start_year: startYear,
    duration,
    linkedin_user: linkedinUser,
    portfolio,
    github,
    profile: profileForm,
    edits: {
      student_name: profileForm.student_name.trim(),
      student_phoneno: profileForm.student_phoneno.trim(),
      mother_contact: profileForm.mother_contact.trim(),
      father_contact: profileForm.father_contact.trim(),
      parent_guardian_contact: profileForm.parent_guardian_contact.trim(),
      gender: profileForm.gender,
      blood_group: profileForm.blood_group,
      date_of_birth: profileForm.date_of_birth,
      student_program: programLabel,
      student_batch: batch,
      assigned_mentor: profileForm.assigned_mentor,
      linkedin: linkedinUrl,
      ...(profileForm.semester ? { semester: parseInt(profileForm.semester, 10) } : {}),
    },
  }), [
    step, maxStep, consent, idUploaded, uploadStatus, docKind, documents,
    programLevel, department, startYear, duration, linkedinUser, portfolio, github,
    profileForm, programLabel, batch, linkedinUrl,
  ]);

  const draftRef = useRef(draftPayload);
  draftRef.current = draftPayload;

  useEffect(() => {
    if (!loaded) return undefined;
    setSaveState('Saving…');
    const timer = setTimeout(async () => {
      try {
        await apiPut('/api/v1/students/me/onboarding', draftRef.current);
        setSaveState('Saved');
      } catch {
        setSaveState('Not saved yet');
      }
    }, 700);
    return () => clearTimeout(timer);
  }, [loaded, draftPayload]);

  useEffect(() => {
    if (!loaded) return undefined;
    const flush = () => {
      const token = sessionStorage.getItem('access_token');
      if (!token) return;
      fetch(`${API_BASE_URL}/api/v1/students/me/onboarding`, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(draftRef.current),
        keepalive: true,
      }).catch(() => {});
    };
    window.addEventListener('pagehide', flush);
    return () => window.removeEventListener('pagehide', flush);
  }, [loaded]);

  const validateProfile = () => {
    if (!profileForm.student_name.trim()) return 'Please enter your name.';
    if (!profileForm.student_phoneno.trim()) return 'Please enter your phone number.';
    if (!profileForm.mother_contact.trim()) return 'Please enter mother contact number.';
    if (!profileForm.father_contact.trim()) return 'Please enter father contact number.';
    if (!programLevel) return 'Please select a program.';
    if (!department) return 'Please select a department.';
    if (!startYear || !duration) return 'Please select both start year and duration for batch.';
    if (!profileForm.assigned_mentor) return 'Please select an assigned mentor.';
    if (!linkedinUser.trim()) return 'Please enter your LinkedIn username.';
    return '';
  };

  const uploadId = async (file) => {
    const uid = await getUid();
    const fd = new FormData();
    fd.append('file', file);
    fd.append('consent', 'true');
    const token = sessionStorage.getItem('access_token');
    const res = await fetch(`${API_BASE_URL}/api/v1/students/${uid}/id-card`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: fd,
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(json.detail || 'ID upload failed');
    return json;
  };

  const onIdFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file || !consent) return;
    setUploadBusy(true);
    setUploadStatus('Uploading…');
    setError('');
    try {
      const { job_id: jobId } = await uploadId(file);
      trackProcessingJob(jobId);
      setUploadStatus('Reading your ID card…');
      const job = await pollJobUntilDone(jobId, 45, 2000);
      if (job.status !== 'completed') {
        throw new Error(job.last_error || 'Could not read the ID card. Upload a clearer photo and try again.');
      }
      const fields = job.result?.structured_fields || {};
      const name = fields.student_name || fields.name || fields.full_name || '';
      const program = fields.programme || fields.program || fields.student_program || '';
      const semester = fields.semester != null && fields.semester !== '' ? String(fields.semester) : '';
      const phone = String(fields.phone || fields.student_phoneno || '').replace(/\D/g, '').slice(-10);
      if (!name && !program) {
        setIdUploaded(true);
        setUploadStatus('ID received, but the name and programme could not be read. Enter them on the profile step, or upload a clearer photo.');
        return;
      }
      setProfileForm((prev) => ({
        ...prev,
        student_name: name || prev.student_name,
        semester: semester || prev.semester,
        student_phoneno: phone || prev.student_phoneno,
      }));
      if (program && !department) {
        const lower = program.toLowerCase();
        if (lower.includes('msc') || lower.includes('m.sc')) setProgramLevel('MSc.');
        else if (lower.includes('bsc') || lower.includes('b.sc')) setProgramLevel('BSc.');
      }
      setIdUploaded(true);
      setUploadStatus('Details read from your ID. Review them on the profile step.');
    } catch (err) {
      setUploadStatus('');
      setError(err.message || 'Upload failed');
    } finally {
      setUploadBusy(false);
    }
  };

  const saveProfile = async () => {
    const message = validateProfile();
    if (message) {
      setError(message);
      return;
    }
    setSaving(true);
    setError('');
    try {
      const uid = await getUid();
      await submitProfileReview(uid, false, profileEdits());
      if (portfolio.trim()) {
        await fetch(`${API_BASE_URL}/api/v1/students/${uid}/links`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${sessionStorage.getItem('access_token')}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ type: 'portfolio', url: portfolio.trim() }),
        });
      }
      if (github.trim()) {
        await fetch(`${API_BASE_URL}/api/v1/students/${uid}/links`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${sessionStorage.getItem('access_token')}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ type: 'github', url: github.trim() }),
        });
      }
      advance(2);
    } catch (e) {
      setError(e.message || 'Could not save profile');
    } finally {
      setSaving(false);
    }
  };

  useEffect(() => {
    if (!loaded || resumedJobs.current) return;
    resumedJobs.current = true;
    documents.forEach((doc) => {
      if (doc.job_id && doc.status !== 'added') {
        watchDocument(doc.id, doc.job_id);
      }
    });
  }, [loaded]);

  const watchDocument = async (localId, jobId) => {
    setDocuments((rows) => rows.map((row) => (
      row.id === localId && row.status !== 'added' ? { ...row, status: 'reading' } : row
    )));
    try {
      const job = await pollJobUntilDone(jobId, 160, 3000);
      if (!job || !['completed', 'failed', 'dead_letter'].includes(job.status)) {
        setDocuments((rows) => rows.map((row) => (row.id === localId ? { ...row, status: 'reading' } : row)));
        return;
      }
      const status = job.status === 'completed' ? 'added' : 'failed';
      const kind = job.result?.group || 'uncategorised';
      const category = job.result?.category && job.result.category !== 'unknown' ? job.result.category : '';
      setDocuments((rows) => rows.map((row) => (row.id === localId ? { ...row, status, kind, category } : row)));
    } catch {
      setDocuments((rows) => rows.map((row) => (row.id === localId ? { ...row, status: 'reading' } : row)));
    }
  };

  const uploadOneDocument = async (file) => {
    const localId = `doc-${Date.now()}-${file.name}-${Math.random().toString(36).slice(2, 7)}`;
    setDocuments((rows) => [
      ...rows.filter((row) => row.name !== file.name),
      { id: localId, name: file.name, kind: 'uncategorised', category: '', status: 'queued' },
    ]);
    try {
      const uid = await getUid();
      const result = await uploadKnowledgeDoc(uid, file);
      const jobId = result.job_id;
      if (jobId) trackProcessingJob(jobId);
      setDocuments((rows) => rows.map((row) => (
        row.id === localId ? { ...row, job_id: jobId, item_id: result.item_id, view_url: result.view_url || '' } : row
      )));
      watchDocument(localId, jobId);
    } catch (err) {
      setDocuments((rows) => rows.map((row) => (row.id === localId ? { ...row, status: 'failed' } : row)));
      throw err;
    }
  };

  const onDocumentFile = async (e) => {
    const files = Array.from(e.target.files || []);
    e.target.value = '';
    if (!files.length) return;
    setError('');
    const failures = [];
    for (const file of files) {
      try {
        await uploadOneDocument(file);
      } catch (err) {
        failures.push(`${file.name}: ${err.message || 'Upload failed'}`);
      }
    }
    if (failures.length) {
      setError(failures.join(' '));
    }
  };

  const markDocumentCategory = async (doc, nextGroup) => {
    setDocuments((rows) => rows.map((row) => (row.id === doc.id ? { ...row, kind: nextGroup } : row)));
    if (!doc.item_id) return;
    try {
      await updateKnowledgeCategory(doc.item_id, nextGroup, doc.category || nextGroup);
    } catch (err) {
      setError(err.message || 'Could not update the category');
    }
  };

  const approveProfile = async () => {
    const message = validateProfile();
    if (message) {
      setError(message);
      return;
    }
    setSaving(true);
    setError('');
    try {
      const uid = await getUid();
      await submitProfileReview(uid, true, profileEdits());
      sessionStorage.setItem('onboarding_complete', '1');
      advance(4);
    } catch (e) {
      setError(e.message || 'Could not complete verification');
    } finally {
      setSaving(false);
    }
  };

  const onContinueStep0 = () => {
    advance(1);
  };

  const stepMeta = STEPS[step];
  const StepIcon = stepMeta?.icon || ShieldCheck;
  const statusLabel = {
    queued: 'Queued',
    reading: 'Reading',
    added: 'Added',
    failed: 'Could not read',
  };

  const renderActions = (back, primaryLabel, onPrimary, primaryDisabled = false) => (
    <div className="tracker-onboarding-actions">
      <button
        type="button"
        className="tracker-onboarding-btn-back"
        disabled={back === null || saving}
        onClick={() => back !== null && goToStep(back)}
      >
        Back
      </button>
      <div className="tracker-onboarding-actions-right">
        {primaryLabel ? (
          <button
            type="button"
            className="tracker-onboarding-btn-primary"
            disabled={primaryDisabled || saving}
            onClick={onPrimary}
          >
            {primaryLabel}
            <ChevronRight size={16} style={{ marginLeft: 4, verticalAlign: -2 }} aria-hidden />
          </button>
        ) : null}
      </div>
    </div>
  );

  if (!loaded) {
    return (
      <div className="tracker-onboarding-page">
        <h1 className="tracker-page-title">Onboarding</h1>
        <p className="tracker-page-sub">Loading your saved progress…</p>
      </div>
    );
  }

  return (
    <div className="tracker-onboarding-page">
      <h1 className="tracker-page-title">Onboarding</h1>
      <p className="tracker-page-sub">
        Finish your profile before the rest of Tracker opens (
        {student_usn}
        ). Progress is saved on your account, so you can leave and continue later.
        {saveState ? <span className="tracker-onboarding-save-state">{saveState}</span> : null}
      </p>

      <div className="tracker-onboarding-progress" aria-hidden>
        <div className="tracker-onboarding-progress-fill" style={{ width: `${progressPct}%` }} />
      </div>

      <nav className="tracker-onboarding-stepper" aria-label="Onboarding steps">
        {STEPS.map((s, i) => {
          const done = i < step;
          const active = step === i;
          const clickable = i <= maxStep;
          return (
            <button
              key={s.title}
              type="button"
              className={`tracker-onboarding-step-pill${active ? ' active' : ''}${done ? ' done' : ''}${clickable ? ' clickable' : ''}`}
              onClick={() => clickable && goToStep(i)}
              aria-current={active ? 'step' : undefined}
            >
              <span className="tracker-onboarding-step-num">
                {done && !active ? <Check size={12} strokeWidth={3} /> : i + 1}
              </span>
              {i + 1}
              .
              {' '}
              {s.title}
            </button>
          );
        })}
      </nav>

      {error ? <div className="tracker-onboarding-alert error">{error}</div> : null}

      {step < 4 ? (
        <div className="tracker-onboarding-card">
          <div className="tracker-onboarding-card-head">
            <span className="tracker-onboarding-card-icon">
              <StepIcon size={24} strokeWidth={1.8} aria-hidden />
            </span>
            <div>
              <h2>{stepMeta.heading}</h2>
              <p>{stepMeta.description}</p>
            </div>
          </div>

          {step === 0 ? (
            <>
              <label className="tracker-onboarding-consent" htmlFor="onboarding-consent">
                <input
                  id="onboarding-consent"
                  type="checkbox"
                  checked={consent}
                  onChange={(e) => setConsent(e.target.checked)}
                />
                <div>
                  <strong>I consent to ID verification for academic records</strong>
                  <span>
                    Optional. Needed only if you upload an ID. You can skip this and enter your details on the next step.
                  </span>
                </div>
              </label>
              <div className={`tracker-onboarding-upload${consent ? ' ready' : ' disabled'}`}>
                <p className="tracker-onboarding-upload-hint">
                  Optional. Upload a clear photo or PDF of your student ID (PNG, JPG, or PDF), or continue and fill the profile yourself.
                </p>
                <label htmlFor="id-upload">
                  <Upload size={18} aria-hidden />
                  Choose file
                </label>
                <input
                  id="id-upload"
                  type="file"
                  accept="image/*,.pdf"
                  disabled={!consent || uploadBusy}
                  onChange={onIdFile}
                />
                {uploadStatus ? (
                  <p className={`tracker-onboarding-status${idUploaded ? ' ok' : ''}`}>{uploadStatus}</p>
                ) : null}
              </div>
              {renderActions(null, 'Continue', onContinueStep0, uploadBusy)}
            </>
          ) : null}

          {step === 1 ? (
            <>
              <div className="tracker-onboarding-field">
                <label htmlFor="ob-name">Name *</label>
                <input id="ob-name" className="tracker-input" value={profileForm.student_name} onChange={(e) => setField('student_name', e.target.value)} placeholder="Enter full name" />
              </div>
              <div className="tracker-onboarding-field">
                <label htmlFor="ob-phone">Phone number *</label>
                <input id="ob-phone" className="tracker-input" value={profileForm.student_phoneno} maxLength={10} onChange={(e) => setField('student_phoneno', e.target.value.replace(/\D/g, '').slice(0, 10))} placeholder="10-digit mobile" />
              </div>
              <div className="tracker-onboarding-field">
                <label htmlFor="ob-mother">Mother contact *</label>
                <input id="ob-mother" className="tracker-input" value={profileForm.mother_contact} maxLength={10} onChange={(e) => setField('mother_contact', e.target.value.replace(/\D/g, '').slice(0, 10))} />
              </div>
              <div className="tracker-onboarding-field">
                <label htmlFor="ob-father">Father contact *</label>
                <input id="ob-father" className="tracker-input" value={profileForm.father_contact} maxLength={10} onChange={(e) => setField('father_contact', e.target.value.replace(/\D/g, '').slice(0, 10))} />
              </div>
              <div className="tracker-onboarding-field">
                <label htmlFor="ob-guardian">Guardian contact</label>
                <input id="ob-guardian" className="tracker-input" value={profileForm.parent_guardian_contact} onChange={(e) => setField('parent_guardian_contact', e.target.value)} />
              </div>
              <div className="tracker-onboarding-field">
                <label htmlFor="ob-gender">Gender</label>
                <select id="ob-gender" className="tracker-input" value={profileForm.gender} onChange={(e) => setField('gender', e.target.value)}>
                  <option value="">Select gender</option>
                  <option value="Male">Male</option>
                  <option value="Female">Female</option>
                  <option value="Other">Other</option>
                  <option value="Prefer not to say">Prefer not to say</option>
                </select>
              </div>
              <div className="tracker-onboarding-field">
                <label htmlFor="ob-blood">Blood group</label>
                <select id="ob-blood" className="tracker-input" value={profileForm.blood_group} onChange={(e) => setField('blood_group', e.target.value)}>
                  <option value="">Select blood group</option>
                  {BLOOD_GROUPS.map((g) => <option key={g} value={g}>{g}</option>)}
                </select>
              </div>
              <div className="tracker-onboarding-field">
                <label htmlFor="ob-dob">Date of birth</label>
                <input id="ob-dob" className="tracker-input" type="date" value={profileForm.date_of_birth} onChange={(e) => setField('date_of_birth', e.target.value)} />
              </div>
              <div className="tracker-onboarding-field">
                <label htmlFor="ob-level">Program *</label>
                <select id="ob-level" className="tracker-input" value={programLevel} onChange={(e) => setProgramLevel(e.target.value)}>
                  <option value="">Select program</option>
                  <option value="BSc.">BSc.</option>
                  <option value="MSc.">MSc.</option>
                </select>
              </div>
              <div className="tracker-onboarding-field">
                <label htmlFor="ob-dept">Department *</label>
                <select id="ob-dept" className="tracker-input" value={department} onChange={(e) => { setDepartment(e.target.value); setField('assigned_mentor', ''); }}>
                  <option value="">Select department</option>
                  {departments.map((d) => <option key={d} value={d}>{d}</option>)}
                </select>
              </div>
              <div className="tracker-onboarding-field">
                <label htmlFor="ob-year">Batch start year *</label>
                <select id="ob-year" className="tracker-input" value={startYear} onChange={(e) => setStartYear(e.target.value)}>
                  <option value="">Start year</option>
                  {yearOptions.map((y) => <option key={y} value={y}>{y}</option>)}
                </select>
              </div>
              <div className="tracker-onboarding-field">
                <label htmlFor="ob-duration">Duration (years) *</label>
                <select id="ob-duration" className="tracker-input" value={duration} onChange={(e) => setDuration(e.target.value)}>
                  <option value="">Duration</option>
                  {durationOptions.map((y) => <option key={y} value={y}>{y}</option>)}
                </select>
                {batch ? <p className="tracker-onboarding-field-hint">Batch {batch}</p> : null}
              </div>
              <div className="tracker-onboarding-field">
                <label htmlFor="ob-mentor">Assigned mentor *</label>
                <select id="ob-mentor" className="tracker-input" value={profileForm.assigned_mentor} onChange={(e) => setField('assigned_mentor', e.target.value)} disabled={!department}>
                  <option value="">{department ? 'Select mentor' : 'Select a department first'}</option>
                  {filteredMentors.map((m) => (
                    <option key={m.mentor_id} value={m.mentor_id}>{m.mentor_name}</option>
                  ))}
                </select>
              </div>
              <div className="tracker-onboarding-field">
                <label htmlFor="ob-sem">Semester</label>
                <input id="ob-sem" className="tracker-input" value={profileForm.semester} onChange={(e) => setField('semester', e.target.value.replace(/\D/g, '').slice(0, 2))} placeholder="Filled from your ID when it can be read" />
              </div>
              <div className="tracker-onboarding-field">
                <label htmlFor="ob-linkedin">LinkedIn username *</label>
                <input id="ob-linkedin" className="tracker-input" value={linkedinUser} onChange={(e) => setLinkedinUser(linkedinUsername(e.target.value) || e.target.value.replace(/\s/g, ''))} placeholder="your-handle" />
                {linkedinUrl ? <p className="tracker-onboarding-field-hint">{linkedinUrl}</p> : null}
              </div>
              <div className="tracker-onboarding-field">
                <label htmlFor="ob-github">GitHub URL</label>
                <input id="ob-github" className="tracker-input" value={github} onChange={(e) => setGithub(e.target.value)} placeholder="Optional" />
              </div>
              <div className="tracker-onboarding-field">
                <label htmlFor="ob-portfolio">Portfolio URL</label>
                <input id="ob-portfolio" className="tracker-input" value={portfolio} onChange={(e) => setPortfolio(e.target.value)} placeholder="Optional" />
              </div>
              {profileForm.email ? (
                <div className="tracker-onboarding-field">
                  <label>University email</label>
                  <input className="tracker-input" value={profileForm.email} readOnly disabled style={{ opacity: 0.85 }} />
                </div>
              ) : null}
              {renderActions(0, 'Save profile', saveProfile)}
            </>
          ) : null}

          {step === 2 ? (
            <>
              <div className="tracker-onboarding-upload ready">
                <p className="tracker-onboarding-upload-hint">
                  Add marksheets, resumes, certificates, or activity proof. Select one file or several at once. The type is chosen automatically. You can correct it here or later in Documents.
                </p>
                <label htmlFor="doc-upload">
                  <Upload size={18} aria-hidden />
                  Choose files
                </label>
                <input id="doc-upload" type="file" accept="image/*,.pdf,.doc,.docx" multiple onChange={onDocumentFile} />
              </div>
              {documents.length ? (
                <ul className="tracker-onboarding-doc-list">
                  {documents.map((doc) => (
                    <li key={doc.id}>
                      <span>{doc.name}</span>
                      <em>
                        {doc.status === 'added' ? (
                          <select
                            className="tracker-input"
                            value={DOC_GROUPS.some((group) => group.id === doc.kind) ? doc.kind : 'academic'}
                            onChange={(e) => markDocumentCategory(doc, e.target.value)}
                            aria-label={`Category for ${doc.name}`}
                          >
                            {DOC_GROUPS.map((group) => <option key={group.id} value={group.id}>{group.label}</option>)}
                          </select>
                        ) : (statusLabel[doc.status] || 'Reading')}
                        {doc.status === 'added' ? ` · ${statusLabel.added}` : ''}
                        {doc.category && doc.status === 'added' ? ` · ${doc.category}` : ''}
                        {doc.view_url ? (
                          <>
                            {' · '}
                            <a href={doc.view_url} target="_blank" rel="noreferrer">View</a>
                          </>
                        ) : null}
                      </em>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="tracker-onboarding-field-hint">No documents yet. You can continue and add them later in Documents.</p>
              )}
              {renderActions(1, 'Continue to review', () => advance(3))}
            </>
          ) : null}

          {step === 3 ? (
            <>
              <div className="tracker-onboarding-review-grid">
                <div className="tracker-onboarding-review-block">
                  <h4>Identity</h4>
                  <dl>
                    <dt>Consent</dt>
                    <dd>{consent ? 'Accepted' : 'Not recorded'}</dd>
                    <dt>ID upload</dt>
                    <dd>{idUploaded ? 'Submitted' : 'Skipped or pending'}</dd>
                  </dl>
                </div>
                <div className="tracker-onboarding-review-block">
                  <h4>Profile</h4>
                  <dl>
                    <dt>Name</dt>
                    <dd>{profileForm.student_name}</dd>
                    <dt>Program</dt>
                    <dd>{programLabel || '—'}</dd>
                    <dt>Batch</dt>
                    <dd>{batch || '—'}</dd>
                    <dt>Phone</dt>
                    <dd>{profileForm.student_phoneno || '—'}</dd>
                    <dt>LinkedIn</dt>
                    <dd>{linkedinUrl || '—'}</dd>
                  </dl>
                </div>
                <div className="tracker-onboarding-review-block" style={{ gridColumn: '1 / -1' }}>
                  <h4>Documents</h4>
                  {documents.length ? (
                    <ul className="tracker-onboarding-doc-list">
                      {documents.map((doc) => (
                        <li key={doc.id}>
                          <span>{doc.name}</span>
                          <em>{groupLabel(doc.kind)} · {statusLabel[doc.status] || doc.status}</em>
                        </li>
                      ))}
                    </ul>
                  ) : <p>No documents uploaded.</p>}
                </div>
              </div>
              <p style={{ fontSize: 14, color: '#64748b', margin: '0 0 8px' }}>
                Submitting opens the rest of Tracker. Documents still being read will update your dashboards when they finish.
              </p>
              {renderActions(2, 'Submit profile', approveProfile)}
            </>
          ) : null}
        </div>
      ) : null}

      {step === 4 ? (
        <div className="tracker-onboarding-card tracker-onboarding-done">
          <div className="tracker-onboarding-done-icon">
            <PartyPopper size={32} strokeWidth={1.8} aria-hidden />
          </div>
          <h2>Onboarding complete</h2>
          <p>
            Your documents continue processing in the background. The dashboard, profile, and analysis update from those files.
          </p>
          <div className="tracker-onboarding-done-actions">
            <Link to={`/student/${student_usn}/dashboard`} className="tracker-onboarding-btn-primary" style={{ textDecoration: 'none' }}>
              Go to Dashboard
            </Link>
            <Link to={`/student/${student_usn}/profile`} className="tracker-onboarding-btn-gold">
              View Profile
            </Link>
          </div>
        </div>
      ) : null}
    </div>
  );
}
