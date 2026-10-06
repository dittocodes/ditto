import { FormEvent, useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Camera } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { mentorBase } from '@/paths';
import { mentorRequest } from '@/services/api';

interface CampusEvent {
  id: number;
  title: string;
  description: string;
  event_type: string;
  location: string;
  visibility: string;
  scheduled_at: string;
  skills: string[];
  status: string;
}

interface RosterStudent {
  uid: string;
  usn: string;
  name: string;
  rsvp: boolean;
  joined: boolean;
  attendance: string;
}

export default function MentorCampus() {
  const [params] = useSearchParams();
  const [events, setEvents] = useState<CampusEvent[]>([]);
  const [selected, setSelected] = useState<number | null>(null);
  const [roster, setRoster] = useState<RosterStudent[]>([]);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [code, setCode] = useState('');
  const [scanning, setScanning] = useState(false);
  const [scanNote, setScanNote] = useState('');
  const [composer, setComposer] = useState(false);
  const [postKind, setPostKind] = useState<'announcement' | 'event'>('announcement');
  const [caseloadCount, setCaseloadCount] = useState<number | null>(null);
  const [skillInput, setSkillInput] = useState('');
  const [announce, setAnnounce] = useState({ content: '', is_pinned: false });
  const [form, setForm] = useState({
    title: '',
    description: '',
    event_type: 'offline',
    location_details: '',
    visibility: 'caseload_only',
    scheduled_at: '',
    skills: [] as string[],
  });
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const navigate = useNavigate();

  const loadEvents = async () => {
    const rows = await mentorRequest('/api/v1/mentor/campus/events') as CampusEvent[];
    setEvents(rows);
    return rows;
  };

  const loadRoster = async (eventId: number) => {
    const data = await mentorRequest(`/api/v1/mentor/campus/events/${eventId}/roster`) as { students: RosterStudent[] };
    setRoster(data.students || []);
    setSelected(eventId);
  };

  const eventQuery = params.get('event');

  useEffect(() => {
    const wanted = Number(eventQuery);
    loadEvents()
      .then((rows) => {
        const match = rows.find((item) => item.id === wanted);
        if (match) return loadRoster(match.id);
        return undefined;
      })
      .catch((err: Error) => setError(err.message));
  }, [eventQuery]);

  useEffect(() => {
    if (!scanning) return undefined;
    let stop = false;
    let stream: MediaStream | null = null;
    const video = videoRef.current;
    const Detector = (window as Window & { BarcodeDetector?: new (opts: { formats: string[] }) => { detect: (source: HTMLVideoElement) => Promise<{ rawValue?: string }[]> } }).BarcodeDetector;
    if (!Detector || !video) {
      setScanNote('This browser has no camera scanner. Mark students from the list or paste the code.');
      return undefined;
    }
    (async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
        video.srcObject = stream;
        await video.play();
        const detector = new Detector({ formats: ['qr_code'] });
        const tick = async () => {
          if (stop || !selected) return;
          try {
            const found = await detector.detect(video);
            const value = found[0]?.rawValue;
            if (value) {
              stop = true;
              setScanning(false);
              await mark(selected, value, 'present');
              return;
            }
          } catch {
            /* keep looking */
          }
          if (!stop) window.setTimeout(tick, 400);
        };
        tick();
      } catch {
        setScanNote('Camera permission was blocked. Use the checklist.');
      }
    })();
    return () => {
      stop = true;
      stream?.getTracks().forEach((track) => track.stop());
    };
  }, [scanning, selected]);

  const mark = async (eventId: number, studentCode: string, status: 'present' | 'absent') => {
    setError('');
    try {
      await mentorRequest(`/api/v1/mentor/campus/events/${eventId}/attendance`, {
        method: 'POST',
        body: JSON.stringify({ code: studentCode, status }),
      });
      setCode('');
      await loadRoster(eventId);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save attendance');
    }
  };

  const endEvent = async (eventId: number) => {
    if (!window.confirm('End this event and save attendance onto student records?')) return;
    setError('');
    try {
      const result = await mentorRequest(`/api/v1/mentor/campus/events/${eventId}/end`, { method: 'POST' }) as { present: number };
      setNotice(`Event ended. ${result.present} joined student${result.present === 1 ? '' : 's'} marked present.`);
      await loadEvents();
      await loadRoster(eventId);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not end the event');
    }
  };

  const openComposer = () => {
    setComposer(true);
    setError('');
    mentorRequest('/api/v1/mentor/home')
      .then((home) => {
        const count = (home as { counts?: { mentees?: number } }).counts?.mentees;
        setCaseloadCount(typeof count === 'number' ? count : null);
      })
      .catch(() => setCaseloadCount(null));
  };

  const addSkill = () => {
    const name = skillInput.trim();
    if (!name || form.skills.some((skill) => skill.toLowerCase() === name.toLowerCase())) return;
    setForm({ ...form, skills: [...form.skills, name] });
    setSkillInput('');
  };

  const publishPost = async (event: FormEvent) => {
    event.preventDefault();
    setError('');
    try {
      if (postKind === 'announcement') {
        await mentorRequest('/api/v1/mentor/campus/announcements', {
          method: 'POST',
          body: JSON.stringify({ content: announce.content, author_role: 'mentor', is_pinned: announce.is_pinned }),
        });
        setAnnounce({ content: '', is_pinned: false });
        setComposer(false);
        setNotice('Announcement posted.');
        return;
      }
      const created = await mentorRequest('/api/v1/mentor/campus/events', {
        method: 'POST',
        body: JSON.stringify({
          title: form.title,
          description: form.description,
          event_type: form.event_type,
          location_details: form.location_details,
          visibility: form.visibility,
          scheduled_at: form.scheduled_at,
          linked_skills: form.skills,
        }),
      }) as { id: number };
      setForm({
        title: '',
        description: '',
        event_type: 'offline',
        location_details: '',
        visibility: 'caseload_only',
        scheduled_at: '',
        skills: [],
      });
      setComposer(false);
      navigate(`${mentorBase()}/campus?event=${created.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not publish');
    }
  };

  const active = events.find((item) => item.id === selected);

  return (
    <div className="space-y-6 p-4 md:p-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Campus</h1>
          <p className="text-sm text-muted-foreground">Open an event, mark who was present, and end it to update student records.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" onClick={openComposer}>Post an announcement or event</Button>
          <Button asChild className="bg-[#0066ff] hover:bg-[#0052cc]">
            <Link to={`${mentorBase()}/create-event`}>Create event</Link>
          </Button>
        </div>
      </div>
      {error && <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">{error}</p>}
      {notice && <p className="rounded-md border border-slate-200 bg-white px-3 py-2 text-sm">{notice}</p>}

      <div className="grid gap-4 lg:grid-cols-[280px_1fr]">
        <Card>
          <CardHeader><CardTitle>Your events</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {!events.length && <p className="text-sm text-muted-foreground">No events yet.</p>}
            {events.map((item) => (
              <button key={item.id} type="button" className={`w-full rounded-md border px-3 py-2 text-left ${selected === item.id ? 'border-[#0066ff] bg-blue-50' : ''}`} onClick={() => loadRoster(item.id).catch((err: Error) => setError(err.message))}>
                <div className="font-medium">{item.title}</div>
                <div className="text-xs text-muted-foreground">{item.scheduled_at} · {item.status}</div>
              </button>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>{active ? active.title : 'Roster'}</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            {!active && <p className="text-sm text-muted-foreground">Choose an event to mark attendance.</p>}
            {active && (
              <>
                <p className="text-sm text-muted-foreground">{active.location || (active.event_type === 'online' ? 'Online' : 'On campus')} · {active.visibility === 'campus_wide' ? 'Whole campus' : 'Caseload'}</p>
                <div className="flex flex-wrap gap-2">
                  <Input className="max-w-xs" placeholder="Student code" value={code} onChange={(e) => setCode(e.target.value)} />
                  <Button type="button" variant="outline" onClick={() => mark(active.id, code, 'present')} disabled={!code.trim()}>Mark present</Button>
                  <Button type="button" variant="outline" onClick={() => setScanning((open) => !open)}>
                    <Camera className="mr-2 h-4 w-4" />{scanning ? 'Stop camera' : 'Open scanner'}
                  </Button>
                  <Button type="button" className="bg-[#eab308] text-slate-900 hover:bg-[#ca8a04]" onClick={() => endEvent(active.id)} disabled={active.status === 'ended'}>End event</Button>
                </div>
                {scanning && <video ref={videoRef} className="h-40 w-full max-w-sm rounded-md bg-slate-900" muted playsInline />}
                {scanNote && <p className="text-sm text-muted-foreground">{scanNote}</p>}
                {!roster.length && <p className="text-sm text-muted-foreground">{active.visibility === 'campus_wide' ? 'No RSVPs yet. Scan a student code when they arrive.' : 'No students on this caseload.'}</p>}
                <ul className="space-y-2">
                  {roster.map((person) => (
                    <li key={person.uid} className="flex flex-wrap items-center justify-between gap-2 rounded-md border bg-white px-3 py-2">
                      <div>
                        <div className="font-medium">{person.name}</div>
                        <div className="text-xs text-muted-foreground">
                          {person.rsvp ? 'RSVP' : 'No RSVP'}
                          {person.joined ? ' · Joined' : ''}
                          {person.attendance ? ` · ${person.attendance}` : ''}
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <Button type="button" size="sm" className="bg-[#0066ff]" onClick={() => mark(active.id, person.uid, 'present')}>Present</Button>
                        <Button type="button" size="sm" variant="outline" onClick={() => mark(active.id, person.uid, 'absent')}>Absent</Button>
                      </div>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      {composer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4" onClick={() => setComposer(false)} role="presentation">
          <form className="max-h-[90vh] w-full max-w-xl overflow-y-auto rounded-xl bg-white p-5 shadow-md" onClick={(event) => event.stopPropagation()} onSubmit={publishPost}>
            <h2 className="text-lg font-semibold text-slate-900">Create</h2>
            <div className="mt-3 flex gap-2">
              <Button type="button" variant={postKind === 'announcement' ? 'default' : 'outline'} className={postKind === 'announcement' ? 'bg-[#0f172a]' : ''} onClick={() => setPostKind('announcement')}>Announcement</Button>
              <Button type="button" variant={postKind === 'event' ? 'default' : 'outline'} className={postKind === 'event' ? 'bg-[#0f172a]' : ''} onClick={() => setPostKind('event')}>Event</Button>
            </div>
            {postKind === 'announcement' ? (
              <label className="mt-4 grid gap-1 text-sm font-medium">
                Announcement
                <textarea className="min-h-28 rounded-md border px-3 py-2" value={announce.content} onChange={(event) => setAnnounce({ ...announce, content: event.target.value })} required />
                <span className="mt-2 flex items-center gap-2 font-normal">
                  <input type="checkbox" checked={announce.is_pinned} onChange={(event) => setAnnounce({ ...announce, is_pinned: event.target.checked })} />
                  Pin to the top
                </span>
              </label>
            ) : (
              <div className="mt-4 grid gap-3">
                <label className="grid gap-1 text-sm font-medium">
                  Title
                  <Input value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} required />
                </label>
                <label className="grid gap-1 text-sm font-medium">
                  Start
                  <Input type="datetime-local" value={form.scheduled_at} onChange={(event) => setForm({ ...form, scheduled_at: event.target.value })} required />
                </label>
                <div className="flex flex-wrap gap-2">
                  <Button type="button" variant={form.event_type === 'online' ? 'default' : 'outline'} className={form.event_type === 'online' ? 'bg-[#0066ff]' : ''} onClick={() => setForm({ ...form, event_type: 'online' })}>Online</Button>
                  <Button type="button" variant={form.event_type === 'offline' ? 'default' : 'outline'} className={form.event_type === 'offline' ? 'bg-[#0066ff]' : ''} onClick={() => setForm({ ...form, event_type: 'offline' })}>Offline</Button>
                </div>
                <label className="grid gap-1 text-sm font-medium">
                  {form.event_type === 'online' ? 'Room name' : 'Place'}
                  <Input placeholder={form.event_type === 'online' ? 'Leave blank to use a generated room' : 'Lab, hall, or meeting point'} value={form.location_details} onChange={(event) => setForm({ ...form, location_details: event.target.value })} />
                </label>
                <div className="flex flex-wrap gap-2">
                  <Button type="button" variant={form.visibility === 'caseload_only' ? 'default' : 'outline'} className={form.visibility === 'caseload_only' ? 'bg-[#0f172a]' : ''} onClick={() => setForm({ ...form, visibility: 'caseload_only' })}>
                    {caseloadCount == null ? 'My caseload' : `My caseload (${caseloadCount})`}
                  </Button>
                  <Button type="button" variant={form.visibility === 'campus_wide' ? 'default' : 'outline'} className={form.visibility === 'campus_wide' ? 'bg-[#0f172a]' : ''} onClick={() => setForm({ ...form, visibility: 'campus_wide' })}>Entire campus</Button>
                </div>
                <label className="grid gap-1 text-sm font-medium">
                  Target skills
                  <span className="flex gap-2">
                    <Input value={skillInput} onChange={(event) => setSkillInput(event.target.value)} placeholder="Skill name" />
                    <Button type="button" variant="outline" onClick={addSkill}>Add</Button>
                  </span>
                  <span className="flex flex-wrap gap-2">
                    {form.skills.map((skill) => (
                      <button key={skill} type="button" className="rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-xs text-blue-800" onClick={() => setForm({ ...form, skills: form.skills.filter((item) => item !== skill) })}>{skill}</button>
                    ))}
                  </span>
                </label>
                <label className="grid gap-1 text-sm font-medium">
                  Description
                  <textarea className="min-h-24 rounded-md border px-3 py-2" value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} />
                </label>
              </div>
            )}
            <div className="mt-4 flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setComposer(false)}>Cancel</Button>
              <Button type="submit" className="bg-[#eab308] text-slate-900 hover:bg-[#ca8a04]">Publish</Button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
