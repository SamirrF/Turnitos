-- ============================================================
-- Turnitos — Etapa 3: días no laborables puntuales
-- ============================================================

create table public.dia_no_laborable (
  id uuid primary key default gen_random_uuid(),
  negocio_id uuid not null references public.negocio (id) on delete cascade,
  fecha date not null,
  motivo text,
  created_at timestamptz not null default now(),
  unique (negocio_id, fecha)
);

create index dia_no_laborable_negocio_id_idx on public.dia_no_laborable (negocio_id);

alter table public.dia_no_laborable enable row level security;

-- A diferencia del resto del esquema (que usa baja lógica), acá sí se permite
-- DELETE: un día no laborable es un flag puntual sin valor histórico/de
-- reporte, a diferencia de turno donde cancelaciones/completados sí importan.
create policy dia_no_laborable_select on public.dia_no_laborable
  for select
  using (negocio_id = current_negocio_id() or is_super_admin());

create policy dia_no_laborable_insert on public.dia_no_laborable
  for insert
  with check (negocio_id = current_negocio_id() or is_super_admin());

create policy dia_no_laborable_delete on public.dia_no_laborable
  for delete
  using (negocio_id = current_negocio_id() or is_super_admin());

grant select, insert, delete on public.dia_no_laborable to authenticated;
