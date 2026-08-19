-- ============================================================
-- Turnitos — Etapa 4: acceso público de lectura + disponibilidad
-- ============================================================

-- ---------- Lectura pública ----------

-- negocio NO recibe policy ni GRANT SELECT públicos: la fila completa incluye
-- `email`, que en la práctica es el mismo email de login del dueño (Registro.jsx
-- usa un único campo para auth.signUp y para p_email de registrar_negocio).
-- RLS/GRANT filtran filas, no columnas — no hay forma de exponer la fila
-- "menos email" sin también restringírsela al propio dueño. En vez de eso,
-- negocio_esta_activo() habilita las policies de servicio/estilista sin dar
-- acceso directo a la tabla, y obtener_negocio_publico() más abajo proyecta
-- explícitamente solo las columnas seguras para la pantalla inicial.

create or replace function public.negocio_esta_activo(p_negocio_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from negocio where id = p_negocio_id and estado = 'activo'
  );
$$;

grant execute on function public.negocio_esta_activo(uuid) to anon, authenticated;

create policy servicio_select_publico on public.servicio
  for select to anon, authenticated
  using (activo = true and negocio_esta_activo(negocio_id));

create policy estilista_select_publico on public.estilista
  for select to anon, authenticated
  using (activo = true and negocio_esta_activo(negocio_id));

grant select on public.servicio to anon;
grant select on public.estilista to anon;

create or replace function public.obtener_negocio_publico(p_slug text)
returns table(
  id uuid,
  nombre text,
  slug text,
  logo_url text,
  descripcion text,
  redes_sociales jsonb,
  direccion text,
  telefono text,
  horario_atencion jsonb
)
language sql
security definer
set search_path = public
stable
as $$
  select id, nombre, slug, logo_url, descripcion, redes_sociales, direccion, telefono, horario_atencion
  from negocio
  where slug = p_slug and estado = 'activo';
$$;

grant execute on function public.obtener_negocio_publico(text) to anon, authenticated;

-- ---------- Slugs reservados ----------

alter table public.negocio
  add constraint negocio_slug_no_reservado
  check (slug not in ('registro', 'login', 'onboarding', 'panel', 'admin', 'super-admin', 'api'));

-- ---------- Disponibilidad ----------

create or replace function public.dias_disponibles(
  p_negocio_id uuid,
  p_desde date,
  p_hasta date,
  p_estilista_id uuid default null
)
returns setof date
language plpgsql
security definer
set search_path = public
stable
as $$
declare
  v_estado text;
  v_horario_atencion jsonb;
  v_dias text[] := array['domingo', 'lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado'];
begin
  select estado, horario_atencion into v_estado, v_horario_atencion
  from negocio where id = p_negocio_id;

  if v_estado is null or v_estado <> 'activo' then
    return;
  end if;

  return query
  select d::date
  from generate_series(p_desde::timestamp, p_hasta::timestamp, interval '1 day') as d
  where jsonb_array_length(coalesce(v_horario_atencion -> v_dias[extract(dow from d)::int + 1], '[]'::jsonb)) > 0
    and not exists (
      select 1 from dia_no_laborable dnl
      where dnl.negocio_id = p_negocio_id and dnl.fecha = d::date
    )
    and (
      p_estilista_id is null
      or exists (
        select 1 from estilista e
        where e.id = p_estilista_id
          and e.negocio_id = p_negocio_id
          and e.activo = true
          and jsonb_array_length(coalesce(e.horario_disponible -> v_dias[extract(dow from d)::int + 1], '[]'::jsonb)) > 0
      )
    );
end;
$$;

grant execute on function public.dias_disponibles(uuid, date, date, uuid) to anon, authenticated;

create or replace function public.horarios_disponibles(
  p_negocio_id uuid,
  p_servicio_id uuid,
  p_fecha date,
  p_estilista_id uuid default null
)
returns table(hora_inicio time, hora_fin time)
language plpgsql
security definer
set search_path = public
stable
as $$
declare
  v_estado text;
  v_horario_atencion jsonb;
  v_duracion int;
  v_dia text;
  v_dias text[] := array['domingo', 'lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado'];
begin
  select estado, horario_atencion into v_estado, v_horario_atencion
  from negocio where id = p_negocio_id;

  if v_estado is null or v_estado <> 'activo' then
    return;
  end if;

  if exists (select 1 from dia_no_laborable where negocio_id = p_negocio_id and fecha = p_fecha) then
    return;
  end if;

  select duracion_minutos into v_duracion
  from servicio
  where id = p_servicio_id and negocio_id = p_negocio_id and activo = true;

  if v_duracion is null then
    return;
  end if;

  v_dia := v_dias[extract(dow from p_fecha)::int + 1];

  return query
  with franjas_negocio as (
    select (f ->> 'inicio')::time as inicio, (f ->> 'fin')::time as fin
    from jsonb_array_elements(coalesce(v_horario_atencion -> v_dia, '[]'::jsonb)) f
  ),
  candidatos as (
    select e.id as estilista_id, e.horario_disponible
    from estilista e
    where e.negocio_id = p_negocio_id
      and e.activo = true
      and (p_estilista_id is null or e.id = p_estilista_id)
  ),
  franjas_estilista as (
    select c.estilista_id, (f ->> 'inicio')::time as inicio, (f ->> 'fin')::time as fin
    from candidatos c
    cross join lateral jsonb_array_elements(coalesce(c.horario_disponible -> v_dia, '[]'::jsonb)) f
  ),
  intersecciones as (
    select fe.estilista_id,
           greatest(fn.inicio, fe.inicio) as inicio,
           least(fn.fin, fe.fin) as fin
    from franjas_negocio fn
    join franjas_estilista fe on fe.inicio < fn.fin and fn.inicio < fe.fin
  ),
  slots_candidatos as (
    select i.estilista_id,
           gs::time as slot_inicio,
           (gs + (v_duracion || ' minutes')::interval)::time as slot_fin
    from intersecciones i
    cross join lateral generate_series(
      (p_fecha + i.inicio)::timestamp,
      (p_fecha + i.fin)::timestamp - (v_duracion || ' minutes')::interval,
      (v_duracion || ' minutes')::interval
    ) as gs
  ),
  turnos_dia as (
    select turno.estilista_id, turno.hora_inicio, turno.hora_fin
    from turno
    where turno.negocio_id = p_negocio_id
      and turno.fecha = p_fecha
      and turno.estado <> 'cancelado'
  )
  select distinct sc.slot_inicio, sc.slot_fin
  from slots_candidatos sc
  where not exists (
    select 1 from turnos_dia t
    where t.estilista_id = sc.estilista_id
      and sc.slot_inicio < t.hora_fin
      and t.hora_inicio < sc.slot_fin
  )
  order by sc.slot_inicio;
end;
$$;

grant execute on function public.horarios_disponibles(uuid, uuid, date, uuid) to anon, authenticated;
