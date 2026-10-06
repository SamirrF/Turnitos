-- ============================================================
-- Turnitos — Método de pago del turno (efectivo / transferencia)
-- ============================================================
-- Es solo informativo: con qué va a pagar el cliente, para que el negocio lo
-- vea en el detalle del turno. No hay cobro online (eso es la Etapa 9).
--
-- Todo en una transacción: crear_turno y crear_turno_panel cambian de firma,
-- así que hay que dropear la versión anterior (si no, quedarían dos overloads
-- y PostgREST no sabría cuál elegir). Si algo fallara a mitad de camino sin
-- transacción, la reserva pública quedaría sin función.
--
-- Orden de despliegue: primero esta migración, después el frontend. El
-- parámetro nuevo tiene default null, así que el frontend viejo (que no lo
-- manda) sigue funcionando contra las funciones nuevas.

begin;

-- ---------- 1. Columna ----------
-- Nullable: los turnos anteriores a esta migración no tienen método cargado.
alter table public.turno
  add column metodo_pago text check (metodo_pago in ('efectivo', 'transferencia'));

-- ---------- 2. crear_turno (público) ----------
-- Mismo cuerpo que la versión de la migración 8, más p_metodo_pago: se
-- valida, se guarda y se suma al aviso de turno nuevo que recibe el negocio.
drop function public.crear_turno(uuid, uuid, date, time, text, text, text, text, uuid);

create function public.crear_turno(
  p_negocio_id uuid,
  p_servicio_id uuid,
  p_fecha date,
  p_hora_inicio time,
  p_cliente_nombre text,
  p_cliente_email text,
  p_cliente_telefono text,
  p_nota text default null,
  p_estilista_id uuid default null,
  p_metodo_pago text default null
)
returns public.turno
language plpgsql
security definer
set search_path = public
as $$
declare
  v_estado text;
  v_horario_atencion jsonb;
  v_negocio_nombre text;
  v_negocio_slug text;
  v_negocio_email text;
  v_servicio_nombre text;
  v_duracion int;
  v_precio numeric;
  v_dia text;
  v_dias text[] := array['domingo', 'lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado'];
  v_hora_fin time;
  v_estilista_id uuid;
  v_turno public.turno;
  v_base_url text;
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

  if p_metodo_pago is not null and p_metodo_pago not in ('efectivo', 'transferencia') then
    raise exception 'Método de pago inválido';
  end if;

  if p_fecha < current_date then
    raise exception 'No se pueden reservar turnos en fechas pasadas';
  end if;

  select estado, horario_atencion, nombre, slug, email
  into v_estado, v_horario_atencion, v_negocio_nombre, v_negocio_slug, v_negocio_email
  from negocio where id = p_negocio_id;

  if v_estado is null or v_estado <> 'activo' then
    raise exception 'Negocio no disponible';
  end if;

  if exists (select 1 from dia_no_laborable where negocio_id = p_negocio_id and fecha = p_fecha) then
    raise exception 'El negocio no atiende ese día';
  end if;

  select duracion_minutos, precio, nombre into v_duracion, v_precio, v_servicio_nombre
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

  perform chequear_limite_tasa('turno:email:' || lower(p_cliente_email), 5, interval '1 hour');
  perform chequear_limite_tasa('turno:ip:' || ip_cliente(), 10, interval '1 hour');

  begin
    insert into public.turno (
      negocio_id, estilista_id, servicio_id, fecha, hora_inicio, hora_fin,
      cliente_nombre, cliente_email, cliente_telefono, nota, monto, metodo_pago
    ) values (
      p_negocio_id, v_estilista_id, p_servicio_id, p_fecha, p_hora_inicio, v_hora_fin,
      p_cliente_nombre, p_cliente_email, p_cliente_telefono, p_nota, v_precio, p_metodo_pago
    )
    returning * into v_turno;
  exception
    when exclusion_violation then
      raise exception 'Ese horario ya no está disponible';
  end;

  select value into v_base_url from app_config where key = 'app_base_url';

  perform encolar_notificacion(
    v_turno.id,
    'confirmacion_cliente',
    p_cliente_email,
    'Confirmación de tu turno en ' || v_negocio_nombre,
    '<p>Hola ' || escapar_html(p_cliente_nombre) || ',</p>' ||
    '<p>Tu turno de <strong>' || escapar_html(v_servicio_nombre) || '</strong> en ' || escapar_html(v_negocio_nombre) ||
    ' quedó confirmado para el ' || p_fecha || ' a las ' || to_char(p_hora_inicio, 'HH24:MI') ||
    ' ($' || v_precio || ').</p>' ||
    '<p><a href="' || v_base_url || '/' || v_negocio_slug || '/mi-turno?token=' || v_turno.token_gestion || '">Ver o gestionar mi turno</a></p>'
  );

  -- p_metodo_pago ya está validado contra la lista cerrada, no hace falta
  -- escapar_html.
  perform encolar_notificacion(
    v_turno.id,
    'turno_nuevo_negocio',
    v_negocio_email,
    'Nuevo turno reservado — ' || v_negocio_nombre,
    '<p>Nuevo turno de <strong>' || escapar_html(p_cliente_nombre) || '</strong> (' || escapar_html(p_cliente_email) || ').</p>' ||
    '<p>Servicio: ' || escapar_html(v_servicio_nombre) || '<br>' ||
    'Fecha: ' || p_fecha || ' a las ' || to_char(p_hora_inicio, 'HH24:MI') || '<br>' ||
    'Monto: $' || v_precio ||
    (case when p_metodo_pago is not null
      then '<br>Método de pago: ' || initcap(p_metodo_pago)
      else ''
    end) || '</p>' ||
    (case when p_nota is not null and length(trim(p_nota)) > 0
      then '<p>Nota: ' || escapar_html(p_nota) || '</p>'
      else ''
    end)
  );

  return v_turno;
end;
$$;

grant execute on function public.crear_turno(uuid, uuid, date, time, text, text, text, text, uuid, text) to anon, authenticated;

-- ---------- 3. crear_turno_panel ----------
-- Mismo cuerpo que la versión de la migración 12, más p_metodo_pago.
drop function public.crear_turno_panel(uuid, date, time, text, text, text, text, uuid);

create function public.crear_turno_panel(
  p_servicio_id uuid,
  p_fecha date,
  p_hora_inicio time,
  p_cliente_nombre text,
  p_cliente_telefono text,
  p_cliente_email text default null,
  p_nota text default null,
  p_estilista_id uuid default null,
  p_metodo_pago text default null
)
returns public.turno
language plpgsql
security definer
set search_path = public
as $$
declare
  v_negocio_id uuid := current_negocio_id();
  v_email text := nullif(trim(coalesce(p_cliente_email, '')), '');
  v_estado text;
  v_horario_atencion jsonb;
  v_negocio_nombre text;
  v_negocio_slug text;
  v_servicio_nombre text;
  v_duracion int;
  v_precio numeric;
  v_dia text;
  v_dias text[] := array['domingo', 'lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado'];
  v_hora_fin time;
  v_estilista_id uuid;
  v_turno public.turno;
  v_base_url text;
begin
  if v_negocio_id is null then
    raise exception 'No autorizado';
  end if;

  if p_cliente_nombre is null or length(trim(p_cliente_nombre)) = 0 then
    raise exception 'El nombre es obligatorio';
  end if;

  if p_cliente_telefono is null or p_cliente_telefono !~ '^[0-9+\-\s()]{6,}$' then
    raise exception 'Teléfono inválido';
  end if;

  if v_email is not null and v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then
    raise exception 'Email inválido';
  end if;

  if p_metodo_pago is not null and p_metodo_pago not in ('efectivo', 'transferencia') then
    raise exception 'Método de pago inválido';
  end if;

  if p_fecha is null or p_hora_inicio is null or p_fecha < current_date then
    raise exception 'No se pueden reservar turnos en fechas pasadas';
  end if;

  select negocio.estado, negocio.horario_atencion, negocio.nombre, negocio.slug
  into v_estado, v_horario_atencion, v_negocio_nombre, v_negocio_slug
  from negocio where negocio.id = v_negocio_id;

  if v_estado is null or v_estado <> 'activo' then
    raise exception 'Negocio no disponible';
  end if;

  if exists (
    select 1 from dia_no_laborable
    where dia_no_laborable.negocio_id = v_negocio_id and dia_no_laborable.fecha = p_fecha
  ) then
    raise exception 'El negocio no atiende ese día';
  end if;

  select servicio.duracion_minutos, servicio.precio, servicio.nombre
  into v_duracion, v_precio, v_servicio_nombre
  from servicio
  where servicio.id = p_servicio_id and servicio.negocio_id = v_negocio_id and servicio.activo = true;

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

  select e.id into v_estilista_id
  from estilista e
  where e.negocio_id = v_negocio_id
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
      cliente_nombre, cliente_email, cliente_telefono, nota, monto, origen, metodo_pago
    ) values (
      v_negocio_id, v_estilista_id, p_servicio_id, p_fecha, p_hora_inicio, v_hora_fin,
      trim(p_cliente_nombre), v_email, p_cliente_telefono, nullif(trim(coalesce(p_nota, '')), ''), v_precio, 'panel',
      p_metodo_pago
    )
    returning * into v_turno;
  exception
    when exclusion_violation then
      raise exception 'Ese horario ya no está disponible';
  end;

  select value into v_base_url from app_config where key = 'app_base_url';

  -- encolar_notificacion ya es no-op si v_email es null.
  perform encolar_notificacion(
    v_turno.id,
    'confirmacion_cliente',
    v_email,
    'Confirmación de tu turno en ' || v_negocio_nombre,
    '<p>Hola ' || escapar_html(v_turno.cliente_nombre) || ',</p>' ||
    '<p>Tu turno de <strong>' || escapar_html(v_servicio_nombre) || '</strong> en ' || escapar_html(v_negocio_nombre) ||
    ' quedó confirmado para el ' || p_fecha || ' a las ' || to_char(p_hora_inicio, 'HH24:MI') ||
    ' ($' || v_precio || ').</p>' ||
    '<p><a href="' || v_base_url || '/' || v_negocio_slug || '/mi-turno?token=' || v_turno.token_gestion || '">Ver o gestionar mi turno</a></p>'
  );

  return v_turno;
end;
$$;

-- Función nueva = privilegios por defecto de nuevo (EXECUTE a PUBLIC/anon):
-- hay que volver a cerrarla, igual que en la migración 12.
revoke execute on function public.crear_turno_panel(uuid, date, time, text, text, text, text, uuid, text) from public, anon;
grant execute on function public.crear_turno_panel(uuid, date, time, text, text, text, text, uuid, text) to authenticated;

commit;
