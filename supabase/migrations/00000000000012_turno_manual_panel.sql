-- ============================================================
-- Turnitos — Turno manual y cancelación desde el panel
-- ============================================================
-- Pre-flight (solo lectura), para confirmar el nombre del CHECK de tipo:
--   select conname from pg_constraint
--   where conrelid = 'public.notificacion'::regclass and contype = 'c';
--   -- esperado: notificacion_tipo_check

-- ---------- 1. Email del cliente opcional + origen del turno ----------
-- Los turnos cargados por el negocio (pedidos por WhatsApp) pueden no tener
-- email. Ojo: en crear_turno (público) `null !~ regex` evalúa a null, no a
-- true, así que su validación de formato NO rechaza un email null. Hasta
-- ahora lo frenaba el NOT NULL de la columna; ese rol lo pasa a cumplir el
-- CHECK turno_email_obligatorio_online: todo turno que no sea del panel
-- (crear_turno no pasa origen -> default 'online') sigue exigiendo email.
alter table public.turno alter column cliente_email drop not null;

alter table public.turno
  add column origen text not null default 'online' check (origen in ('online', 'panel'));

alter table public.turno
  add constraint turno_email_obligatorio_online
  check (origen = 'panel' or cliente_email is not null);

-- ---------- 2. Nuevo tipo de notificación ----------
alter table public.notificacion drop constraint notificacion_tipo_check;
alter table public.notificacion add constraint notificacion_tipo_check check (tipo in (
  'confirmacion_cliente',
  'recordatorio_cliente',
  'recuperacion_cliente',
  'turno_nuevo_negocio',
  'cancelacion_negocio',
  'reprogramacion_negocio',
  'cancelacion_cliente'
));

-- ---------- 3. encolar_notificacion: no-op si no hay destinatario ----------
-- Sin esto, generar_recordatorios_24h (que recorre todos los turnos
-- confirmados de mañana) intentaría insertar destinatario_email = null en un
-- turno manual sin email, violaría el NOT NULL y abortaría la función entera:
-- se cortarían los recordatorios de TODOS los negocios. Resolverlo acá cubre
-- a cualquier caller presente o futuro.
create or replace function public.encolar_notificacion(
  p_turno_id uuid,
  p_tipo text,
  p_destinatario_email text,
  p_asunto text,
  p_cuerpo_html text
)
returns void
language sql
security definer
set search_path = public
as $$
  insert into public.notificacion (turno_id, tipo, destinatario_email, asunto, cuerpo_html)
  select p_turno_id, p_tipo, p_destinatario_email, p_asunto, p_cuerpo_html
  where p_destinatario_email is not null and length(trim(p_destinatario_email)) > 0;
$$;

-- ---------- 4. crear_turno_panel ----------
-- El negocio NO se pasa por parámetro: se deriva de la sesión con
-- current_negocio_id(), así un admin no puede crear turnos en otro tenant.
-- No incluye al super-admin: el alcance de la Etapa 8 es solo el ciclo de
-- vida de los negocios, no su operación. Sin rate limit: es el dueño
-- autenticado, y por RLS ya puede insertar directo en su tenant.
-- Validación de disponibilidad: copia de crear_turno (mismo criterio que
-- reprogramar_turno en la migración 6). No se refactoriza crear_turno a un
-- helper compartido para no tocar ni re-testear el flujo público.
create or replace function public.crear_turno_panel(
  p_servicio_id uuid,
  p_fecha date,
  p_hora_inicio time,
  p_cliente_nombre text,
  p_cliente_telefono text,
  p_cliente_email text default null,
  p_nota text default null,
  p_estilista_id uuid default null
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
      cliente_nombre, cliente_email, cliente_telefono, nota, monto, origen
    ) values (
      v_negocio_id, v_estilista_id, p_servicio_id, p_fecha, p_hora_inicio, v_hora_fin,
      trim(p_cliente_nombre), v_email, p_cliente_telefono, nullif(trim(coalesce(p_nota, '')), ''), v_precio, 'panel'
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

revoke execute on function public.crear_turno_panel(uuid, date, time, text, text, text, text, uuid) from public, anon;
grant execute on function public.crear_turno_panel(uuid, date, time, text, text, text, text, uuid) to authenticated;

-- ---------- 5. cancelar_turno_panel ----------
-- FOR UPDATE: si el cliente cancela/reprograma por token en el mismo
-- instante, una de las dos transacciones espera y después ve el estado real,
-- en vez de que ambas pasen el chequeo `estado = 'confirmado'`.
create or replace function public.cancelar_turno_panel(p_turno_id uuid)
returns public.turno
language plpgsql
security definer
set search_path = public
as $$
declare
  v_turno public.turno;
  v_negocio_nombre text;
  v_servicio_nombre text;
begin
  select * into v_turno from turno where turno.id = p_turno_id for update;

  if v_turno.id is null or v_turno.negocio_id is distinct from current_negocio_id() then
    -- Mismo mensaje en ambos casos: no revela si el id existe en otro tenant.
    raise exception 'Turno no encontrado';
  end if;

  if v_turno.estado <> 'confirmado' then
    raise exception 'Solo se puede cancelar un turno confirmado';
  end if;

  update turno set estado = 'cancelado' where turno.id = v_turno.id returning * into v_turno;

  -- Aviso al cliente solo si todavía no pasó: cancelar un turno viejo es
  -- limpieza de agenda, no algo que haya que notificar.
  if v_turno.fecha >= current_date then
    select negocio.nombre into v_negocio_nombre from negocio where negocio.id = v_turno.negocio_id;
    select servicio.nombre into v_servicio_nombre from servicio where servicio.id = v_turno.servicio_id;

    perform encolar_notificacion(
      v_turno.id,
      'cancelacion_cliente',
      v_turno.cliente_email,
      'Tu turno en ' || v_negocio_nombre || ' fue cancelado',
      '<p>Hola ' || escapar_html(v_turno.cliente_nombre) || ',</p>' ||
      '<p>' || escapar_html(v_negocio_nombre) || ' canceló tu turno de <strong>' || escapar_html(v_servicio_nombre) ||
      '</strong> del ' || v_turno.fecha || ' a las ' || to_char(v_turno.hora_inicio, 'HH24:MI') || '.</p>' ||
      '<p>Si querés, podés comunicarte con el negocio para reservar otro horario.</p>'
    );
  end if;

  return v_turno;
end;
$$;

revoke execute on function public.cancelar_turno_panel(uuid) from public, anon;
grant execute on function public.cancelar_turno_panel(uuid) to authenticated;

-- ---------- 6. marcar_turno_completado: solo el negocio ----------
-- Se quita el `or is_super_admin()` de la migración 6 para alinearla con
-- cancelar_turno_panel y con el alcance de la Etapa 8 (el super-admin no
-- opera turnos). Mismo mensaje que cancelar_turno_panel para no revelar ids
-- de otros tenants, y FOR UPDATE por el mismo motivo.
create or replace function public.marcar_turno_completado(p_turno_id uuid)
returns public.turno
language plpgsql
security definer
set search_path = public
as $$
declare
  v_turno public.turno;
begin
  select * into v_turno from turno where turno.id = p_turno_id for update;

  if v_turno.id is null or v_turno.negocio_id is distinct from current_negocio_id() then
    raise exception 'Turno no encontrado';
  end if;

  if v_turno.estado <> 'confirmado' then
    raise exception 'Solo se puede completar un turno confirmado';
  end if;

  update turno set estado = 'completado' where turno.id = v_turno.id returning * into v_turno;

  return v_turno;
end;
$$;

revoke execute on function public.marcar_turno_completado(uuid) from public, anon;
grant execute on function public.marcar_turno_completado(uuid) to authenticated;

-- ---------- 7. Cerrar EXECUTE de funciones internas ----------
-- Postgres (y los default privileges de Supabase) otorgan EXECUTE a PUBLIC,
-- anon y authenticated sobre toda función nueva, así que estas quedaban
-- expuestas como /rpc/*. encolar_notificacion en particular permitía a
-- cualquier anon mandar emails con HTML arbitrario desde nuestro dominio.
-- Solo las llaman otras funciones SECURITY DEFINER (que corren como su owner,
-- así que el revoke no las afecta) o pg_cron (corre como postgres).
revoke execute on function public.encolar_notificacion(uuid, text, text, text, text) from public, anon, authenticated;
revoke execute on function public.chequear_limite_tasa(text, int, interval) from public, anon, authenticated;
revoke execute on function public.ip_cliente() from public, anon, authenticated;
revoke execute on function public.despachar_notificaciones_pendientes() from public, anon, authenticated;
revoke execute on function public.confirmar_notificaciones_enviadas() from public, anon, authenticated;
revoke execute on function public.generar_recordatorios_24h() from public, anon, authenticated;
revoke execute on function public.limpiar_limite_tasa() from public, anon, authenticated;
