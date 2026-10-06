import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Activity, useSaveActivity } from '@/services/activitiesService';
import { useMentees } from '@/services/dashboardService';
import { toast } from 'sonner';

export default function ActivityDialog({ activity, open, onOpenChange }: { activity?: Activity; open: boolean; onOpenChange: (open: boolean) => void }) {
  const { mentees } = useMentees();
  const [title, setTitle] = useState(activity?.title ?? '');
  const [usn, setUsn] = useState(activity?.usn ?? '');
  const [deadline, setDeadline] = useState(activity?.deadline ?? '');
  const [term, setTerm] = useState<Activity['termType']>(activity?.termType ?? 'Short Term');
  const [category, setCategory] = useState(activity?.category ?? 'Research');
  const [status, setStatus] = useState<Activity['status']>(activity?.status ?? 'pending');
  const [remarks, setRemarks] = useState(activity?.remarks ?? '');
  const save = useSaveActivity();
  return <Dialog open={open} onOpenChange={onOpenChange}>
    <DialogContent className="max-h-[90vh] overflow-y-auto">
      <DialogHeader><DialogTitle>{activity ? 'Update Activity' : 'New Activity'}</DialogTitle></DialogHeader>
      <form className="grid gap-4" onSubmit={event => {
        event.preventDefault();
        const mentee = mentees.find(item => item.usn === (usn || mentees[0]?.usn));
        if (!mentee || !title.trim() || !deadline) return;
        save.mutate({
          id: activity?.id ?? '', numeric_id: activity?.numeric_id, title: title.trim(), usn: mentee.usn, studentName: mentee.name,
          deadline, category, termType: term, status, remarks: remarks.trim() || null,
          proof: null, benefitted: status === 'completed', completionDays: activity?.completionDays ?? null,
        }, {
          onSuccess: () => { toast.success('Activity saved'); onOpenChange(false); },
          onError: (error: Error) => toast.error(error.message),
        });
      }}>
        <label className="grid gap-2 text-sm">Activity<Input required value={title} onChange={e => setTitle(e.target.value)} /></label>
        <div className="grid gap-2 text-sm">Mentee<Select value={usn || mentees[0]?.usn || ''} onValueChange={setUsn}><SelectTrigger aria-label="Mentee"><SelectValue /></SelectTrigger><SelectContent>{mentees.map(m => <SelectItem key={m.usn} value={m.usn}>{m.name}</SelectItem>)}</SelectContent></Select></div>
        <div className="grid grid-cols-2 gap-3">
          <div className="grid gap-2 text-sm">Term<Select value={term} onValueChange={value => setTerm(value as Activity['termType'])}><SelectTrigger aria-label="Term"><SelectValue /></SelectTrigger><SelectContent>{['Short Term', 'Mid Term', 'Long Term'].map(value => <SelectItem key={value} value={value}>{value}</SelectItem>)}</SelectContent></Select></div>
          <label className="grid gap-2 text-sm">Deadline<Input type="date" required value={deadline} onChange={e => setDeadline(e.target.value)} /></label>
        </div>
        <div className="grid gap-2 text-sm">Category<Select value={category} onValueChange={setCategory}><SelectTrigger aria-label="Category"><SelectValue /></SelectTrigger><SelectContent>{['Research', 'Technical', 'Career', 'Soft Skills', 'Other'].map(value => <SelectItem key={value} value={value}>{value}</SelectItem>)}</SelectContent></Select></div>
        {activity && <div className="grid gap-2 text-sm">Status<Select value={status} onValueChange={value => setStatus(value as Activity['status'])}><SelectTrigger aria-label="Status"><SelectValue /></SelectTrigger><SelectContent>{['pending', 'in-progress', 'completed', 'overdue', 'rejected'].map(value => <SelectItem key={value} value={value}>{value}</SelectItem>)}</SelectContent></Select></div>}
        <label className="grid gap-2 text-sm">Mentor Remarks<Textarea value={remarks} onChange={e => setRemarks(e.target.value)} /></label>
        <div className="flex justify-end gap-2"><Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button><Button disabled={save.isPending} type="submit">{save.isPending ? 'Saving…' : 'Save Activity'}</Button></div>
      </form>
    </DialogContent>
  </Dialog>;
}