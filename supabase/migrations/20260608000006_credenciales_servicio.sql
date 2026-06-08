-- ============================================================================
-- ARRIENDA+ — Credenciales de portal por servicio (Fase 1)
--
-- Generaliza el registro de servicios: cada proveedor declara si su portal es
-- PUBLICO (basta el NIC/contrato, ej. Gases de Occidente) o AUTENTICADO (requiere
-- usuario + contraseña del titular, ej. Celsia). La credencial se guarda por
-- servicio (no global por env), para que cada arrendador use la suya.
--
-- Seguridad: portal_password vive en servicios_publicos, cuya RLS (servicios_all)
-- solo permite acceso a admin o al arrendador DUEÑO (el arrendatario NO ve estas
-- filas). El scraper la lee con service_role (bypassa RLS).
-- TODO (prod): cifrar en reposo con Supabase Vault / pgsodium en vez de texto plano.
-- ============================================================================

-- --- comercializadoras: vinculo explicito al proveedor del scraper + modo auth --
alter table public.comercializadoras
  add column if not exists provider_key text,
  add column if not exists requiere_credenciales boolean not null default false;

comment on column public.comercializadoras.provider_key is
  'Clave del proveedor del scraper (apps/scraper providers), ej. "celsia". Null si no hay scraper.';
comment on column public.comercializadoras.requiere_credenciales is
  'true si el portal exige login (usuario+contraseña). El registro de servicio pedira credenciales.';

-- Backfill por nombre para las comercializadoras ya existentes.
update public.comercializadoras set provider_key = 'celsia',             requiere_credenciales = true  where nombre = 'Celsia';
update public.comercializadoras set provider_key = 'gases-de-occidente', requiere_credenciales = false where nombre = 'Gases de Occidente';
update public.comercializadoras set provider_key = 'acuavalle',          requiere_credenciales = false where nombre = 'Acuavalle';
update public.comercializadoras set provider_key = 'aquaservicios',      requiere_credenciales = false where nombre = 'AquaServicios';

-- --- servicios_publicos: credenciales del titular (solo proveedores autenticados)
alter table public.servicios_publicos
  add column if not exists portal_usuario text,
  add column if not exists portal_password text;

comment on column public.servicios_publicos.portal_usuario is
  'Usuario/email del titular para portales autenticados (null en portales publicos).';
comment on column public.servicios_publicos.portal_password is
  'Contraseña del portal (texto plano por ahora; cifrar en prod). RLS: solo dueño/admin/service_role.';

-- --- claim_scraping_job: devuelve tambien provider_key + credenciales del servicio
create or replace function public.claim_scraping_job()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_job public.scraping_jobs;
  v_result jsonb;
begin
  select * into v_job
  from public.scraping_jobs
  where estado = 'pendiente'
  order by created_at
  for update skip locked
  limit 1;

  if not found then
    return null;
  end if;

  update public.scraping_jobs
  set estado = 'en_proceso', locked_at = now(), intentos = intentos + 1, updated_at = now()
  where id = v_job.id;

  select jsonb_build_object(
    'id', v_job.id,
    'servicioId', s.id,
    'tipo', s.tipo,
    'comercializadora', c.nombre,
    'providerKey', c.provider_key,
    'portalUrl', c.portal_url,
    'nicNis', s.nic_nis,
    'portalUsuario', s.portal_usuario,
    'portalPassword', s.portal_password,
    'periodo', v_job.periodo
  ) into v_result
  from public.servicios_publicos s
  join public.comercializadoras c on c.id = s.comercializadora_id
  where s.id = v_job.servicio_id;

  return v_result;
end;
$$;

revoke all on function public.claim_scraping_job() from public;
grant execute on function public.claim_scraping_job() to service_role;
