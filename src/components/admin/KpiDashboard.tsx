import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';
import { TrendingUp, Users, Target, Ruler, Loader2 } from 'lucide-react';

type Sub = {
  id: string;
  status: string;
  total_length: number | null;
  wall_count: number | null;
  created_at: string;
};

const startOfWeek = (d = new Date()) => {
  const x = new Date(d);
  const day = (x.getDay() + 6) % 7; // Monday=0
  x.setHours(0, 0, 0, 0);
  x.setDate(x.getDate() - day);
  return x;
};
const startOfMonth = (d = new Date()) => {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0); x.setDate(1);
  return x;
};

const KpiDashboard = () => {
  const [data, setData] = useState<Sub[] | null>(null);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from('submissions')
        .select('id,status,total_length,wall_count,created_at')
        .order('created_at', { ascending: false })
        .limit(1000);
      setData((data ?? []) as Sub[]);
    })();
  }, []);

  const stats = useMemo(() => {
    if (!data) return null;
    const wkStart = startOfWeek();
    const moStart = startOfMonth();
    const week = data.filter(s => new Date(s.created_at) >= wkStart);
    const month = data.filter(s => new Date(s.created_at) >= moStart);
    const won = data.filter(s => s.status === 'won').length;
    const closed = data.filter(s => s.status === 'won' || s.status === 'lost').length;
    const conv = closed > 0 ? Math.round((won / closed) * 100) : 0;
    const lengths = data.filter(s => (s.total_length ?? 0) > 0).map(s => Number(s.total_length));
    const avgLen = lengths.length ? lengths.reduce((a, b) => a + b, 0) / lengths.length : 0;

    // build last 30 days timeseries
    const series: { date: string; submissions: number }[] = [];
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const buckets = new Map<string, number>();
    for (let i = 29; i >= 0; i--) {
      const d = new Date(today); d.setDate(today.getDate() - i);
      const key = d.toISOString().slice(0, 10);
      buckets.set(key, 0);
    }
    data.forEach(s => {
      const key = new Date(s.created_at).toISOString().slice(0, 10);
      if (buckets.has(key)) buckets.set(key, (buckets.get(key) ?? 0) + 1);
    });
    buckets.forEach((v, k) => series.push({ date: k.slice(5), submissions: v }));

    return { week: week.length, month: month.length, conv, avgLen, total: data.length, series };
  }, [data]);

  if (!stats) {
    return <div className="h-32 grid place-items-center"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>;
  }

  const cards = [
    { label: 'Leads this week', value: stats.week, icon: Users, hint: `${stats.month} this month` },
    { label: 'Total leads', value: stats.total, icon: TrendingUp, hint: 'all time' },
    { label: 'Conversion rate', value: `${stats.conv}%`, icon: Target, hint: 'won / (won + lost)' },
    { label: 'Avg wall length', value: `${stats.avgLen.toFixed(1)} m`, icon: Ruler, hint: 'across all leads' },
  ];

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {cards.map(c => (
          <Card key={c.label}>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div className="text-xs text-muted-foreground">{c.label}</div>
                <c.icon className="h-4 w-4 text-muted-foreground" />
              </div>
              <div className="text-2xl font-semibold mt-1">{c.value}</div>
              <div className="text-xs text-muted-foreground mt-1">{c.hint}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">Submissions — last 30 days</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={stats.series} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="subFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.35} />
                    <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                <XAxis dataKey="date" fontSize={11} tickLine={false} axisLine={false} />
                <YAxis fontSize={11} tickLine={false} axisLine={false} allowDecimals={false} />
                <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} />
                <Area type="monotone" dataKey="submissions" stroke="hsl(var(--primary))" strokeWidth={2} fill="url(#subFill)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default KpiDashboard;
