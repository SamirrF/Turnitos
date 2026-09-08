-- ============================================================
-- Turnitos — Deploy a producción: remitente propio en Resend
-- (correr recién cuando turnitossapp.com esté verificado en Resend)
-- ============================================================

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
          'from', 'Turnitos <notificaciones@turnitossapp.com>',
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
