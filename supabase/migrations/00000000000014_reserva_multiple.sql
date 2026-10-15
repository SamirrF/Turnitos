-- ============================================================
-- Turnitos — Reserva de varios turnos (hasta 4) en una sola operación
-- ============================================================
-- Un turno por horario, unidos por grupo_reserva_id. crear_turno NO se toca:
-- el frontend viejo sigue funcionando hasta que se despliegue el nuevo, que
-- usa solo crear_reserva (también para 1 horario).
--
-- Orden de despliegue: primero esta migración, después el frontend.

begin;

-- ---------- 1. Columna ----------
-- Nullable: turnos viejos, turnos del panel y reservas de un solo horario
-- quedan en null.
alter table public.turno add column grupo_reserva_id uuid;

create index turno_grupo_reserva_idx on public.turno (grupo_reserva_id)
  where grupo_reserva_id is not null;

-- ---------- 2. crear_reserva (público) ----------
-- Mismas validaciones y misma lógica de disponibilidad que crear_turno
-- (migración 13), repetidas por cada horario. Todo o nada: si un horario
-- falla, se revierte la reserva completa.
create function public.crear_reserva(
  p_negocio_id uuid,
  p_servicio_id uuid,
  p_fecha date,
  p_horas time[],
  p_cliente_nombre text,
  p_cliente_email text,
  p_cliente_telefono text,
  p_nota text default null,
  p_estilista_id uuid default null,
  p_metodo_pago text default null
)
returns setof public.turno
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
  v_hora time;
  v_hora_fin time;
  v_estilista_id uuid;
  v_estilista_previo uuid;
  v_grupo uuid;
  v_turno public.turno;
  v_turnos public.turno[] := '{}';
  v_cantidad int;
  v_total numeric := 0;
  v_base_url text;
  v_lista_cliente text := '';
  v_lista_negocio text := '';
begin
  -- ----- Horarios pedidos -----
  if p_horas is null or cardinality(p_horas) = 0 then
    raise exception 'Elegí al menos un horario';
  end if;

  if array_ndims(p_horas) <> 1 or array_position(p_horas, null) is not null then
    raise exception 'Horario inválido';
  end if;

  v_cantidad := cardinality(p_horas);

  if v_cantidad > 4 then
    raise exception 'Podés reservar hasta 4 horarios por vez';
  end if;

  if (select count(distinct u.h) from unnest(p_horas) as u(h)) <> v_cantidad then
    raise exception 'Hay horarios repetidos';
  end if;

  -- ----- Mismas validaciones que crear_turno -----
  if p_cliente_nombre is null or length(trim(p_cliente_nombre)) = 0 then
    raise exception 'El nombre es obligatorio';
  end if;

  if p_cliente_email is null or p_cliente_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then
    raise exception 'Email inválido';
  end if;

  if p_cliente_telefono is null or p_cliente_telefono !~ '^[0-9+\-\s()]{6,}$' then
    raise exception 'Teléfono inválido';
  end if;

  if p_metodo_pago is not null and p_metodo_pago not in ('efectivo', 'transferencia') then
    raise exception 'Método de pago inválido';
  end if;

  if p_fecha is null or p_fecha < current_date then
    raise exception 'No se pueden reservar turnos en fechas pasadas';
  end if;

  select negocio.estado, negocio.horario_atencion, negocio.nombre, negocio.slug, negocio.email
  into v_estado, v_horario_atencion, v_negocio_nombre, v_negocio_slug, v_negocio_email
  from negocio where negocio.id = p_negocio_id;

  if v_estado is null or v_estado <> 'activo' then
    raise exception 'Negocio no disponible';
  end if;

  if exists (
    select 1 from dia_no_laborable
    where dia_no_laborable.negocio_id = p_negocio_id and dia_no_laborable.fecha = p_fecha
  ) then
    raise exception 'El negocio no atiende ese día';
  end if;

  select servicio.duracion_minutos, servicio.precio, servicio.nombre
  into v_duracion, v_precio, v_servicio_nombre
  from servicio
  where servicio.id = p_servicio_id and servicio.negocio_id = p_negocio_id and servicio.activo = true;

  if v_duracion is null then
    raise exception 'Servicio no disponible';
  end if;

  v_dia := v_dias[extract(dow from p_fecha)::int + 1];

  if v_cantidad > 1 then
    v_grupo := gen_random_uuid();
  end if;

  select value into v_base_url from app_config where key = 'app_base_url';

  -- ----- Un turno por horario, en orden -----
  foreach v_hora in array (select array_agg(u.h order by u.h) from unnest(p_horas) as u(h))
  loop
    v_hora_fin := v_hora + (v_duracion || ' minutes')::interval;

    if not exists (
      select 1
      from jsonb_array_elements(coalesce(v_horario_atencion -> v_dia, '[]'::jsonb)) f
      where v_hora >= (f ->> 'inicio')::time
        and v_hora_fin <= (f ->> 'fin')::time
    ) then
      raise exception 'Fuera del horario de atención del negocio';
    end if;

    -- Con "cualquiera disponible" se prefiere el estilista del horario
    -- anterior (best-effort, no garantizado). Los turnos ya insertados en
    -- esta misma transacción cuentan en el not exists, así que dos horarios
    -- que se pisan entre sí se detectan solos.
    v_estilista_id := null;

    select e.id into v_estilista_id
    from estilista e
    where e.negocio_id = p_negocio_id
      and e.activo = true
      and (p_estilista_id is null or e.id = p_estilista_id)
      and exists (
        select 1
        from jsonb_array_elements(coalesce(e.horario_disponible -> v_dia, '[]'::jsonb)) f
        where v_hora >= (f ->> 'inicio')::time
          and v_hora_fin <= (f ->> 'fin')::time
      )
      and not exists (
        select 1 from turno t
        where t.estilista_id = e.id
          and t.fecha = p_fecha
          and t.estado <> 'cancelado'
          and v_hora < t.hora_fin
          and t.hora_inicio < v_hora_fin
      )
    order by (e.id = v_estilista_previo) desc nulls last, e.id
    limit 1;

    if v_estilista_id is null then
      raise exception 'Ese horario ya no está disponible';
    end if;

    -- Rate limit por horario, mismo lugar relativo que en crear_turno: una
    -- reserva de 4 consume 4 unidades. Si después falla otro horario, el
    -- rollback también deshace estas filas de limite_tasa.
    perform chequear_limite_tasa('turno:email:' || lower(p_cliente_email), 5, interval '1 hour');
    perform chequear_limite_tasa('turno:ip:' || ip_cliente(), 10, interval '1 hour');

    begin
      insert into public.turno (
        negocio_id, estilista_id, servicio_id, fecha, hora_inicio, hora_fin,
        cliente_nombre, cliente_email, cliente_telefono, nota, monto, metodo_pago,
        grupo_reserva_id
      ) values (
        p_negocio_id, v_estilista_id, p_servicio_id, p_fecha, v_hora, v_hora_fin,
        p_cliente_nombre, p_cliente_email, p_cliente_telefono, p_nota, v_precio, p_metodo_pago,
        v_grupo
      )
      returning * into v_turno;
    exception
      when exclusion_violation then
        raise exception 'Ese horario ya no está disponible';
    end;

    v_estilista_previo := v_estilista_id;
    v_turnos := v_turnos || v_turno;
    v_total := v_total + v_precio;

    v_lista_cliente := v_lista_cliente ||
      '<li>' || to_char(v_hora, 'HH24:MI') || ' — <a href="' || v_base_url || '/' || v_negocio_slug ||
      '/mi-turno?token=' || v_turno.token_gestion || '">Ver o gestionar este turno</a></li>';
    v_lista_negocio := v_lista_negocio || '<li>' || to_char(v_hora, 'HH24:MI') || '</li>';
  end loop;

  -- ----- Un solo email al cliente y uno al negocio -----
  perform encolar_notificacion(
    v_turnos[1].id,
    'confirmacion_cliente',
    p_cliente_email,
    'Confirmación de tu turno en ' || v_negocio_nombre,
    '<p>Hola ' || escapar_html(p_cliente_nombre) || ',</p>' ||
    '<p>' ||
    (case when v_cantidad = 1
      then 'Tu turno de <strong>' || escapar_html(v_servicio_nombre) || '</strong> en ' ||
           escapar_html(v_negocio_nombre) || ' quedó confirmado para el ' || p_fecha || ':'
      else 'Tus ' || v_cantidad || ' turnos de <strong>' || escapar_html(v_servicio_nombre) || '</strong> en ' ||
           escapar_html(v_negocio_nombre) || ' quedaron confirmados para el ' || p_fecha || ':'
    end) || '</p>' ||
    '<ul>' || v_lista_cliente || '</ul>' ||
    '<p>Total: $' || v_total || '</p>'
  );

  -- p_metodo_pago ya está validado contra la lista cerrada, no hace falta
  -- escapar_html.
  perform encolar_notificacion(
    v_turnos[1].id,
    'turno_nuevo_negocio',
    v_negocio_email,
    (case when v_cantidad = 1 then 'Nuevo turno reservado — ' else 'Nuevos turnos reservados — ' end) ||
      v_negocio_nombre,
    '<p>' ||
    (case when v_cantidad = 1 then 'Nuevo turno' else v_cantidad || ' turnos nuevos' end) ||
    ' de <strong>' || escapar_html(p_cliente_nombre) || '</strong> (' || escapar_html(p_cliente_email) || ').</p>' ||
    '<p>Servicio: ' || escapar_html(v_servicio_nombre) || '<br>' ||
    'Fecha: ' || p_fecha || '</p>' ||
    '<ul>' || v_lista_negocio || '</ul>' ||
    '<p>Monto total: $' || v_total ||
    (case when p_metodo_pago is not null
      then '<br>Método de pago: ' || initcap(p_metodo_pago)
      else ''
    end) || '</p>' ||
    (case when p_nota is not null and length(trim(p_nota)) > 0
      then '<p>Nota: ' || escapar_html(p_nota) || '</p>'
      else ''
    end)
  );

  return query select * from unnest(v_turnos);
end;
$$;

grant execute on function public.crear_reserva(uuid, uuid, date, time[], text, text, text, text, uuid, text) to anon, authenticated;

-- ---------- 3. generar_recordatorios_24h: uno por reserva ----------
-- Antes: un email por turno (una reserva de 4 = 4 recordatorios). Ahora: un
-- email por grupo (coalesce(grupo_reserva_id, id)). Se elige el grupo si
-- alguno de sus turnos entra en la ventana de 23–25 h y el grupo no tiene
-- recordatorio todavía; la lista del email incluye TODOS los turnos
-- confirmados del grupo, no solo los que están en la ventana (si no, el
-- último de una reserva larga podría quedar afuera y nunca recordarse).
create or replace function public.generar_recordatorios_24h()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_base_url text;
  v_grupo record;
begin
  select value into v_base_url from app_config where key = 'app_base_url';

  for v_grupo in
    with pendientes as (
      select distinct coalesce(t.grupo_reserva_id, t.id) as clave
      from turno t
      where t.estado = 'confirmado'
        and (t.fecha + t.hora_inicio) at time zone 'America/Argentina/Buenos_Aires'
            between now() + interval '23 hours' and now() + interval '25 hours'
        and not exists (
          select 1
          from notificacion nt
          join turno t2 on t2.id = nt.turno_id
          where nt.tipo = 'recordatorio_cliente'
            and coalesce(t2.grupo_reserva_id, t2.id) = coalesce(t.grupo_reserva_id, t.id)
        )
    )
    select (array_agg(t.id order by t.hora_inicio))[1] as primer_turno_id,
           min(t.cliente_nombre) as cliente_nombre,
           min(t.cliente_email) as cliente_email,
           min(t.fecha) as fecha,
           min(s.nombre) as servicio_nombre,
           min(n.nombre) as negocio_nombre,
           count(*) as cantidad,
           string_agg(
             '<li>' || to_char(t.hora_inicio, 'HH24:MI') || ' — <a href="' || v_base_url || '/' || n.slug ||
             '/mi-turno?token=' || t.token_gestion || '">Ver mi turno</a></li>',
             '' order by t.hora_inicio
           ) as lista
    from pendientes p
    join turno t on coalesce(t.grupo_reserva_id, t.id) = p.clave and t.estado = 'confirmado'
    join servicio s on s.id = t.servicio_id
    join negocio n on n.id = t.negocio_id
    group by p.clave
  loop
    perform encolar_notificacion(
      v_grupo.primer_turno_id,
      'recordatorio_cliente',
      v_grupo.cliente_email,
      'Recordatorio: tu turno en ' || v_grupo.negocio_nombre || ' es mañana',
      '<p>Hola ' || escapar_html(v_grupo.cliente_nombre) || ',</p>' ||
      '<p>Te recordamos ' ||
      (case when v_grupo.cantidad = 1 then 'tu turno' else 'tus ' || v_grupo.cantidad || ' turnos' end) ||
      ' de <strong>' || escapar_html(v_grupo.servicio_nombre) || '</strong> en ' ||
      escapar_html(v_grupo.negocio_nombre) || ' el ' || v_grupo.fecha || ':</p>' ||
      '<ul>' || v_grupo.lista || '</ul>'
    );
  end loop;
end;
$$;

-- create or replace conserva los privilegios, pero se reafirma el revoke de
-- la migración 12 por las dudas.
revoke execute on function public.generar_recordatorios_24h() from public, anon, authenticated;

commit;
