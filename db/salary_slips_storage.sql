-- Phase Finance 1: REVIEW and apply once to General_apps before uploading salary slips.
-- This is a proposed setup script, NOT applied automatically by the Belay app.
-- Protect existing buckets: do not convert a pre-existing public bucket in place.
do $$
begin
  if exists (select 1 from storage.buckets where id='belay_salary_slips') then
    raise exception 'belay_salary_slips already exists; audit its configuration and policies before proceeding';
  end if;
end $$;

insert into storage.buckets (id,name,public,file_size_limit,allowed_mime_types)
values ('belay_salary_slips','belay_salary_slips',false,10485760,
        array['application/pdf','image/png','image/jpeg','image/webp','image/heic'])
on conflict (id) do nothing;

-- Only the authenticated user's own UUID prefix is allowed, for every action.
-- The browser writes <auth.uid()>/<random-uuid>.<extension> and never uses public URLs.
create policy belay_salary_slips_select on storage.objects
  for select to authenticated
  using (bucket_id='belay_salary_slips' and (storage.foldername(name))[1]=(select auth.uid())::text);

create policy belay_salary_slips_insert on storage.objects
  for insert to authenticated
  with check (bucket_id='belay_salary_slips' and (storage.foldername(name))[1]=(select auth.uid())::text);

create policy belay_salary_slips_delete on storage.objects
  for delete to authenticated
  using (bucket_id='belay_salary_slips' and (storage.foldername(name))[1]=(select auth.uid())::text);

-- No UPDATE policy: uploads are immutable. Replacement requires explicit removal.
-- Verify: bucket is private, policies target storage.objects, anon cannot read,
-- and a second user cannot download, overwrite or delete the first user's file.
