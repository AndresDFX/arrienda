-- ============================================================================
-- ARRIENDA+ — Cola de scraping (Fase 1): claim/complete atomicos.
--
-- El scraper (proceso de confianza en maquina residencial) llama estas RPCs con
-- la service_role key. NO se exponen a usuarios (revocadas de public).
-- ============================================================================

-- Reclama atomicamente el job pendiente mas antiguo y devuelve sus datos.
-- FOR UPDATE SKIP LOCKED evita que dos workers tomen el mismo job.
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
    'portalUrl', c.portal_url,
    'nicNis', s.nic_nis,
    'periodo', v_job.periodo
  ) into v_result
  from public.servicios_publicos s
  join public.comercializadoras c on c.id = s.comercializadora_id
  where s.id = v_job.servicio_id;

  return v_result;
end;
$$;

-- Marca el resultado del job y registra la extraccion.
create or replace function public.complete_scraping_job(
  p_job_id uuid,
  p_estado public.estado_job,
  p_valor bigint default null,
  p_ref text default null,
  p_fecha date default null,
  p_error text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_servicio uuid;
  v_periodo date;
begin
  select servicio_id, periodo into v_servicio, v_periodo
  from public.scraping_jobs
  where id = p_job_id;

  if not found then
    raise exception 'scraping_job % no existe', p_job_id;
  end if;

  update public.scraping_jobs
  set estado = p_estado,
      resultado = jsonb_build_object('valor', p_valor, 'ref', p_ref, 'fecha', p_fecha, 'error', p_error),
      updated_at = now()
  where id = p_job_id;

  insert into public.extracciones
    (servicio_id, periodo, valor_extraido, ref_pago, fecha_limite, estado, error)
  values
    (v_servicio, v_periodo, p_valor, p_ref, p_fecha,
     case when p_estado = 'completado' then 'completado'::public.estado_job
          else 'fallido'::public.estado_job end,
     p_error);
end;
$$;

-- Solo el backend (service_role) puede operar la cola.
revoke all on function public.claim_scraping_job() from public;
revoke all on function public.complete_scraping_job(uuid, public.estado_job, bigint, text, date, text) from public;
grant execute on function public.claim_scraping_job() to service_role;
grant execute on function public.complete_scraping_job(uuid, public.estado_job, bigint, text, date, text) to service_role;
