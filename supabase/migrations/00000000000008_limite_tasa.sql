-- ============================================================
-- Turnitos — Rate limiting básico en crear_turno y solicitar_recuperacion_turno
-- ============================================================

create table public.limite_tasa (
  clave text not null,
  creado_at timestamptz not null default now()
);

create index limite_tasa_clave_creado_idx on public.limite_tasa (clave, creado_at);

alter table public.limite_tasa enable row level security;
-- Mismo criterio que notificacion/app_config: sin policies ni GRANTs a
-- anon/authenticated. Solo la tocan las funciones SECURITY DEFINER de abajo.

-- ---------- Helpers ----------

create or replace function public.chequear_limite_tasa(
  p_clave text,
  p_max int,
  p_ventana interval
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_cantidad int;
begin
  select count(*) into v_cantidad
  from limite_tasa
  where clave = p_clave and creado_at > now() - p_ventana;

  if v_cantidad >= p_max then
    raise exception 'Demasiados intentos, probá de nuevo en un rato';
  end if;

  insert into limite_tasa (clave) values (p_clave);
end;
$$;

create or replace function public.ip_cliente()
returns text
language plpgsql
as $$
declare
  v_headers json;
begin
  begin
    v_headers := current_setting('request.headers', true)::json;
  exception when others then
    return 'sin-ip';
  end;

  return coalesce(nullif(split_part(v_headers ->> 'x-forwarded-for', ',', 1), ''), 'sin-ip');
end;
$$;

-- ---------- crear_turno: + rate limit (5/email/hora, 10/ip/hora) ----------
-- Mismo cuerpo que la versión de la migración 7, agregando el chequeo recién
-- después de confirmar que hay estilista/horario disponible (v_estilista_id
-- no es null) y justo antes del insert: así un cliente que choca con "Ese
-- horario ya no está disponible" (contención normal de la Etapa 5) no gasta
-- su cupo de intentos por algo que no fue su culpa. Las validaciones de
-- formato/fecha siguen corriendo primero, sin cambios ahí.

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
      cliente_nombre, cliente_email, cliente_telefono, nota, monto
    ) values (
      p_negocio_id, v_estilista_id, p_servicio_id, p_fecha, p_hora_inicio, v_hora_fin,
      p_cliente_nombre, p_cliente_email, p_cliente_telefono, p_nota, v_precio
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

  perform encolar_notificacion(
    v_turno.id,
    'turno_nuevo_negocio',
    v_negocio_email,
    'Nuevo turno reservado — ' || v_negocio_nombre,
    '<p>Nuevo turno de <strong>' || escapar_html(p_cliente_nombre) || '</strong> (' || escapar_html(p_cliente_email) || ').</p>' ||
    '<p>Servicio: ' || escapar_html(v_servicio_nombre) || '<br>' ||
    'Fecha: ' || p_fecha || ' a las ' || to_char(p_hora_inicio, 'HH24:MI') || '<br>' ||
    'Monto: $' || v_precio || '</p>' ||
    (case when p_nota is not null and length(trim(p_nota)) > 0
      then '<p>Nota: ' || escapar_html(p_nota) || '</p>'
      else ''
    end)
  );

  return v_turno;
end;
$$;

-- ---------- solicitar_recuperacion_turno: + rate limit (3/email/hora) ----------

create or replace function public.solicitar_recuperacion_turno(p_email text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_base_url text;
  v_turno record;
begin
  perform chequear_limite_tasa('recuperacion:email:' || lower(p_email), 3, interval '1 hour');

  select value into v_base_url from app_config where key = 'app_base_url';

  for v_turno in
    select t.id, t.token_gestion, t.cliente_nombre, t.fecha, t.hora_inicio,
           s.nombre as servicio_nombre, n.nombre as negocio_nombre, n.slug as negocio_slug
    from turno t
    join servicio s on s.id = t.servicio_id
    join negocio n on n.id = t.negocio_id
    where t.cliente_email = p_email
      and t.estado = 'confirmado'
      and t.fecha >= current_date
  loop
    perform encolar_notificacion(
      v_turno.id,
      'recuperacion_cliente',
      p_email,
      'Tu turno en ' || v_turno.negocio_nombre,
      '<p>Hola ' || escapar_html(v_turno.cliente_nombre) || ',</p>' ||
      '<p>Encontramos tu turno de <strong>' || escapar_html(v_turno.servicio_nombre) || '</strong> el ' ||
      v_turno.fecha || ' a las ' || to_char(v_turno.hora_inicio, 'HH24:MI') || '.</p>' ||
      '<p><a href="' || v_base_url || '/' || v_turno.negocio_slug || '/mi-turno?token=' || v_turno.token_gestion || '">Gestionar mi turno</a></p>'
    );
  end loop;
  -- sin "return" distinto según encontró o no: siempre termina igual, así
  -- no se puede usar para averiguar si un email tiene turnos.
end;
$$;

-- ---------- Limpieza periódica ----------

create or replace function public.limpiar_limite_tasa()
returns void
language sql
security definer
set search_path = public
as $$
  delete from public.limite_tasa where creado_at < now() - interval '24 hours';
$$;

select cron.schedule('limpiar-limite-tasa', '0 * * * *', $$select public.limpiar_limite_tasa();$$);
