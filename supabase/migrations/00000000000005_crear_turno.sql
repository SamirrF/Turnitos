-- ============================================================
-- Turnitos — Etapa 5: creación real del turno + protección contra
-- condición de carrera
-- ============================================================

-- ---------- Protección contra doble reserva (a nivel de base de datos) ----------

create extension if not exists btree_gist;

alter table public.turno
  add constraint turno_no_solapado
  exclude using gist (
    estilista_id with =,
    tsrange(fecha + hora_inicio, fecha + hora_fin) with &&
  )
  where (estado <> 'cancelado' and estilista_id is not null);

-- ---------- crear_turno ----------

create or replace function public.crear_turno(
  p_negocio_id uuid,
  p_servicio_id uuid,
  p_fecha date,
  p_hora_inicio time,
  p_cliente_nombre text,
  p_cliente_email text,
  p_cliente_telefono text,
  p_nota text default null,
  p_estilista_id uuid default null
)
returns public.turno
language plpgsql
security definer
set search_path = public
as $$
declare
  v_estado text;
  v_horario_atencion jsonb;
  v_duracion int;
  v_precio numeric;
  v_dia text;
  v_dias text[] := array['domingo', 'lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado'];
  v_hora_fin time;
  v_estilista_id uuid;
  v_turno public.turno;
begin
  if p_cliente_nombre is null or length(trim(p_cliente_nombre)) = 0 then
    raise exception 'El nombre es obligatorio';
  end if;

  if p_cliente_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then
    raise exception 'Email inválido';
  end if;

  if p_cliente_telefono !~ '^[0-9+\-\s()]{6,}$' then
    raise exception 'Teléfono inválido';
  end if;

  if p_fecha < current_date then
    raise exception 'No se pueden reservar turnos en fechas pasadas';
  end if;

  select estado, horario_atencion into v_estado, v_horario_atencion
  from negocio where id = p_negocio_id;

  if v_estado is null or v_estado <> 'activo' then
    raise exception 'Negocio no disponible';
  end if;

  if exists (select 1 from dia_no_laborable where negocio_id = p_negocio_id and fecha = p_fecha) then
    raise exception 'El negocio no atiende ese día';
  end if;

  select duracion_minutos, precio into v_duracion, v_precio
  from servicio
  where id = p_servicio_id and negocio_id = p_negocio_id and activo = true;

  if v_duracion is null then
    raise exception 'Servicio no disponible';
  end if;

  v_hora_fin := p_hora_inicio + (v_duracion || ' minutes')::interval;
  v_dia := v_dias[extract(dow from p_fecha)::int + 1];

  if not exists (
    select 1
    from jsonb_array_elements(coalesce(v_horario_atencion -> v_dia, '[]'::jsonb)) f
    where p_hora_inicio >= (f ->> 'inicio')::time
      and v_hora_fin <= (f ->> 'fin')::time
  ) then
    raise exception 'Fuera del horario de atención del negocio';
  end if;

  -- Resuelve "cualquiera disponible" (p_estilista_id null) al primer estilista
  -- activo que trabaje ese horario y no tenga otro turno superpuesto. Esto es
  -- el chequeo "de buena fe" que da un mensaje entendible en el caso normal;
  -- la garantía real contra condición de carrera es el EXCLUDE constraint de
  -- arriba, no este NOT EXISTS.
  select e.id into v_estilista_id
  from estilista e
  where e.negocio_id = p_negocio_id
    and e.activo = true
    and (p_estilista_id is null or e.id = p_estilista_id)
    and exists (
      select 1
      from jsonb_array_elements(coalesce(e.horario_disponible -> v_dia, '[]'::jsonb)) f
      where p_hora_inicio >= (f ->> 'inicio')::time
        and v_hora_fin <= (f ->> 'fin')::time
    )
    and not exists (
      select 1 from turno t
      where t.estilista_id = e.id
        and t.fecha = p_fecha
        and t.estado <> 'cancelado'
        and p_hora_inicio < t.hora_fin
        and t.hora_inicio < v_hora_fin
    )
  order by e.id
  limit 1;

  if v_estilista_id is null then
    raise exception 'Ese horario ya no está disponible';
  end if;

  begin
    insert into public.turno (
      negocio_id, estilista_id, servicio_id, fecha, hora_inicio, hora_fin,
      cliente_nombre, cliente_email, cliente_telefono, nota, monto
    ) values (
      p_negocio_id, v_estilista_id, p_servicio_id, p_fecha, p_hora_inicio, v_hora_fin,
      p_cliente_nombre, p_cliente_email, p_cliente_telefono, p_nota, v_precio
    )
    returning * into v_turno;
  exception
    -- Esto es lo que realmente atrapa la condición de carrera: si dos
    -- requests pasaron el NOT EXISTS de arriba al mismo tiempo, el segundo
    -- INSERT choca acá contra turno_no_solapado, no antes.
    when exclusion_violation then
      raise exception 'Ese horario ya no está disponible';
  end;

  return v_turno;
end;
$$;

grant execute on function public.crear_turno(uuid, uuid, date, time, text, text, text, text, uuid) to anon, authenticated;
