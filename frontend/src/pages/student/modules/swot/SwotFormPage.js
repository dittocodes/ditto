import React, { useEffect, useState } from 'react';
import { getUid, apiPost, fetchProfile } from '../../../../services/studentV1Api';

const STEPS = [
  { n: 1, title: 'Personal information' },
  { n: 2, title: 'Strengths', field: 'strengths', placeholder: 'List strengths (one per line)' },
  { n: 3, title: 'Weaknesses', field: 'weaknesses', placeholder: 'List weaknesses (one per line)' },
  { n: 4, title: 'Opportunities & threats', fields: ['opportunities', 'threats'] },
];

export default function SwotFormPage() {
  const [step, setStep] = useState(1);
  const [form, setForm] = useState({
    address_line1: '',
    city: '',
    state: '',
    postal_code: '',
    strengths: '',
    weaknesses: '',
    opportunities: '',
    threats: '',
  });
  const [msg, setMsg] = useState('');

  useEffect(() => {
    (async () => {
      try {
        const uid = await getUid();
        const profile = await fetchProfile(uid, 'overview');
        const p = profile.personal || {};
        const c = p.contact || {};
        setForm((f) => ({
          ...f,
          address_line1: c.address_line1 || '',
          city: c.city || '',
          state: c.state || '',
          postal_code: c.postal_code || '',
        }));
      } catch {
        /* profile optional */
      }
    })();
  }, []);

  const submit = async () => {
    const uid = await getUid();
    const split = (s) => s.split('\n').map((x) => x.trim()).filter(Boolean);
    await apiPost(`/api/v1/students/${uid}/swot`, {
      strengths: split(form.strengths),
      weaknesses: split(form.weaknesses),
      opportunities: split(form.opportunities),
      threats: split(form.threats),
      personal: {
        address_line1: form.address_line1,
        city: form.city,
        state: form.state,
        postal_code: form.postal_code,
      },
    });
    setMsg('SWOT saved. View your report in SWOT Report.');
  };

  const current = STEPS.find((s) => s.n === step);

  return (
    <div>
      <h1 className="tracker-page-title">SWOT Analysis Form</h1>
      <p className="tracker-page-sub">Complete this 4-step form to generate your personalized SWOT analysis</p>
      <div className="tracker-card">
        <div style={{ display: 'flex', gap: 8, marginBottom: 8, flexWrap: 'wrap' }}>
          {STEPS.map(({ n, title }) => (
            <div
              key={n}
              style={{
                padding: '6px 12px',
                borderRadius: 999,
                background: step === n ? '#2563eb' : step > n ? '#dcfce7' : '#e2e8f0',
                color: step === n ? '#fff' : '#64748b',
                fontSize: 13,
                fontWeight: 600,
              }}
            >
              {n}. {title}
            </div>
          ))}
        </div>
        <p className="tracker-step-label">Step {step} of 4 — {current?.title}</p>
        {step === 1 && (
          <>
            <label>Address line 1</label>
            <input className="tracker-input" value={form.address_line1} onChange={(e) => setForm({ ...form, address_line1: e.target.value })} />
            <label>City</label>
            <input className="tracker-input" value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} />
            <label>State / Province</label>
            <input className="tracker-input" value={form.state} onChange={(e) => setForm({ ...form, state: e.target.value })} />
            <label>Postal code</label>
            <input className="tracker-input" value={form.postal_code} onChange={(e) => setForm({ ...form, postal_code: e.target.value })} />
          </>
        )}
        {step === 2 && (
          <textarea className="tracker-input" style={{ width: '100%', minHeight: 120 }} value={form.strengths} onChange={(e) => setForm({ ...form, strengths: e.target.value })} placeholder={STEPS[1].placeholder} />
        )}
        {step === 3 && (
          <textarea className="tracker-input" style={{ width: '100%', minHeight: 120 }} value={form.weaknesses} onChange={(e) => setForm({ ...form, weaknesses: e.target.value })} placeholder={STEPS[2].placeholder} />
        )}
        {step === 4 && (
          <>
            <label>Opportunities</label>
            <textarea className="tracker-input" style={{ width: '100%', minHeight: 80 }} value={form.opportunities} onChange={(e) => setForm({ ...form, opportunities: e.target.value })} placeholder="One per line" />
            <label style={{ marginTop: 12 }}>Threats</label>
            <textarea className="tracker-input" style={{ width: '100%', minHeight: 80 }} value={form.threats} onChange={(e) => setForm({ ...form, threats: e.target.value })} placeholder="One per line" />
          </>
        )}
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 16 }}>
          <button type="button" className="tracker-tab" disabled={step === 1} onClick={() => setStep((s) => s - 1)}>Previous</button>
          {step < 4 ? (
            <button type="button" className="tracker-btn-primary" onClick={() => setStep((s) => s + 1)}>Next →</button>
          ) : (
            <button type="button" className="tracker-btn-gold" onClick={submit}>Submit SWOT</button>
          )}
        </div>
        {msg && <p style={{ color: '#22c55e', marginTop: 12 }}>{msg}</p>}
      </div>
    </div>
  );
}
