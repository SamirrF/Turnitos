-- ============================================================
-- Turnitos — Etapa 0: esquema inicial + RLS multi-tenant
-- ============================================================

-- ---------- Tablas ----------

create table public.negocio (
  id uuid primary key default gen_random_uuid(),
  nombre text not null,
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  logo_url text,
  descripcion text,
  redes_sociales jsonb not null default '{}'::jsonb,
  direccion text,
  telefono text,
  email text not null,
  horario_atencion jsonb not null default '{}'::jsonb,
  estado text not null default 'activo' check (estado in ('activo', 'inactivo')),
  created_at timestamptz not null default now()
);

create index negocio_slug_idx on public.negocio (slug);

create table public.usuario_negocio (
  id uuid primary key references auth.users (id) on delete cascade,
  negocio_id uuid not null references public.negocio (id) on delete cascade,
  email text not null,
  created_at timestamptz not null default now()
);

create index usuario_negocio_negocio_id_idx on public.usuario_negocio (negocio_id);

create table public.estilista (
  id uuid primary key default gen_random_uuid(),
  negocio_id uuid not null references public.negocio (id) on delete cascade,
  nombre text not null,
  foto_url text,
  especialidad text,
  horario_disponible jsonb not null default '{}'::jsonb,
  activo boolean not null default true,
  created_at timestamptz not null default now()
);

create index estilista_negocio_id_idx on public.estilista (negocio_id);

create table public.servicio (
  id uuid primary key default gen_random_uuid(),
  negocio_id uuid not null references public.negocio (id) on delete cascade,
  nombre text not null,
  descripcion text,
  precio numeric(12,2) not null check (precio >= 0),
  duracion_minutos integer not null check (duracion_minutos > 0),
  activo boolean not null default true,
  created_at timestamptz not null default now()
);

create index servicio_negocio_id_idx on public.servicio (negocio_id);

create table public.turno (
  id uuid primary key default gen_random_uuid(),
  negocio_id uuid not null references public.negocio (id) on delete cascade,
  estilista_id uuid references public.estilista (id) on delete set null,
  servicio_id uuid not null references public.servicio (id),
  fecha date not null,
  hora_inicio time not null,
  hora_fin time not null,
  estado text not null default 'confirmado' check (estado in ('confirmado', 'cancelado', 'completado')),
  cliente_nombre text not null,
  cliente_email text not null,
  cliente_telefono text not null,
  nota text,
  monto numeric(12,2) not null check (monto >= 0),
  token_gestion uuid not null default gen_random_uuid() unique,
  created_at timestamptz not null default now(),
  constraint turno_hora_fin_valida check (hora_fin > hora_inicio)
);

create index turno_negocio_fecha_idx on public.turno (negocio_id, fecha);
create index turno_estilista_fecha_idx on public.turno (estilista_id, fecha);
create index turno_token_gestion_idx on public.turno (token_gestion);

create table public.super_admin (
  id uuid primary key references auth.users (id) on delete cascade,
  email text not null,
  created_at timestamptz not null default now()
);

-- ---------- Funciones helper (SECURITY DEFINER: bypasean RLS al leer,
-- por eso no hay recursión con las policies definidas más abajo) ----------

create or replace function public.is_super_admin()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.super_admin where id = auth.uid()
  );
$$;

create or replace function public.current_negocio_id()
returns uuid
language sql
security definer
set search_path = public
stable
as $$
  select negocio_id from public.usuario_negocio where id = auth.uid();
$$;

grant execute on function public.is_super_admin() to authenticated;
grant execute on function public.current_negocio_id() to authenticated;

-- ---------- RLS ----------

alter table public.negocio enable row level security;
alter table public.usuario_negocio enable row level security;
alter table public.estilista enable row level security;
alter table public.servicio enable row level security;
alter table public.turno enable row level security;
alter table public.super_admin enable row level security;

-- negocio: solo SELECT/UPDATE del propio negocio o super_admin. Sin INSERT
-- (el alta se hace vía Edge Function con service_role en la Etapa 1).
-- Nota: WITH CHECK no puede comparar contra el valor ANTERIOR de `estado`
-- (solo valida la fila nueva), así que la regla "solo super_admin cambia
-- estado" se aplica con un trigger BEFORE UPDATE (ver más abajo), no con
-- la policy.
create policy negocio_select on public.negocio
  for select
  using (current_negocio_id() = id or is_super_admin());

create policy negocio_update on public.negocio
  for update
  using (current_negocio_id() = id or is_super_admin())
  with check (current_negocio_id() = id or is_super_admin());

create or replace function public.negocio_bloquear_cambio_estado()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.estado <> old.estado and not public.is_super_admin() then
    raise exception 'Solo un super-admin puede modificar el estado del negocio';
  end if;
  return new;
end;
$$;

create trigger negocio_bloquear_cambio_estado_trg
  before update on public.negocio
  for each row
  execute function public.negocio_bloquear_cambio_estado();

-- usuario_negocio: cada admin ve/edita solo su propia fila. Sin INSERT
-- (alta exclusiva vía service_role en el registro de la Etapa 1, para no
-- permitir que un autenticado se auto-vincule al negocio_id de otro).
-- Mismo motivo que arriba: la inmutabilidad de `negocio_id` en UPDATE
-- (salvo super_admin) se aplica con un trigger, no con WITH CHECK, porque
-- WITH CHECK no tiene forma segura de comparar contra el valor anterior.
create policy usuario_negocio_select on public.usuario_negocio
  for select
  using (id = auth.uid() or is_super_admin());

create policy usuario_negocio_update on public.usuario_negocio
  for update
  using (id = auth.uid() or is_super_admin())
  with check (id = auth.uid() or is_super_admin());

create or replace function public.usuario_negocio_bloquear_cambio_negocio()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.negocio_id <> old.negocio_id and not public.is_super_admin() then
    raise exception 'No se puede modificar negocio_id de usuario_negocio';
  end if;
  return new;
end;
$$;

create trigger usuario_negocio_bloquear_cambio_negocio_trg
  before update on public.usuario_negocio
  for each row
  execute function public.usuario_negocio_bloquear_cambio_negocio();

-- estilista
create policy estilista_select on public.estilista
  for select
  using (negocio_id = current_negocio_id() or is_super_admin());

create policy estilista_insert on public.estilista
  for insert
  with check (negocio_id = current_negocio_id() or is_super_admin());

create policy estilista_update on public.estilista
  for update
  using (negocio_id = current_negocio_id() or is_super_admin())
  with check (negocio_id = current_negocio_id() or is_super_admin());

-- servicio
create policy servicio_select on public.servicio
  for select
  using (negocio_id = current_negocio_id() or is_super_admin());

create policy servicio_insert on public.servicio
  for insert
  with check (negocio_id = current_negocio_id() or is_super_admin());

create policy servicio_update on public.servicio
  for update
  using (negocio_id = current_negocio_id() or is_super_admin())
  with check (negocio_id = current_negocio_id() or is_super_admin());

-- turno
create policy turno_select on public.turno
  for select
  using (negocio_id = current_negocio_id() or is_super_admin());

create policy turno_insert on public.turno
  for insert
  with check (negocio_id = current_negocio_id() or is_super_admin());

create policy turno_update on public.turno
  for update
  using (negocio_id = current_negocio_id() or is_super_admin())
  with check (negocio_id = current_negocio_id() or is_super_admin());

-- super_admin: solo super-admins existentes ven/editan/insertan filas.
-- La primera fila se crea a mano desde el SQL Editor (rol postgres,
-- bypasea RLS) — ver paso de la verificación manual.
create policy super_admin_select on public.super_admin
  for select
  using (is_super_admin());

create policy super_admin_insert on public.super_admin
  for insert
  with check (is_super_admin());

create policy super_admin_update on public.super_admin
  for update
  using (is_super_admin())
  with check (is_super_admin());

-- ---------- GRANTs de tabla ----------
-- El proyecto tiene destildado "Automatically expose new tables", así que
-- el rol `authenticated` no tiene acceso a las tablas nuevas por defecto.
-- El GRANT y el RLS son capas separadas: el GRANT habilita la operación a
-- nivel tabla, el RLS filtra las filas dentro de eso. Sin GRANT, las
-- policies de arriba no alcanzan aunque estén bien escritas.
-- No hay GRANT insert en negocio ni usuario_negocio (no tienen policy de
-- INSERT para authenticated) ni GRANT delete en ninguna tabla (baja lógica).

grant usage on schema public to authenticated;
grant select, update on public.negocio to authenticated;
grant select, update on public.usuario_negocio to authenticated;
grant select, insert, update on public.estilista to authenticated;
grant select, insert, update on public.servicio to authenticated;
grant select, insert, update on public.turno to authenticated;
grant select, insert, update on public.super_admin to authenticated;
