import { useEffect, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, CheckCheck, MessageSquare, Search, Send } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { mentorRequest } from '@/services/api';
import { mentorBase } from '@/paths';
import { cn } from '@/lib/utils';

type InboxRow = { usn: string; name: string; preview: string };
type Message = { id: number; content: string; sender: string; created_at?: string };
const initials = (name: string) => name.split(' ').filter(Boolean).map((part) => part[0]).join('');
const timeLabel = (value?: string) => value ? new Date(value).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }) : '';

export default function Chat() {
  const params = useParams();
  const menteeId = params.menteeId || params.student_usn;
  const base = mentorBase();
  const client = useQueryClient();
  const inbox = useQuery({
    queryKey: ['mentor-inbox'],
    queryFn: () => mentorRequest('/api/v1/mentor/messages') as Promise<InboxRow[]>,
    refetchInterval: 4000,
  });
  const thread = useQuery({
    queryKey: ['mentor-thread', menteeId],
    enabled: Boolean(menteeId),
    queryFn: () => mentorRequest(`/api/v1/mentor/messages/${menteeId}`) as Promise<{ name: string; usn: string; messages: Message[] }>,
    refetchInterval: 4000,
  });
  const people = inbox.data || [];
  const mentee = people.find((item) => item.usn === menteeId);
  const [query, setQuery] = useState('');
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const input = useRef<HTMLTextAreaElement>(null);
  const end = useRef<HTMLDivElement>(null);
  const messages = thread.data?.messages || [];
  useEffect(() => { setDraft(''); input.current?.focus(); }, [menteeId]);
  useEffect(() => { end.current?.scrollIntoView({ block: 'nearest' }); }, [messages.length, menteeId]);
  const send = async () => {
    if (!menteeId || !draft.trim() || sending) return;
    setSending(true);
    try {
      await mentorRequest(`/api/v1/mentor/messages/${menteeId}`, { method: 'POST', body: JSON.stringify({ content: draft.trim() }) });
      setDraft('');
      await Promise.all([
        client.invalidateQueries({ queryKey: ['mentor-thread', menteeId] }),
        client.invalidateQueries({ queryKey: ['mentor-inbox'] }),
      ]);
      input.current?.focus();
    } finally {
      setSending(false);
    }
  };
  const visible = people.filter((item) => `${item.name} ${item.usn}`.toLowerCase().includes(query.toLowerCase()));
  return <div className="space-y-5">
    <div className="flex items-center gap-3"><MessageSquare className="h-6 w-6 text-primary" /><div><h1 className="text-2xl font-semibold">Mentee Chat</h1><p className="text-xs text-muted-foreground">Messages with assigned mentees</p></div></div>
    <div className="grid h-[calc(100dvh-210px)] min-h-[480px] grid-cols-1 overflow-hidden rounded-lg border bg-card md:grid-cols-[260px_minmax(0,1fr)]">
      <section className={cn('min-h-0 flex-col border-r', mentee ? 'hidden md:flex' : 'flex')}>
        <div className="border-b p-4"><div className="mb-3 flex justify-between text-sm font-semibold"><span>Messages</span><span className="text-muted-foreground">{people.length}</span></div><div className="relative"><Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" /><Input aria-label="Search conversations" placeholder="Search mentees…" className="pl-9" value={query} onChange={(event) => setQuery(event.target.value)} /></div></div>
        <div className="flex-1 overflow-y-auto">{visible.map((item, index) => <Button asChild variant="ghost" key={item.usn} className={cn('h-auto w-full justify-start whitespace-normal rounded-none border-b px-4 py-4', menteeId === item.usn && 'bg-primary/10 hover:bg-primary/10')}><Link to={`${base}/chat/${item.usn}`}><Avatar><AvatarFallback className={cn('text-xs', index % 2 ? 'bg-info/10 text-info' : 'bg-primary/10 text-primary')}>{initials(item.name)}</AvatarFallback></Avatar><span className="min-w-0 text-left"><span className="block truncate text-sm font-semibold">{item.name}</span><span className="block truncate text-xs font-normal text-muted-foreground">{item.preview || 'No messages yet'}</span></span></Link></Button>)}{!visible.length && <p className="p-6 text-sm text-muted-foreground">No mentees found.</p>}</div>
      </section>
      {mentee ? <section className="flex min-h-0 min-w-0 flex-col">
        <div className="flex items-center gap-3 border-b px-5 py-4"><Button asChild variant="ghost" size="icon" className="md:hidden" aria-label="Back to conversations"><Link to={`${base}/chat`}><ArrowLeft /></Link></Button><Avatar><AvatarFallback className="bg-primary/10 text-primary">{initials(mentee.name)}</AvatarFallback></Avatar><div><h2 className="font-semibold">{mentee.name}</h2><p className="text-xs text-muted-foreground">{mentee.usn} · Mentee</p></div></div>
        <div className="flex-1 space-y-5 overflow-y-auto bg-muted/30 p-5">{messages.map((message) => <div key={message.id} className={cn('flex', message.sender === 'mentor' ? 'justify-end' : 'justify-start')}><div className="max-w-[85%] sm:max-w-[75%]"><p className={cn('whitespace-pre-wrap break-words rounded-lg px-4 py-3 text-sm leading-relaxed', message.sender === 'mentor' ? 'bg-primary text-primary-foreground' : 'border bg-card text-card-foreground')}>{message.content}</p><div className={cn('mt-1 flex items-center gap-1 text-[11px] text-muted-foreground', message.sender === 'mentor' && 'justify-end')}>{timeLabel(message.created_at)}{message.sender === 'mentor' && <CheckCheck className="h-3.5 w-3.5 text-primary" />}</div></div></div>)}{!messages.length && <p className="text-center text-sm text-muted-foreground">No messages yet. Send the first note.</p>}<div ref={end} /></div>
        <form className="flex items-end gap-3 border-t p-4" onSubmit={(event) => { event.preventDefault(); send(); }}><Textarea ref={input} aria-label="Message" placeholder={`Message ${mentee.name.split(' ')[0]}…`} value={draft} onChange={(event) => setDraft(event.target.value)} className="min-h-[44px] max-h-32 resize-none" onKeyDown={(event) => { if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); send(); } }} /><Button type="submit" size="icon" aria-label="Send message" title="Send message" disabled={!draft.trim() || sending} className="shrink-0"><Send /></Button></form>
      </section> : <section className="hidden flex-col items-center justify-center gap-3 text-muted-foreground md:flex"><MessageSquare className="h-10 w-10 text-primary/60" /><h2 className="font-medium text-foreground">Mentee conversations</h2></section>}
    </div>
  </div>;
}
