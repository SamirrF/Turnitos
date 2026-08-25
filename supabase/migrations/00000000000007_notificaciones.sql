-- ============================================================
-- Turnitos — Etapa 7: notificaciones por email (outbox + pg_cron)
-- ============================================================

create extension if not exists pg_net;
create extension if not exists pg_cron;

-- ---------- Config y outbox ----------

create table public.app_config (
  key text primary key,
  value text not null
);

alter table public.app_config enable row level security;
-- Sin policies ni GRANTs a anon/authenticated: solo lo leen funciones
-- SECURITY DEFINER. No es un dato sensible, pero tampoco tiene por qué
-- ser público vía la API.

insert into public.app_config (key, value)
values ('app_base_url', 'http://localhost:5173')
on conflict (key) do nothing;

create table public.notificacion (
  id uuid primary key default gen_random_uuid(),
  turno_id uuid references public.turno (id) on delete cascade,
  tipo text not null check (tipo in (
    'confirmacion_cliente',
    'recordatorio_cliente',
    'recuperacion_cliente',
    'turno_nuevo_negocio',
    'cancelacion_negocio',
    'reprogramacion_negocio'
  )),
  destinatario_email text not null,
  asunto text not null,
  cuerpo_html text not null,
  estado text not null default 'pendiente' check (estado in ('pendiente', 'enviando', 'enviado', 'error')),
  request_id bigint,
  intentos int not null default 0,
  error_detalle text,
  created_at timestamptz not null default now(),
  enviado_at timestamptz
);

create index notificacion_pendiente_idx on public.notificacion (created_at) where estado = 'pendiente';
create index notificacion_enviando_idx on public.notificacion (request_id) where estado = 'enviando';

alter table public.notificacion enable row level security;
-- Mismo criterio que app_config: sin GRANTs a anon/authenticated. Contiene
-- email/nombre del cliente en el cuerpo del mensaje — nadie la consulta vía
-- API, solo las funciones de abajo (que corren SECURITY DEFINER).

-- ---------- Helpers ----------

create or replace function public.escapar_html(p_texto text)
returns text
language sql
immutable
as $$
  select replace(replace(replace(coalesce(p_texto, ''), '&', '&amp;'), '<', '&lt;'), '>', '&gt;');
$$;

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
  values (p_turno_id, p_tipo, p_destinatario_email, p_asunto, p_cuerpo_html);
$$;

-- ---------- Dispatcher (pg_net + Vault) ----------

create or replace function public.despachar_notificaciones_pendientes()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_api_key text;
  v_notif record;
  v_request_id bigint;
begin
  select decrypted_secret into v_api_key
  from vault.decrypted_secrets
  where name = 'resend_api_key';

  if v_api_key is null then
    return; -- sin key configurada todavía; no rompe el cron
  end if;

  for v_notif in
    select * from notificacion
    where estado = 'pendiente'
    order by created_at
    limit 20
  loop
    begin
      select net.http_post(
        url := 'https://api.resend.com/emails',
        headers := jsonb_build_object(
          'Authorization', 'Bearer ' || v_api_key,
          'Content-Type', 'application/json'
        ),
        body := jsonb_build_object(
          'from', 'Turnitos <onboarding@resend.dev>',
          'to', jsonb_build_array(v_notif.destinatario_email),
          'subject', v_notif.asunto,
          'html', v_notif.cuerpo_html
        )
      ) into v_request_id;

      -- 'enviando', no 'enviado': recién emitimos el POST, todavía no
      -- sabemos si Resend lo aceptó. confirmar_notificaciones_enviadas()
      -- resuelve el estado final mirando net._http_response.
      update notificacion
      set estado = 'enviando', request_id = v_request_id, intentos = intentos + 1
      where id = v_notif.id;
    exception
      when others then
        update notificacion
        set estado = 'error', intentos = intentos + 1, error_detalle = sqlerrm
        where id = v_notif.id;
    end;
  end loop;
end;
$$;

-- confirmar_notificaciones_enviadas: cierra el lazo mirando la respuesta
-- HTTP real que pg_net guarda en net._http_response, en vez de dar por
-- entregado un email que Resend pudo haber rechazado.
create or replace function public.confirmar_notificaciones_enviadas()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_notif record;
  v_resp record;
begin
  for v_notif in
    select * from notificacion
    where estado = 'enviando' and request_id is not null
  loop
    select * into v_resp from net._http_response where id = v_notif.request_id;

    if v_resp.id is not null and v_resp.status_code between 200 and 299 then
      update notificacion
      set estado = 'enviado', enviado_at = now()
      where id = v_notif.id;
    elsif v_resp.id is not null then
      update notificacion
      set estado = 'error',
          error_detalle = 'HTTP ' || coalesce(v_resp.status_code::text, '?') || ': ' ||
                           coalesce(v_resp.content, v_resp.error_msg, '')
      where id = v_notif.id;
    elsif v_notif.created_at < now() - interval '10 minutes' then
      -- pasaron 10 minutos y net._http_response nunca tuvo esta fila:
      -- lo tratamos como error en vez de dejarlo 'enviando' para siempre.
      update notificacion
      set estado = 'error', error_detalle = 'Sin respuesta de Resend después de 10 minutos'
      where id = v_notif.id;
    end if;
    -- si no hay respuesta todavía y no pasaron los 10 minutos, se deja en
    -- 'enviando' y se reintenta en la próxima corrida del cron.
  end loop;
end;
$$;

-- ---------- Recordatorio 24hs ----------

create or replace function public.generar_recordatorios_24h()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_base_url text;
  v_turno record;
begin
  select value into v_base_url from app_config where key = 'app_base_url';

  for v_turno in
    select t.id, t.token_gestion, t.cliente_nombre, t.cliente_email, t.fecha, t.hora_inicio,
           s.nombre as servicio_nombre, n.nombre as negocio_nombre, n.slug as negocio_slug
    from turno t
    join servicio s on s.id = t.servicio_id
    join negocio n on n.id = t.negocio_id
    where t.estado = 'confirmado'
      and (t.fecha + t.hora_inicio) at time zone 'America/Argentina/Buenos_Aires'
          between now() + interval '23 hours' and now() + interval '25 hours'
      and not exists (
        select 1 from notificacion nt
        where nt.turno_id = t.id and nt.tipo = 'recordatorio_cliente'
      )
  loop
    perform encolar_notificacion(
      v_turno.id,
      'recordatorio_cliente',
      v_turno.cliente_email,
      'Recordatorio: tu turno en ' || v_turno.negocio_nombre || ' es mañana',
      '<p>Hola ' || escapar_html(v_turno.cliente_nombre) || ',</p>' ||
      '<p>Te recordamos tu turno de <strong>' || escapar_html(v_turno.servicio_nombre) || '</strong> ' ||
      'en ' || escapar_html(v_turno.negocio_nombre) || ' el ' || v_turno.fecha ||
      ' a las ' || to_char(v_turno.hora_inicio, 'HH24:MI') || '.</p>' ||
      '<p><a href="' || v_base_url || '/' || v_turno.negocio_slug || '/mi-turno?token=' || v_turno.token_gestion || '">Ver mi turno</a></p>'
    );
  end loop;
end;
$$;

-- ---------- Recuperación de turno por email ----------

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

grant execute on function public.solicitar_recuperacion_turno(text) to anon, authenticated;

-- ---------- Cron ----------

select cron.schedule('despachar-notificaciones', '*/5 * * * *', $$select public.despachar_notificaciones_pendientes();$$);
select cron.schedule('confirmar-notificaciones', '*/5 * * * *', $$select public.confirmar_notificaciones_enviadas();$$);
select cron.schedule('generar-recordatorios-24h', '*/15 * * * *', $$select public.generar_recordatorios_24h();$$);

-- ---------- crear_turno: + notificaciones ----------

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

grant execute on function public.crear_turno(uuid, uuid, date, time, text, text, text, text, uuid) to anon, authenticated;

-- ---------- cancelar_turno: + notificación ----------

create or replace function public.cancelar_turno(p_token uuid)
returns public.turno
language plpgsql
security definer
set search_path = public
as $$
declare
  v_turno public.turno;
  v_negocio_nombre text;
  v_negocio_email text;
  v_servicio_nombre text;
begin
  select * into v_turno from turno where token_gestion = p_token;

  if v_turno.id is null then
    raise exception 'Turno no encontrado';
  end if;

  if v_turno.estado <> 'confirmado' then
    raise exception 'Este turno no se puede cancelar';
  end if;

  select nombre, email into v_negocio_nombre, v_negocio_email
  from negocio where id = v_turno.negocio_id;

  select nombre into v_servicio_nombre
  from servicio where id = v_turno.servicio_id;

  update turno set estado = 'cancelado' where id = v_turno.id returning * into v_turno;

  perform encolar_notificacion(
    v_turno.id,
    'cancelacion_negocio',
    v_negocio_email,
    'Turno cancelado — ' || v_negocio_nombre,
    '<p>El turno de <strong>' || escapar_html(v_turno.cliente_nombre) || '</strong> (' || escapar_html(v_turno.cliente_email) || ') fue cancelado.</p>' ||
    '<p>Servicio: ' || escapar_html(v_servicio_nombre) || '<br>' ||
    'Fecha: ' || v_turno.fecha || ' a las ' || to_char(v_turno.hora_inicio, 'HH24:MI') || '</p>'
  );

  return v_turno;
end;
$$;

grant execute on function public.cancelar_turno(uuid) to anon, authenticated;

-- ---------- reprogramar_turno: + notificación ----------

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
  v_negocio_nombre text;
  v_negocio_email text;
  v_servicio_nombre text;
  v_duracion int;
  v_dia text;
  v_dias text[] := array['domingo', 'lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado'];
  v_hora_fin time;
  v_fecha_anterior date;
  v_hora_anterior time;
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

  select negocio.estado, negocio.horario_atencion, negocio.nombre, negocio.email
  into v_negocio_estado, v_horario_atencion, v_negocio_nombre, v_negocio_email
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

  select servicio.duracion_minutos, servicio.nombre into v_duracion, v_servicio_nombre
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

  v_fecha_anterior := v_turno.fecha;
  v_hora_anterior := v_turno.hora_inicio;

  begin
    update turno
    set fecha = p_fecha, hora_inicio = p_hora_inicio, hora_fin = v_hora_fin
    where id = v_turno.id
    returning * into v_turno;
  exception
    when exclusion_violation then
      raise exception 'Ese horario ya no está disponible';
  end;

  perform encolar_notificacion(
    v_turno.id,
    'reprogramacion_negocio',
    v_negocio_email,
    'Turno reprogramado — ' || v_negocio_nombre,
    '<p>El turno de <strong>' || escapar_html(v_turno.cliente_nombre) || '</strong> (' || escapar_html(v_turno.cliente_email) || ') fue reprogramado.</p>' ||
    '<p>Servicio: ' || escapar_html(v_servicio_nombre) || '<br>' ||
    'Antes: ' || v_fecha_anterior || ' a las ' || to_char(v_hora_anterior, 'HH24:MI') || '<br>' ||
    'Ahora: ' || v_turno.fecha || ' a las ' || to_char(v_turno.hora_inicio, 'HH24:MI') || '</p>'
  );

  return v_turno;
end;
$$;

grant execute on function public.reprogramar_turno(uuid, date, time) to anon, authenticated;
