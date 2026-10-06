import { FormEvent, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { mentorBase } from '@/paths';
import { mentorRequest } from '@/services/api';

export default function CreateEvent() {
  const navigate = useNavigate();
  const [error, setError] = useState('');
  const [form, setForm] = useState({
    title: '',
    description: '',
    event_type: 'offline',
    location_details: '',
    visibility: 'caseload_only',
    scheduled_at: '',
    skills: '',
  });

  const createEvent = async (event: FormEvent) => {
    event.preventDefault();
    setError('');
    try {
      const created = await mentorRequest('/api/v1/mentor/campus/events', {
        method: 'POST',
        body: JSON.stringify({
          title: form.title,
          description: form.description,
          event_type: form.event_type,
          location_details: form.location_details,
          visibility: form.visibility,
          scheduled_at: form.scheduled_at,
          linked_skills: form.skills.split(',').map((item) => item.trim()).filter(Boolean),
        }),
      }) as { id: number };
      navigate(`${mentorBase()}/campus?event=${created.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not create the event');
    }
  };

  return (
    <div className="space-y-6 p-4 md:p-6">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Create event</h1>
        <p className="text-sm text-muted-foreground">Publish an event for your caseload or the whole campus. Students do not upload a proof for it. Attendance is taken from the Campus page.</p>
      </div>
      {error && <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">{error}</p>}
      <Card>
        <CardHeader><CardTitle>Event details</CardTitle></CardHeader>
        <CardContent>
          <form className="grid max-w-3xl gap-3 md:grid-cols-2" onSubmit={createEvent}>
            <label className="grid gap-1 text-sm font-medium">
              Title
              <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} required />
            </label>
            <label className="grid gap-1 text-sm font-medium">
              Start
              <Input type="datetime-local" value={form.scheduled_at} onChange={(e) => setForm({ ...form, scheduled_at: e.target.value })} required />
            </label>
            <label className="grid gap-1 text-sm font-medium">
              Format
              <select className="h-10 rounded-md border px-3" value={form.event_type} onChange={(e) => setForm({ ...form, event_type: e.target.value })}>
                <option value="offline">In person</option>
                <option value="online">Online</option>
              </select>
            </label>
            <label className="grid gap-1 text-sm font-medium">
              Who can see it
              <select className="h-10 rounded-md border px-3" value={form.visibility} onChange={(e) => setForm({ ...form, visibility: e.target.value })}>
                <option value="caseload_only">My caseload</option>
                <option value="campus_wide">Whole campus</option>
              </select>
            </label>
            <label className="grid gap-1 text-sm font-medium md:col-span-2">
              {form.event_type === 'online' ? 'Room name' : 'Place'}
              <Input placeholder={form.event_type === 'online' ? 'Leave blank to use a generated room' : 'Lab, hall, or meeting point'} value={form.location_details} onChange={(e) => setForm({ ...form, location_details: e.target.value })} />
            </label>
            <label className="grid gap-1 text-sm font-medium md:col-span-2">
              Skill names
              <Input placeholder="Separated by commas. Names only, no scores." value={form.skills} onChange={(e) => setForm({ ...form, skills: e.target.value })} />
            </label>
            <label className="grid gap-1 text-sm font-medium md:col-span-2">
              Description
              <textarea className="min-h-28 rounded-md border px-3 py-2" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
            </label>
            <Button type="submit" className="w-fit bg-[#0066ff] hover:bg-[#0052cc]">Publish event</Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
