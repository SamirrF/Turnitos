-- ============================================================
-- Turnitos — Deploy a producción: app_base_url apunta al dominio real
-- ============================================================

update public.app_config
set value = 'https://turnitossapp.com'
where key = 'app_base_url';
