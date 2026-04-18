import { supabase } from '@/integrations/supabase/client';

const BUCKET = 'submission-files';

export const getCurrentSubmissionId = (): string | null => {
  try { return localStorage.getItem('se_submission_id'); } catch { return null; }
};

export async function uploadSubmissionFile(
  filename: string,
  blob: Blob,
  contentType: string,
  submissionId?: string | null,
): Promise<void> {
  const sid = submissionId ?? getCurrentSubmissionId();
  if (!sid) return; // no submission yet, skip silently
  const path = `${sid}/${Date.now()}-${filename}`;
  const { error } = await supabase.storage.from(BUCKET).upload(path, blob, {
    contentType,
    upsert: false,
  });
  if (error) {
    console.warn('[submission-files] upload failed', error.message);
    return;
  }
  await supabase.from('submission_activity').insert({
    submission_id: sid,
    event_type: 'file_generated',
    details: { filename, path, contentType },
  });
}

export async function listSubmissionFiles(submissionId: string) {
  const { data, error } = await supabase.storage.from(BUCKET).list(submissionId, {
    limit: 100,
    sortBy: { column: 'created_at', order: 'desc' },
  });
  if (error) throw error;
  return (data ?? []).filter(f => f.name && f.name !== '.emptyFolderPlaceholder');
}

export async function getSubmissionFileUrl(submissionId: string, fileName: string): Promise<string | null> {
  const { data, error } = await supabase.storage
    .from(BUCKET)
    .createSignedUrl(`${submissionId}/${fileName}`, 60 * 10);
  if (error) return null;
  return data?.signedUrl ?? null;
}

export async function deleteSubmissionFile(submissionId: string, fileName: string) {
  const { error } = await supabase.storage.from(BUCKET).remove([`${submissionId}/${fileName}`]);
  if (error) throw error;
}
