import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Separator } from '@/components/ui/separator';
import { ArrowLeft, Mail, Phone, MapPin, FileDown, Loader2, Send, ExternalLink } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/hooks/useAuth';
import { ProjectState, WALL_TYPE_LABELS } from '@/lib/types';
import { generateEngineeringSitePlan } from '@/lib/pdfSitePlan';
import { defaultBranding } from '@/lib/branding';

const STATUSES = ['new','contacted','quoted','engineering','delivered','won','lost'] as const;

type Submission = {
  id: string; client_name: string | null; client_email: string | null; client_phone: string | null;
  company_name: string | null; is_builder: boolean; address: string | null; suburb: string | null;
  state: string | null; postcode: string | null; lat: number | null; lng: number | null;
  wall_count: number; total_length: number; max_height: number; current_step: number;
  status: string; assignee_id: string | null; project_data: any;
  created_at: string; updated_at: string; last_activity_at: string;
};
type Note = { id: string; body: string; created_at: string; author_id: string | null };
type Activity = { id: string; event_type: string; details: any; created_at: string };
type AdminUser = { id: string; display_name: string | null; email: string | null };

const SubmissionDetail = () => {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const [sub, setSub] = useState<Submission | null>(null);
  const [notes, setNotes] = useState<Note[]>([]);
  const [activity, setActivity] = useState<Activity[]>([]);
  const [admins, setAdmins] = useState<AdminUser[]>([]);
  const [newNote, setNewNote] = useState('');
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);

  const load = async () => {
    if (!id) return;
    setLoading(true);
    const [{ data: s }, { data: n }, { data: a }, { data: r }] = await Promise.all([
      supabase.from('submissions').select('*').eq('id', id).maybeSingle(),
      supabase.from('submission_notes').select('*').eq('submission_id', id).order('created_at', { ascending: false }),
      supabase.from('submission_activity').select('*').eq('submission_id', id).order('created_at', { ascending: false }).limit(50),
      supabase.from('user_roles').select('user_id, profiles:user_id(id,display_name,email)').eq('role', 'admin'),
    ]);
    setSub(s as any);
    setNotes((n ?? []) as any);
    setActivity((a ?? []) as any);
    setAdmins(((r ?? []) as any[]).map(x => x.profiles).filter(Boolean));
    setLoading(false);
  };

  useEffect(() => { load(); }, [id]);

  const updateStatus = async (status: string) => {
    if (!id || !sub) return;
    const prev = sub.status;
    const { error } = await supabase.from('submissions').update({ status: status as any }).eq('id', id);
    if (error) return toast.error(error.message);
    await supabase.from('submission_activity').insert({ submission_id: id, actor_id: user?.id, event_type: 'status_changed', details: { from: prev, to: status } });
    toast.success('Status updated');
    load();
  };

  const updateAssignee = async (assigneeId: string) => {
    if (!id) return;
    const val = assigneeId === 'unassigned' ? null : assigneeId;
    const { error } = await supabase.from('submissions').update({ assignee_id: val }).eq('id', id);
    if (error) return toast.error(error.message);
    await supabase.from('submission_activity').insert({ submission_id: id, actor_id: user?.id, event_type: 'assigned', details: { to: val } });
    toast.success('Assignee updated');
    load();
  };

  const addNote = async () => {
    if (!id || !newNote.trim()) return;
    const { error } = await supabase.from('submission_notes').insert({ submission_id: id, body: newNote.trim(), author_id: user?.id });
    if (error) return toast.error(error.message);
    await supabase.from('submission_activity').insert({ submission_id: id, actor_id: user?.id, event_type: 'note_added' });
    setNewNote('');
    load();
  };

  const regeneratePdf = async () => {
    if (!sub?.project_data) return;
    setExporting(true);
    try {
      await generateEngineeringSitePlan(sub.project_data as ProjectState, undefined, defaultBranding);
      toast.success('Site plan regenerated');
    } catch (e: any) {
      toast.error(e?.message ?? 'Failed');
    } finally { setExporting(false); }
  };

  if (loading) return <div className="p-12 grid place-items-center"><Loader2 className="h-6 w-6 animate-spin" /></div>;
  if (!sub) return <div className="p-6"><Link to="/admin" className="text-sm text-primary">← Back</Link><p className="mt-4">Submission not found.</p></div>;

  const proj = (sub.project_data ?? {}) as Partial<ProjectState>;
  const walls = proj.walls ?? [];
  const ctx = proj.siteContext;
  const displayName = sub.is_builder && sub.company_name ? sub.company_name : (sub.client_name || '—');

  return (
    <div className="p-6 space-y-6 max-w-6xl">
      <div className="flex items-center gap-2">
        <Button asChild variant="ghost" size="sm"><Link to="/admin"><ArrowLeft className="h-4 w-4 mr-1" /> Back</Link></Button>
      </div>

      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold">{displayName}</h1>
          <p className="text-sm text-muted-foreground flex items-center gap-1 mt-1"><MapPin className="h-3.5 w-3.5" /> {sub.address}</p>
          <div className="flex gap-3 mt-2 text-sm">
            {sub.client_email && <a href={`mailto:${sub.client_email}`} className="flex items-center gap-1 text-primary hover:underline"><Mail className="h-3.5 w-3.5" />{sub.client_email}</a>}
            {sub.client_phone && <a href={`tel:${sub.client_phone}`} className="flex items-center gap-1 text-primary hover:underline"><Phone className="h-3.5 w-3.5" />{sub.client_phone}</a>}
          </div>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Select value={sub.status} onValueChange={updateStatus}>
            <SelectTrigger className="w-[160px]"><SelectValue /></SelectTrigger>
            <SelectContent>{STATUSES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
          </Select>
          <Select value={sub.assignee_id ?? 'unassigned'} onValueChange={updateAssignee}>
            <SelectTrigger className="w-[180px]"><SelectValue placeholder="Assign" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="unassigned">Unassigned</SelectItem>
              {admins.map(a => <SelectItem key={a.id} value={a.id}>{a.display_name || a.email}</SelectItem>)}
            </SelectContent>
          </Select>
          {sub.client_email && (
            <Button variant="outline" asChild>
              <a href={`mailto:${sub.client_email}?subject=Your retaining wall enquiry - ${sub.address}&body=Hi ${sub.client_name ?? ''},%0D%0A%0D%0A`}>
                <Send className="h-4 w-4 mr-2" /> Email
              </a>
            </Button>
          )}
          <Button onClick={regeneratePdf} disabled={exporting}>
            {exporting ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <FileDown className="h-4 w-4 mr-2" />}
            Regenerate PDF
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardHeader><CardTitle className="text-base">Project overview</CardTitle></CardHeader>
            <CardContent className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
              <div><div className="text-muted-foreground text-xs">Walls</div><div className="font-medium">{sub.wall_count}</div></div>
              <div><div className="text-muted-foreground text-xs">Total length</div><div className="font-medium">{Number(sub.total_length).toFixed(1)} m</div></div>
              <div><div className="text-muted-foreground text-xs">Max height</div><div className="font-medium">{Number(sub.max_height).toFixed(2)} m</div></div>
              <div><div className="text-muted-foreground text-xs">Wizard step</div><div className="font-medium">{sub.current_step + 1} / 4</div></div>
              <div className="col-span-2"><div className="text-muted-foreground text-xs">Builder</div><div className="font-medium">{sub.is_builder ? `Yes — ${sub.company_name ?? ''}` : 'No'}</div></div>
              <div className="col-span-2"><div className="text-muted-foreground text-xs">Created</div><div className="font-medium">{new Date(sub.created_at).toLocaleString()}</div></div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="text-base">Walls ({walls.length})</CardTitle></CardHeader>
            <CardContent className="space-y-2">
              {walls.length === 0 && <p className="text-sm text-muted-foreground">No walls drawn yet.</p>}
              {walls.map((w, i) => (
                <div key={w.id} className="border rounded-md p-3 text-sm">
                  <div className="flex justify-between">
                    <div className="font-medium">{w.name || `Wall ${i + 1}`}</div>
                    <Badge variant="outline">{WALL_TYPE_LABELS[w.wallType] ?? w.wallType}</Badge>
                  </div>
                  <div className="text-muted-foreground text-xs mt-1">
                    Length {w.length.toFixed(1)} m · Height {w.minHeight.toFixed(2)}–{w.maxHeight.toFixed(2)} m
                    {w.hasFenceAbove && ' · Fence above'}{w.hasSurcharge && ' · Surcharge'}{w.hasDrainageRequired && ' · Drainage'}
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          {ctx && (
            <Card>
              <CardHeader><CardTitle className="text-base">Site context</CardTitle></CardHeader>
              <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                {Object.entries(ctx).map(([k, v]) => v ? (
                  <div key={k}><div className="text-muted-foreground text-xs capitalize">{k.replace(/([A-Z])/g, ' $1')}</div><div>{String(v)}</div></div>
                ) : null)}
              </CardContent>
            </Card>
          )}
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader><CardTitle className="text-base">Notes</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <Textarea value={newNote} onChange={e => setNewNote(e.target.value)} placeholder="Add a note..." rows={3} />
              <Button size="sm" onClick={addNote} disabled={!newNote.trim()}>Add note</Button>
              <Separator />
              <div className="space-y-3 max-h-72 overflow-auto">
                {notes.length === 0 && <p className="text-xs text-muted-foreground">No notes yet.</p>}
                {notes.map(n => (
                  <div key={n.id} className="text-sm border-l-2 border-primary/40 pl-3">
                    <div className="text-xs text-muted-foreground">{new Date(n.created_at).toLocaleString()}</div>
                    <div className="whitespace-pre-wrap">{n.body}</div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="text-base">Activity</CardTitle></CardHeader>
            <CardContent className="space-y-2 max-h-72 overflow-auto">
              {activity.map(ev => (
                <div key={ev.id} className="text-xs">
                  <span className="text-muted-foreground">{new Date(ev.created_at).toLocaleString()} · </span>
                  <span className="font-medium">{ev.event_type}</span>
                  {ev.details && Object.keys(ev.details).length > 0 && (
                    <span className="text-muted-foreground"> · {JSON.stringify(ev.details)}</span>
                  )}
                </div>
              ))}
              {activity.length === 0 && <p className="text-xs text-muted-foreground">No activity.</p>}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default SubmissionDetail;
