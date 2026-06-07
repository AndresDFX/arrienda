-- ============================================================================
-- ARRIENDA+ — Row Level Security (matriz de permisos, doc. seccion 3.4)
--
-- Modelo: el frontend habla con Supabase usando la ANON key + JWT del usuario
-- (RLS aplica). Las server functions y el scraper usan la SERVICE_ROLE key,
-- que BYPASEA RLS.
--
-- IMPORTANTE: las relaciones cruzadas (propiedades<->contratos<->liquidaciones)
-- se resuelven con funciones SECURITY DEFINER para EVITAR recursion infinita de
-- RLS (una policy que consulta otra tabla con RLS que a su vez consulta la
-- primera). Las SD leen las tablas sin re-disparar RLS.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- Helpers SECURITY DEFINER (rompen la recursion entre policies)
-- ---------------------------------------------------------------------------
create or replace function public.owns_propiedad(p_propiedad uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.propiedades
    where id = p_propiedad and arrendador_id = auth.uid()
  );
$$;

create or replace function public.tenant_of_propiedad(p_propiedad uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.contratos
    where propiedad_id = p_propiedad and arrendatario_id = auth.uid()
  );
$$;

create or replace function public.owns_servicio(p_servicio uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.servicios_publicos s
    join public.propiedades p on p.id = s.propiedad_id
    where s.id = p_servicio and p.arrendador_id = auth.uid()
  );
$$;

create or replace function public.can_see_contrato(p_contrato uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.contratos c
    join public.propiedades p on p.id = c.propiedad_id
    where c.id = p_contrato
      and (c.arrendatario_id = auth.uid() or p.arrendador_id = auth.uid())
  );
$$;

create or replace function public.can_see_liquidacion(p_liq uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.liquidaciones l
    join public.contratos c on c.id = l.contrato_id
    join public.propiedades p on p.id = c.propiedad_id
    where l.id = p_liq
      and (c.arrendatario_id = auth.uid() or p.arrendador_id = auth.uid())
  );
$$;

-- ---------------------------------------------------------------------------
-- Habilitar RLS
-- ---------------------------------------------------------------------------
alter table public.profiles enable row level security;
alter table public.recaudadores enable row level security;
alter table public.comercializadoras enable row level security;
alter table public.propiedades enable row level security;
alter table public.contratos enable row level security;
alter table public.servicios_publicos enable row level security;
alter table public.liquidaciones enable row level security;
alter table public.liquidacion_items enable row level security;
alter table public.transacciones enable row level security;
alter table public.extracciones enable row level security;
alter table public.scraping_jobs enable row level security;

-- ---------------------------------------------------------------------------
-- profiles
-- ---------------------------------------------------------------------------
create policy profiles_select_self_or_admin on public.profiles
  for select to authenticated
  using (id = auth.uid() or public.is_admin());

create policy profiles_update_self_or_admin on public.profiles
  for update to authenticated
  using (id = auth.uid() or public.is_admin())
  with check (id = auth.uid() or public.is_admin());

create policy profiles_admin_insert on public.profiles
  for insert to authenticated
  with check (public.is_admin());

-- ---------------------------------------------------------------------------
-- Catalogos: lectura para cualquier autenticado; escritura solo admin.
-- ---------------------------------------------------------------------------
create policy recaudadores_select on public.recaudadores
  for select to authenticated using (true);
create policy recaudadores_admin_write on public.recaudadores
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

create policy comercializadoras_select on public.comercializadoras
  for select to authenticated using (true);
create policy comercializadoras_admin_write on public.comercializadoras
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- ---------------------------------------------------------------------------
-- propiedades
-- ---------------------------------------------------------------------------
create policy propiedades_select on public.propiedades
  for select to authenticated
  using (public.is_admin() or arrendador_id = auth.uid() or public.tenant_of_propiedad(id));

create policy propiedades_insert on public.propiedades
  for insert to authenticated
  with check (
    public.is_admin()
    or (arrendador_id = auth.uid() and public.current_rol() = 'arrendador')
  );

create policy propiedades_update on public.propiedades
  for update to authenticated
  using (public.is_admin() or arrendador_id = auth.uid())
  with check (public.is_admin() or arrendador_id = auth.uid());

create policy propiedades_delete on public.propiedades
  for delete to authenticated
  using (public.is_admin() or arrendador_id = auth.uid());

-- ---------------------------------------------------------------------------
-- contratos
-- ---------------------------------------------------------------------------
create policy contratos_select on public.contratos
  for select to authenticated
  using (public.is_admin() or arrendatario_id = auth.uid() or public.owns_propiedad(propiedad_id));

create policy contratos_write on public.contratos
  for all to authenticated
  using (public.is_admin() or public.owns_propiedad(propiedad_id))
  with check (public.is_admin() or public.owns_propiedad(propiedad_id));

-- ---------------------------------------------------------------------------
-- servicios_publicos
-- ---------------------------------------------------------------------------
create policy servicios_all on public.servicios_publicos
  for all to authenticated
  using (public.is_admin() or public.owns_propiedad(propiedad_id))
  with check (public.is_admin() or public.owns_propiedad(propiedad_id));

-- ---------------------------------------------------------------------------
-- liquidaciones / items
-- ---------------------------------------------------------------------------
create policy liquidaciones_select on public.liquidaciones
  for select to authenticated
  using (public.is_admin() or public.can_see_contrato(contrato_id));

create policy liquidacion_items_select on public.liquidacion_items
  for select to authenticated
  using (public.is_admin() or public.can_see_liquidacion(liquidacion_id));

-- ---------------------------------------------------------------------------
-- transacciones
-- ---------------------------------------------------------------------------
create policy transacciones_select on public.transacciones
  for select to authenticated
  using (public.is_admin() or public.can_see_liquidacion(liquidacion_id));

create policy transacciones_insert_arrendatario on public.transacciones
  for insert to authenticated
  with check (public.is_admin() or public.can_see_liquidacion(liquidacion_id));

-- ---------------------------------------------------------------------------
-- extracciones / scraping_jobs (lectura admin + arrendador dueño)
-- ---------------------------------------------------------------------------
create policy extracciones_select on public.extracciones
  for select to authenticated
  using (public.is_admin() or public.owns_servicio(servicio_id));

create policy scraping_jobs_select on public.scraping_jobs
  for select to authenticated
  using (public.is_admin() or public.owns_servicio(servicio_id));
