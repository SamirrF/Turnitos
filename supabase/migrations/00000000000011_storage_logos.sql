-- Logos de negocio subidos desde el dispositivo (Supabase Storage).
--
-- Bucket público: la página /:slug es anónima y tiene que poder mostrar el
-- logo por URL pública sin firmar. Público solo habilita la lectura por URL
-- directa; listar el bucket sigue requiriendo una policy de SELECT, y no hay.
--
-- Cada negocio escribe únicamente dentro de su carpeta `<negocio_id>/...`.
-- El frontend usa un nombre de archivo nuevo en cada subida (sin upsert), así
-- que no hacen falta policies de UPDATE ni DELETE.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'logos',
  'logos',
  true,
  2097152, -- 2 MB
  array['image/png', 'image/jpeg', 'image/webp']
)
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- current_negocio_id() devuelve null para quien no es UsuarioNegocio
-- (anon, super_admin), y `x = null` es null → la policy rechaza.
create policy logos_insert_propio_negocio on storage.objects
  for insert
  to authenticated
  with check (
    bucket_id = 'logos'
    and (storage.foldername(name))[1] = public.current_negocio_id()::text
  );
