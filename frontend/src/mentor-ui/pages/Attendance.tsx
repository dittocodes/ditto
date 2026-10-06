import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Camera, Check, CheckCircle2, Download, QrCode, Search, Users, X, Clock } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { mentorRequest } from '@/services/api';
import { exportSpreadsheet } from '@/lib/exportSpreadsheet';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

type Status = 'present' | 'absent' | 'unmarked';
interface AttendanceBody {
  students: { usn: string; name: string }[];
  sessions: { session_id: string; session_name: string; qr_code_data?: string; created_at?: string }[];
  marks: Record<string, Record<string, { status?: string; method?: string }>>;
}

export default function Attendance() {
  const client = useQueryClient();
  const attendance = useQuery({
    queryKey: ['mentor-attendance'],
    queryFn: () => mentorRequest('/api/v1/mentor/attendance') as Promise<AttendanceBody>,
    refetchInterval: 15000,
  });
  const students = attendance.data?.students || [];
  const sessions = attendance.data?.sessions || [];
  const [session, setSession] = useState('');
  const active = session || sessions[0]?.session_id || '';
  const [query, setQuery] = useState('');
  const [scanId, setScanId] = useState('');
  const [scanner, setScanner] = useState(false);
  const [lastScan, setLastScan] = useState('');
  const [filter, setFilter] = useState('all');
  const [sessionName, setSessionName] = useState('');
  const marks = attendance.data?.marks?.[active] || {};
  const statusOf = (usn: string): Status => {
    const value = marks[usn]?.status;
    return value === 'present' || value === 'absent' ? value : 'unmarked';
  };
  const present = students.filter((row) => statusOf(row.usn) === 'present').length;
  const absent = students.filter((row) => statusOf(row.usn) === 'absent').length;
  const current = sessions.find((row) => row.session_id === active);
  const mark = async (usn: string, status: Status, method = 'Manual') => {
    if (!active) return;
    await mentorRequest('/api/v1/mentor/attendance/mark', {
      method: 'POST',
      body: JSON.stringify({ session_id: active, student_usn: usn, status, method }),
    });
    await client.invalidateQueries({ queryKey: ['mentor-attendance'] });
  };
  const createSession = async () => {
    const name = sessionName.trim();
    if (!name) return;
    const created = await mentorRequest('/api/v1/mentor/attendance/sessions', {
      method: 'POST',
      body: JSON.stringify({ session_name: name, location: 'Department office' }),
    }) as { session_id: string };
    setSessionName('');
    setSession(created.session_id);
    await client.invalidateQueries({ queryKey: ['mentor-attendance'] });
  };
  const scan = async () => {
    const mentee = students.find((row) => row.usn === scanId);
    if (!mentee || !active) return;
    await mark(scanId, 'present', 'QR');
    setLastScan(mentee.name);
  };
  const rows = students.filter((row) => `${row.name} ${row.usn}`.toLowerCase().includes(query.toLowerCase()) && (filter === 'all' || statusOf(row.usn) === filter));
  return <div className="space-y-6">
    <div className="flex flex-wrap items-center justify-between gap-4"><div><h1 className="text-2xl font-semibold">Mentee Attendance</h1><p className="mt-1 text-xs text-muted-foreground">{current?.session_name || 'Choose a session'}</p></div><Button variant="outline" size="sm" onClick={() => exportSpreadsheet('mentee-attendance', students.map((row) => ({ USN: row.usn, Name: row.name, Status: statusOf(row.usn), Method: marks[row.usn]?.method || '', Session: current?.session_name || '' })))}><Download />Export Excel</Button></div>
    <div className="flex flex-wrap items-center gap-3"><span className="text-sm font-medium">Session</span>
      {sessions.length ? <Select value={active} onValueChange={(value) => { setSession(value); setLastScan(''); setScanner(false); }}><SelectTrigger className="w-full sm:w-80" aria-label="Attendance session"><SelectValue /></SelectTrigger><SelectContent>{sessions.map((row) => <SelectItem key={row.session_id} value={row.session_id}>{row.session_name}</SelectItem>)}</SelectContent></Select> : <span className="text-sm text-muted-foreground">No session yet</span>}
      <Input aria-label="New session name" placeholder="New session name" value={sessionName} onChange={(event) => setSessionName(event.target.value)} className="w-full sm:w-64" />
      <Button variant="outline" onClick={createSession} disabled={!sessionName.trim()}>Start session</Button>
    </div>
    <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">{[{ label: 'Total mentees', value: students.length, icon: Users, colour: 'text-primary bg-primary/10' }, { label: 'Present', value: present, icon: CheckCircle2, colour: 'text-success bg-success/10' }, { label: 'Absent', value: absent, icon: X, colour: 'text-destructive bg-destructive/10' }, { label: 'Unmarked', value: Math.max(students.length - present - absent, 0), icon: Clock, colour: 'text-warning bg-warning/10' }].map((item) => <div key={item.label} className="flex items-center justify-between rounded-lg border bg-card p-4"><div><p className="text-xs text-muted-foreground">{item.label}</p><p className="mt-1 text-2xl font-semibold">{item.value}</p></div><item.icon className={cn('h-10 w-10 rounded-md p-2.5', item.colour)} /></div>)}</div>
    <Tabs defaultValue="manual"><TabsList><TabsTrigger value="manual" className="gap-2"><Users className="h-4 w-4" />Manual Marking</TabsTrigger><TabsTrigger value="qr" className="gap-2"><QrCode className="h-4 w-4" />QR Attendance</TabsTrigger></TabsList>
      <TabsContent value="qr" className="mt-5"><div className="grid gap-8 border-y bg-card px-5 py-6 lg:grid-cols-2"><section className="flex flex-col items-center gap-4"><h2 className="text-base font-semibold">Session QR Code</h2><div className="rounded-md border p-4">{current?.qr_code_data ? <QRCodeSVG value={current.qr_code_data} size={180} /> : <p className="text-sm text-muted-foreground">Start a session to generate a code.</p>}</div><span className="text-xs font-medium text-muted-foreground">{current?.session_name || 'No active session'}</span></section><section className="space-y-4"><h2 className="text-base font-semibold">Scan Mentee QR</h2><div className="flex h-40 items-center justify-center rounded-md border border-dashed bg-muted/40"><div className="text-center"><Camera className="mx-auto mb-3 h-8 w-8 text-muted-foreground" /><p className="text-sm text-muted-foreground">{scanner ? 'Choose a mentee code below' : 'Scanner preview'}</p></div></div><Button variant="outline" onClick={() => setScanner(!scanner)}><Camera />{scanner ? 'Close Preview' : 'Open Scanner Preview'}</Button>{students.length ? <Select value={scanId || students[0].usn} onValueChange={setScanId}><SelectTrigger aria-label="QR mentee"><SelectValue /></SelectTrigger><SelectContent>{students.map((row) => <SelectItem key={row.usn} value={row.usn}>{row.name} · {row.usn}</SelectItem>)}</SelectContent></Select> : null}<Button onClick={scan} disabled={!active}><QrCode />Mark present from QR</Button>{lastScan && <p role="status" className="flex items-center gap-2 text-sm text-success"><CheckCircle2 className="h-4 w-4" />{lastScan} marked present</p>}</section></div></TabsContent>
      <TabsContent value="manual" className="mt-5"><div className="mb-4 flex flex-wrap gap-3"><div className="relative min-w-[180px] flex-1"><Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" /><Input aria-label="Search attendance" placeholder="Search mentee or USN…" value={query} onChange={(event) => setQuery(event.target.value)} className="pl-9" /></div><Select value={filter} onValueChange={setFilter}><SelectTrigger className="w-40" aria-label="Attendance status filter"><SelectValue /></SelectTrigger><SelectContent>{['all', 'present', 'absent', 'unmarked'].map((value) => <SelectItem key={value} value={value}>{value === 'all' ? 'All statuses' : value[0].toUpperCase() + value.slice(1)}</SelectItem>)}</SelectContent></Select><Button variant="outline" disabled={!active} onClick={async () => { for (const row of students) await mark(row.usn, 'present'); toast.success('Marked present'); }}><CheckCircle2 />Mark All Present</Button></div>
        <div className="overflow-x-auto rounded-lg border bg-card"><table className="w-full min-w-[560px] text-left text-sm"><thead className="border-b bg-muted/50 text-xs text-muted-foreground"><tr><th className="px-4 py-3">Mentee</th><th className="px-4 py-3">USN</th><th className="px-4 py-3">Status</th><th className="px-4 py-3">Method</th><th className="px-4 py-3 text-right">Mark Attendance</th></tr></thead><tbody>{rows.map((row) => <tr key={row.usn} className="border-b last:border-0"><td className="px-4 py-3 font-medium">{row.name}</td><td className="px-4 py-3 text-muted-foreground">{row.usn}</td><td className="px-4 py-3"><span className={cn('text-xs capitalize', statusOf(row.usn) === 'present' ? 'text-success' : statusOf(row.usn) === 'absent' ? 'text-destructive' : 'text-muted-foreground')}>{statusOf(row.usn)}</span></td><td className="px-4 py-3 text-xs text-muted-foreground">{marks[row.usn]?.method || '—'}</td><td className="px-4 py-3"><div className="flex justify-end gap-1"><Button size="icon" variant={statusOf(row.usn) === 'present' ? 'secondary' : 'ghost'} className="h-8 w-8 text-success" aria-label={`Mark ${row.name} present`} title="Present" onClick={() => mark(row.usn, 'present')}><Check /></Button><Button size="icon" variant={statusOf(row.usn) === 'absent' ? 'secondary' : 'ghost'} className="h-8 w-8 text-destructive" aria-label={`Mark ${row.name} absent`} title="Absent" onClick={() => mark(row.usn, 'absent')}><X /></Button><Button size="icon" variant="ghost" className="h-8 w-8 text-muted-foreground" aria-label={`Reset ${row.name}`} title="Reset" onClick={() => mark(row.usn, 'unmarked')}><Clock /></Button></div></td></tr>)}</tbody></table>{!rows.length && <p className="p-8 text-center text-sm text-muted-foreground">No mentees found.</p>}</div>
      </TabsContent>
    </Tabs>
  </div>;
}
