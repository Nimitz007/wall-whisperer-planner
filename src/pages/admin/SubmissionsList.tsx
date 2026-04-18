import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Search, Download, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import KpiDashboard from '@/components/admin/KpiDashboard';

type Row = {
  id: string;
  client_name: string | null;
  client_email: string | null;
  company_name: string | null;
  is_builder: boolean;
  address: string | null;
  status: string;
  wall_count: number;
  total_length: number;
  current_step: number;
  updated_at: string;
};

const STATUS_COLORS: Record<string, string> = {
  new: 'bg-blue-100 text-blue-800',
  contacted: 'bg-amber-100 text-amber-800',
  quoted: 'bg-purple-100 text-purple-800',
  engineering: 'bg-indigo-100 text-indigo-800',
  delivered: 'bg-teal-100 text-teal-800',
  won: 'bg-green-100 text-green-800',
  lost: 'bg-gray-200 text-gray-700',
};

const SubmissionsList = () => {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('submissions')
      .select('id,client_name,client_email,company_name,is_builder,address,status,wall_count,total_length,current_step,updated_at')
      .order('updated_at', { ascending: false });
    if (error) toast.error(error.message); else setRows((data ?? []) as Row[]);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const filtered = useMemo(() => {
    return rows.filter(r => {
      if (statusFilter !== 'all' && r.status !== statusFilter) return false;
      if (!q) return true;
      const hay = `${r.client_name ?? ''} ${r.client_email ?? ''} ${r.company_name ?? ''} ${r.address ?? ''}`.toLowerCase();
      return hay.includes(q.toLowerCase());
    });
  }, [rows, q, statusFilter]);

  const exportCsv = () => {
    const header = ['Name','Email','Company','Builder','Address','Status','Walls','Total length (m)','Step','Updated'];
    const lines = [header.join(',')];
    filtered.forEach(r => {
      const cells = [
        r.client_name ?? '', r.client_email ?? '', r.company_name ?? '', r.is_builder ? 'Yes' : 'No',
        r.address ?? '', r.status, String(r.wall_count), r.total_length.toFixed(2),
        String(r.current_step), new Date(r.updated_at).toISOString(),
      ].map(v => `"${String(v).replace(/"/g, '""')}"`);
      lines.push(cells.join(','));
    });
    const csv = '\uFEFF' + lines.join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `simple-engineers-leads-${new Date().toISOString().slice(0,10)}.csv`; a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold">Dashboard</h1>
          <p className="text-sm text-muted-foreground">Pipeline at a glance</p>
        </div>
        <Button variant="outline" onClick={exportCsv}><Download className="h-4 w-4 mr-2" /> Export CSV</Button>
      </div>

      <KpiDashboard />

      <div className="pt-2">
        <h2 className="text-lg font-semibold">Submissions</h2>
        <p className="text-sm text-muted-foreground">{filtered.length} of {rows.length} leads</p>
      </div>

      <div className="flex gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[240px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input className="pl-9" placeholder="Search name, email, company, address..." value={q} onChange={e => setQ(e.target.value)} />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[180px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            {Object.keys(STATUS_COLORS).map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      <div className="border rounded-md bg-card">
        {loading ? (
          <div className="p-12 grid place-items-center"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Contact</TableHead>
                <TableHead>Address</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Walls</TableHead>
                <TableHead className="text-right">Length (m)</TableHead>
                <TableHead>Step</TableHead>
                <TableHead>Updated</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map(r => (
                <TableRow key={r.id} className="cursor-pointer">
                  <TableCell>
                    <Link to={`/admin/submissions/${r.id}`} className="block">
                      <div className="font-medium">{r.is_builder && r.company_name ? r.company_name : (r.client_name || '—')}</div>
                      <div className="text-xs text-muted-foreground">{r.client_email || '—'}</div>
                    </Link>
                  </TableCell>
                  <TableCell className="max-w-xs truncate"><Link to={`/admin/submissions/${r.id}`}>{r.address || '—'}</Link></TableCell>
                  <TableCell><Badge variant="outline" className={STATUS_COLORS[r.status]}>{r.status}</Badge></TableCell>
                  <TableCell className="text-right">{r.wall_count}</TableCell>
                  <TableCell className="text-right">{Number(r.total_length).toFixed(1)}</TableCell>
                  <TableCell>{r.current_step + 1}/4</TableCell>
                  <TableCell className="text-xs text-muted-foreground">{new Date(r.updated_at).toLocaleString()}</TableCell>
                </TableRow>
              ))}
              {filtered.length === 0 && (
                <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-12">No submissions yet.</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        )}
      </div>
    </div>
  );
};

export default SubmissionsList;
