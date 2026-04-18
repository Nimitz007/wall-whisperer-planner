import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { listSubmissionFiles, getSubmissionFileUrl, deleteSubmissionFile } from '@/lib/submissionFiles';
import { Download, Loader2, Trash2, FileText } from 'lucide-react';
import { toast } from 'sonner';

type FileRow = { name: string; created_at?: string; metadata?: { size?: number } | null };

const SubmissionFilesPanel = ({ submissionId, refreshKey }: { submissionId: string; refreshKey?: number }) => {
  const [files, setFiles] = useState<FileRow[]>([]);
  const [loading, setLoading] = useState(true);

  const reload = async () => {
    setLoading(true);
    try { setFiles((await listSubmissionFiles(submissionId)) as FileRow[]); }
    catch (e: any) { toast.error(e.message); }
    finally { setLoading(false); }
  };

  useEffect(() => { reload(); /* eslint-disable-next-line */ }, [submissionId, refreshKey]);

  const onDownload = async (name: string) => {
    const url = await getSubmissionFileUrl(submissionId, name);
    if (!url) return toast.error('Could not get download URL');
    window.open(url, '_blank', 'noopener');
  };

  const onDelete = async (name: string) => {
    if (!confirm(`Delete ${name}?`)) return;
    try { await deleteSubmissionFile(submissionId, name); toast.success('Deleted'); reload(); }
    catch (e: any) { toast.error(e.message); }
  };

  const fmtSize = (b?: number) => !b ? '' : b < 1024 ? `${b} B` : b < 1048576 ? `${(b/1024).toFixed(1)} KB` : `${(b/1048576).toFixed(1)} MB`;

  return (
    <Card>
      <CardHeader><CardTitle className="text-base">Generated files ({files.length})</CardTitle></CardHeader>
      <CardContent>
        {loading ? (
          <div className="py-6 grid place-items-center"><Loader2 className="h-4 w-4 animate-spin text-muted-foreground" /></div>
        ) : files.length === 0 ? (
          <p className="text-sm text-muted-foreground">No files archived yet. PDFs/CSVs generated from the planner will appear here automatically.</p>
        ) : (
          <ul className="space-y-2">
            {files.map(f => {
              const cleanName = f.name.replace(/^\d+-/, '');
              return (
                <li key={f.name} className="flex items-center justify-between gap-2 border rounded-md p-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
                    <div className="min-w-0">
                      <div className="text-sm font-medium truncate">{cleanName}</div>
                      <div className="text-xs text-muted-foreground">
                        {f.created_at && new Date(f.created_at).toLocaleString()} {fmtSize(f.metadata?.size) && `· ${fmtSize(f.metadata?.size)}`}
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-1 shrink-0">
                    <Button size="icon" variant="ghost" onClick={() => onDownload(f.name)}><Download className="h-4 w-4" /></Button>
                    <Button size="icon" variant="ghost" onClick={() => onDelete(f.name)}><Trash2 className="h-4 w-4" /></Button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  );
};

export default SubmissionFilesPanel;
