-- ============================================================
-- Turnitos — Etapa 6: ver, cancelar y reprogramar turno vía token
-- + marcar turno completado desde el panel
-- ============================================================

-- obtener_turno_por_token: language sql (no plpgsql) a propósito — un solo
-- SELECT, sin riesgo de la ambigüedad de columnas de RETURNS TABLE que
-- afecta a funciones plpgsql (ver horarios_disponibles, Etapa 4).
create or replace function public.obtener_turno_por_token(p_token uuid)
returns table (
  id uuid,
  fecha date,
  hora_inicio time,
  hora_fin time,
  estado text,
  monto numeric,
  cliente_nombre text,
  cliente_email text,
  cliente_telefono text,
  nota text,
  servicio_id uuid,
  servicio_nombre text,
  servicio_duracion_minutos int,
  estilista_id uuid,
  estilista_nombre text,
  negocio_id uuid,
  negocio_nombre text,
  negocio_slug text
)
language sql
security definer
set search_path = public
stable
as $$
  select
    t.id, t.fecha, t.hora_inicio, t.hora_fin, t.estado, t.monto,
    t.cliente_nombre, t.cliente_email, t.cliente_telefono, t.nota,
    s.id, s.nombre, s.duracion_minutos,
    e.id, e.nombre,
    n.id, n.nombre, n.slug
  from turno t
  join servicio s on s.id = t.servicio_id
  left join estilista e on e.id = t.estilista_id
  join negocio n on n.id = t.negocio_id
  where t.token_gestion = p_token;
$$;

grant execute on function public.obtener_turno_por_token(uuid) to anon, authenticated;

-- cancelar_turno: solo permite cancelar turnos en estado 'confirmado'.
create or replace function public.cancelar_turno(p_token uuid)
returns public.turno
language plpgsql
security definer
set search_path = public
as $$
declare
  v_turno public.turno;
begin
  select * into v_turno from turno where token_gestion = p_token;

  if v_turno.id is null then
    raise exception 'Turno no encontrado';
  end if;

  if v_turno.estado <> 'confirmado' then
    raise exception 'Este turno no se puede cancelar';
  end if;

  update turno set estado = 'cancelado' where id = v_turno.id returning * into v_turno;

  return v_turno;
end;
$$;

grant execute on function public.cancelar_turno(uuid) to anon, authenticated;

-- reprogramar_turno: mismas validaciones que crear_turno (Etapa 5), pero
-- sobre un turno existente, con servicio_id/estilista_id fijos.
create or replace function public.reprogramar_turno(p_token uuid, p_fecha date, p_hora_inicio time)
returns public.turno
language plpgsql
security definer
set search_path = public
as $$
declare
  v_turno public.turno;
  v_negocio_estado text;
  v_horario_atencion jsonb;
  v_horario_disponible jsonb;
  v_duracion int;
  v_dia text;
  v_dias text[] := array['domingo', 'lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado'];
  v_hora_fin time;
begin
  select * into v_turno from turno where token_gestion = p_token;

  if v_turno.id is null then
    raise exception 'Turno no encontrado';
  end if;

  if v_turno.estado <> 'confirmado' then
    raise exception 'Este turno no se puede reprogramar';
  end if;

  if p_fecha < current_date then
    raise exception 'No se pueden reservar turnos en fechas pasadas';
  end if;

  select negocio.estado, negocio.horario_atencion into v_negocio_estado, v_horario_atencion
  from negocio where negocio.id = v_turno.negocio_id;

  if v_negocio_estado is null or v_negocio_estado <> 'activo' then
    raise exception 'Negocio no disponible';
  end if;

  if exists (
    select 1 from dia_no_laborable
    where dia_no_laborable.negocio_id = v_turno.negocio_id and dia_no_laborable.fecha = p_fecha
  ) then
    raise exception 'El negocio no atiende ese día';
  end if;

  select servicio.duracion_minutos into v_duracion
  from servicio where servicio.id = v_turno.servicio_id;

  v_hora_fin := p_hora_inicio + (v_duracion || ' minutes')::interval;
  v_dia := v_dias[extract(dow from p_fecha)::int + 1];

  if not exists (
    select 1 from jsonb_array_elements(coalesce(v_horario_atencion -> v_dia, '[]'::jsonb)) f
    where p_hora_inicio >= (f ->> 'inicio')::time
      and v_hora_fin <= (f ->> 'fin')::time
  ) then
    raise exception 'Fuera del horario de atención del negocio';
  end if;

  if v_turno.estilista_id is not null then
    select estilista.horario_disponible into v_horario_disponible
    from estilista where estilista.id = v_turno.estilista_id;

    if not exists (
      select 1 from jsonb_array_elements(coalesce(v_horario_disponible -> v_dia, '[]'::jsonb)) f
      where p_hora_inicio >= (f ->> 'inicio')::time
        and v_hora_fin <= (f ->> 'fin')::time
    ) then
      raise exception 'El estilista no atiende ese horario';
    end if;

    if exists (
      select 1 from turno t
      where t.estilista_id = v_turno.estilista_id
        and t.id <> v_turno.id
        and t.fecha = p_fecha
        and t.estado <> 'cancelado'
        and p_hora_inicio < t.hora_fin
        and t.hora_inicio < v_hora_fin
    ) then
      raise exception 'Ese horario ya no está disponible';
    end if;
  end if;

  begin
    update turno
    set fecha = p_fecha, hora_inicio = p_hora_inicio, hora_fin = v_hora_fin
    where id = v_turno.id
    returning * into v_turno;
  exception
    when exclusion_violation then
      raise exception 'Ese horario ya no está disponible';
  end;

  return v_turno;
end;
$$;

grant execute on function public.reprogramar_turno(uuid, date, time) to anon, authenticated;

-- marcar_turno_completado: para el dueño autenticado desde el panel, no
-- para el cliente vía token. Encapsula la única transición válida
-- (confirmado -> completado) en vez de confiar en que el frontend nunca
-- mande otro estado por error.
create or replace function public.marcar_turno_completado(p_turno_id uuid)
returns public.turno
language plpgsql
security definer
set search_path = public
as $$
declare
  v_turno public.turno;
begin
  select * into v_turno from turno where id = p_turno_id;

  if v_turno.id is null then
    raise exception 'Turno no encontrado';
  end if;

  if not (v_turno.negocio_id = current_negocio_id() or is_super_admin()) then
    raise exception 'No autorizado';
  end if;

  if v_turno.estado <> 'confirmado' then
    raise exception 'Solo se puede completar un turno confirmado';
  end if;

  update turno set estado = 'completado' where id = v_turno.id returning * into v_turno;

  return v_turno;
end;
$$;

grant execute on function public.marcar_turno_completado(uuid) to authenticated;
