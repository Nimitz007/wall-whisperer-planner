
insert into storage.buckets (id, name, public)
values ('submission-files', 'submission-files', false)
on conflict (id) do nothing;

create policy "Admins read submission files"
on storage.objects for select
using (bucket_id = 'submission-files' and public.has_role(auth.uid(), 'admin'));

create policy "Admins upload submission files"
on storage.objects for insert
with check (bucket_id = 'submission-files' and public.has_role(auth.uid(), 'admin'));

create policy "Anyone can upload submission files"
on storage.objects for insert
to anon, authenticated
with check (bucket_id = 'submission-files');

create policy "Admins delete submission files"
on storage.objects for delete
using (bucket_id = 'submission-files' and public.has_role(auth.uid(), 'admin'));
