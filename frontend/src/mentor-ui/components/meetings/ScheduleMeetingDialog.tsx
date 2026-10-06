import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useScheduleMeeting } from '@/services/meetingsService';
import { useMentees } from '@/services/dashboardService';
import { toast } from 'sonner';

export default function ScheduleMeetingDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const { mentees } = useMentees();
  const [title, setTitle] = useState('');
  const [dateTime, setDateTime] = useState('');
  const [duration, setDuration] = useState('30');
  const [mentee, setMentee] = useState('');
  const [location, setLocation] = useState('Virtual');
  const [agenda, setAgenda] = useState('');
  const schedule = useScheduleMeeting();
  return <Dialog open={open} onOpenChange={onOpenChange}>
    <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
      <DialogHeader><DialogTitle>Schedule New Meeting</DialogTitle></DialogHeader>
      <form className="grid gap-4" onSubmit={event => {
        event.preventDefault();
        const date = new Date(dateTime);
        if (!Number.isFinite(date.getTime()) || date <= new Date()) { toast.error('Choose a future date and time.'); return; }
        const chosen = mentee || mentees[0]?.usn;
        if (!chosen) return;
        schedule.mutate({
          student_usn: chosen,
          meeting_date: dateTime,
          venue: location,
          agenda: agenda.trim() || title.trim(),
          duration: Number(duration),
          meeting_mode: location === 'Virtual' ? 'online' : 'offline',
        }, {
          onSuccess: () => { toast.success('Meeting scheduled'); setTitle(''); setAgenda(''); setDateTime(''); onOpenChange(false); },
          onError: (error: Error) => toast.error(error.message),
        });
      }}>
        <label className="grid gap-2 text-sm">Meeting Title<Input required value={title} onChange={e => setTitle(e.target.value)} /></label>
        <label className="grid gap-2 text-sm">Date & Time<Input required type="datetime-local" value={dateTime} onChange={e => setDateTime(e.target.value)} /></label>
        <div className="grid gap-2 text-sm">Duration<Select value={duration} onValueChange={setDuration}><SelectTrigger aria-label="Duration"><SelectValue /></SelectTrigger><SelectContent>{['15', '30', '45', '60', '90'].map(d => <SelectItem key={d} value={d}>{d} minutes</SelectItem>)}</SelectContent></Select></div>
        <div className="grid gap-2 text-sm">Mentee<Select value={mentee || mentees[0]?.usn || ''} onValueChange={setMentee}><SelectTrigger aria-label="Mentee"><SelectValue /></SelectTrigger><SelectContent>{mentees.map(m => <SelectItem key={m.usn} value={m.usn}>{m.name}</SelectItem>)}</SelectContent></Select></div>
        <div className="grid gap-2 text-sm">Location<Select value={location} onValueChange={setLocation}><SelectTrigger aria-label="Location"><SelectValue /></SelectTrigger><SelectContent>{['Virtual', 'Department Office', 'Library Study Room'].map(l => <SelectItem key={l} value={l}>{l}</SelectItem>)}</SelectContent></Select></div>
        <label className="grid gap-2 text-sm">Agenda<Textarea value={agenda} onChange={e => setAgenda(e.target.value)} /></label>
        <div className="flex justify-end gap-2"><Button variant="outline" type="button" onClick={() => onOpenChange(false)}>Cancel</Button><Button disabled={schedule.isPending || !title.trim()} type="submit">{schedule.isPending ? 'Scheduling…' : 'Schedule Meeting'}</Button></div>
      </form>
    </DialogContent>
  </Dialog>;
}
