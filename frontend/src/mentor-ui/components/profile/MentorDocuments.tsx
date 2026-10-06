import { useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { FileText, Upload } from 'lucide-react';
import { mentorRequest } from '@/services/api';
import { API_BASE_URL } from '../../../api.js';
import { toast } from 'sonner';

interface DocRow {
  id: number;
  filename: string;
  category?: string;
  summary?: string;
  status?: string;
}

export default function MentorDocuments() {
  const client = useQueryClient();
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const docs = useQuery({
    queryKey: ['mentor-documents'],
    queryFn: () => mentorRequest('/api/v1/mentor/documents') as Promise<DocRow[]>,
    refetchInterval: 15000,
  });
  const upload = async (files: FileList | null) => {
    if (!files?.length) return;
    const body = new FormData();
    Array.from(files).forEach((file) => body.append('files', file));
    setBusy(true);
    try {
      await mentorRequest('/api/v1/mentor/documents', { method: 'POST', body });
      await Promise.all([
        client.invalidateQueries({ queryKey: ['mentor-documents'] }),
        client.invalidateQueries({ queryKey: ['profileData'] }),
      ]);
      toast.success('Documents saved');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Upload failed');
    } finally {
      setBusy(false);
      if (input.current) input.current.value = '';
    }
  };
  const openFile = async (id: number) => {
    const token = sessionStorage.getItem('access_token');
    const res = await fetch(`${API_BASE_URL}/api/v1/mentor/documents/${id}/file`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    if (!res.ok) {
      toast.error('Could not open that file');
      return;
    }
    const blob = await res.blob();
    window.open(URL.createObjectURL(blob), '_blank', 'noopener');
  };
  const rows = docs.data || [];
  return (
    <Card>
      <CardContent className="pt-6">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h2 className="flex items-center gap-2 text-xl font-bold"><FileText className="text-primary" size={22} /> Documents</h2>
          <Button type="button" disabled={busy} onClick={() => input.current?.click()}><Upload className="h-4 w-4" />{busy ? 'Reading…' : 'Upload documents'}</Button>
          <input ref={input} type="file" multiple className="hidden" onChange={(event) => upload(event.target.files)} />
        </div>
        <p className="mb-4 text-sm text-muted-foreground">Uploaded files fill the profile only with details printed in the document.</p>
        <div className="space-y-3">
          {rows.map((row) => (
            <div key={row.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border p-4">
              <div>
                <p className="font-medium">{row.filename}</p>
                <p className="text-xs text-muted-foreground">{row.category || 'Uncategorised'} · {row.status || 'saved'}</p>
                {row.summary ? <p className="mt-1 text-sm text-muted-foreground">{row.summary}</p> : null}
              </div>
              <Button variant="outline" size="sm" onClick={() => openFile(row.id)}>View</Button>
            </div>
          ))}
          {!rows.length && <p className="text-sm text-muted-foreground">No documents uploaded yet.</p>}
        </div>
      </CardContent>
    </Card>
  );
}
