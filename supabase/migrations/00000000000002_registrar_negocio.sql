-- ============================================================
-- Turnitos — Etapa 1: alta atómica de negocio + usuario_negocio
-- ============================================================

-- slug_disponible: callable por anon, porque el usuario todavía no está
-- autenticado cuando elige el slug en el formulario de registro, y
-- `negocio` no tiene policy de SELECT pública.
create or replace function public.slug_disponible(p_slug text)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select not exists (select 1 from public.negocio where slug = p_slug);
$$;

grant execute on function public.slug_disponible(text) to anon, authenticated;

-- registrar_negocio: corre como el usuario ya autenticado (auth.uid()
-- disponible), inserta negocio + usuario_negocio en una sola transacción
-- implícita. negocio.email guarda el contacto público del negocio;
-- usuario_negocio.email usa auth.email() para no divergir de la cuenta real.
create or replace function public.registrar_negocio(p_nombre text, p_slug text, p_email text)
returns public.negocio
language plpgsql
security definer
set search_path = public
as $$
declare
  v_negocio public.negocio;
begin
  if auth.uid() is null then
    raise exception 'Debe iniciar sesión antes de registrar un negocio';
  end if;

  if p_nombre is null or length(trim(p_nombre)) = 0 then
    raise exception 'El nombre del negocio no puede estar vacío';
  end if;

  if p_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then
    raise exception 'Email inválido';
  end if;

  if exists (select 1 from public.usuario_negocio where id = auth.uid()) then
    raise exception 'Este usuario ya tiene un negocio registrado';
  end if;

  begin
    insert into public.negocio (nombre, slug, email)
    values (p_nombre, p_slug, p_email)
    returning * into v_negocio;
  exception
    when unique_violation then
      raise exception 'Ese slug ya está en uso, elegí otro';
  end;

  begin
    insert into public.usuario_negocio (id, negocio_id, email)
    values (auth.uid(), v_negocio.id, auth.email());
  exception
    when others then
      raise exception 'No se pudo vincular el usuario al negocio, intentá de nuevo';
  end;

  return v_negocio;
end;
$$;

grant execute on function public.registrar_negocio(text, text, text) to authenticated;
