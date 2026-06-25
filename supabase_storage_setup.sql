-- Create the rc_images bucket
insert into storage.buckets (id, name, public)
values ('rc_images', 'rc_images', true)
on conflict (id) do nothing;

-- Set up RLS for the rc_images bucket
-- Allow public access to read the files
create policy "Public Access"
  on storage.objects for select
  using ( bucket_id = 'rc_images' );

-- Allow authenticated users to upload files
create policy "Authenticated users can upload"
  on storage.objects for insert
  with check ( bucket_id = 'rc_images' and auth.role() = 'authenticated' );

-- Allow users to update their own uploads
create policy "Users can update own uploads"
  on storage.objects for update
  using ( bucket_id = 'rc_images' and auth.uid() = owner )
  with check ( bucket_id = 'rc_images' and auth.uid() = owner );

-- Allow users to delete their own uploads
create policy "Users can delete own uploads"
  on storage.objects for delete
  using ( bucket_id = 'rc_images' and auth.uid() = owner );
