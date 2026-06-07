-- ============================================================================
-- ARRIENDA+ — Esquema base (Fase 0 core financiero + tablas esqueleto Fase 1)
-- Modelo conceptual del documento, seccion 6.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- Tipos (deben coincidir con packages/shared/src/domain.ts)
-- ---------------------------------------------------------------------------
create type public.rol as enum ('admin', 'arrendador', 'arrendatario');
create type public.modalidad_cobro as enum ('completo', 'sin_servicios');
create type public.tipo_servicio as enum ('energia', 'agua', 'gas');
create type public.estado_liquidacion as enum ('borrador', 'emitida', 'pagada', 'vencida', 'anulada');
create type public.estado_transaccion as enum ('pendiente', 'aprobada', 'rechazada', 'reversada');
create type public.destino_tipo as enum ('arrendador', 'plataforma', 'recaudador');
create type public.estado_job as enum ('pendiente', 'en_proceso', 'completado', 'fallido', 'manual');
create type public.payment_provider as enum ('mock', 'wompi');

-- ---------------------------------------------------------------------------
-- Utilidades
-- ---------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- profiles: extiende auth.users con rol y datos de contacto
-- ---------------------------------------------------------------------------
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  rol public.rol not null default 'arrendatario',
  nombre text not null default '',
  telefono text,
  cuenta_bancaria text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger trg_profiles_updated before update on public.profiles
  for each row execute function public.set_updated_at();

-- Crea el profile automaticamente al registrar un usuario en auth.users.
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public, auth as $$
begin
  insert into public.profiles (id, nombre, rol)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'nombre', ''),
    coalesce((new.raw_user_meta_data ->> 'rol')::public.rol, 'arrendatario')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Evita que un usuario no-admin se auto-asigne un rol (escalada de privilegios).
create or replace function public.guard_rol_change()
returns trigger language plpgsql security definer set search_path = public, auth as $$
begin
  if new.rol is distinct from old.rol then
    if not exists (select 1 from public.profiles p where p.id = auth.uid() and p.rol = 'admin') then
      raise exception 'Solo un administrador puede cambiar el rol';
    end if;
  end if;
  return new;
end;
$$;
create trigger trg_guard_rol before update on public.profiles
  for each row execute function public.guard_rol_change();

-- ---------------------------------------------------------------------------
-- Helpers de autorizacion para RLS (SECURITY DEFINER evita recursion en RLS)
-- ---------------------------------------------------------------------------
create or replace function public.current_rol()
returns public.rol language sql stable security definer set search_path = public, auth as $$
  select rol from public.profiles where id = auth.uid();
$$;

create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = public, auth as $$
  select exists (select 1 from public.profiles where id = auth.uid() and rol = 'admin');
$$;

-- ---------------------------------------------------------------------------
-- Catalogos administrados por el admin (doc. seccion 3.1)
-- ---------------------------------------------------------------------------
create table public.recaudadores (
  id uuid primary key default gen_random_uuid(),
  nombre text not null,
  cuenta_bancaria text,
  created_at timestamptz not null default now()
);

create table public.comercializadoras (
  id uuid primary key default gen_random_uuid(),
  nombre text not null,
  tipo public.tipo_servicio not null,
  portal_url text,
  recaudador_id uuid references public.recaudadores (id),
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Propiedades y contratos (doc. secciones 3.2, 6)
-- ---------------------------------------------------------------------------
create table public.propiedades (
  id uuid primary key default gen_random_uuid(),
  arrendador_id uuid not null references public.profiles (id) on delete restrict,
  direccion text not null,
  ciudad text not null default 'Cali',
  modalidad_cobro public.modalidad_cobro not null default 'sin_servicios',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index idx_propiedades_arrendador on public.propiedades (arrendador_id);
create trigger trg_propiedades_updated before update on public.propiedades
  for each row execute function public.set_updated_at();

create table public.contratos (
  id uuid primary key default gen_random_uuid(),
  propiedad_id uuid not null references public.propiedades (id) on delete restrict,
  arrendatario_id uuid not null references public.profiles (id) on delete restrict,
  canon bigint not null check (canon > 0),
  fecha_inicio date not null,
  fecha_fin date,
  dia_corte int not null default 1 check (dia_corte between 1 and 28),
  activo boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (fecha_fin is null or fecha_fin > fecha_inicio)
);
create index idx_contratos_propiedad on public.contratos (propiedad_id);
create index idx_contratos_arrendatario on public.contratos (arrendatario_id);
create trigger trg_contratos_updated before update on public.contratos
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Servicios publicos (NIC/NIS) — Fase 1 (doc. seccion 2.2)
-- ---------------------------------------------------------------------------
create table public.servicios_publicos (
  id uuid primary key default gen_random_uuid(),
  propiedad_id uuid not null references public.propiedades (id) on delete cascade,
  tipo public.tipo_servicio not null,
  comercializadora_id uuid not null references public.comercializadoras (id),
  nic_nis text not null,
  activo boolean not null default true,
  created_at timestamptz not null default now()
);
create index idx_servicios_propiedad on public.servicios_publicos (propiedad_id);

-- ---------------------------------------------------------------------------
-- Liquidaciones y su desglose / plan de dispersion (doc. seccion 4.3)
-- ---------------------------------------------------------------------------
create table public.liquidaciones (
  id uuid primary key default gen_random_uuid(),
  contrato_id uuid not null references public.contratos (id) on delete restrict,
  periodo date not null, -- primer dia del mes liquidado
  canon bigint not null,
  comision bigint not null,
  total_servicios bigint not null default 0,
  total bigint not null,
  estado public.estado_liquidacion not null default 'borrador',
  fecha_limite date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (contrato_id, periodo)
);
create index idx_liquidaciones_contrato on public.liquidaciones (contrato_id);
create index idx_liquidaciones_estado on public.liquidaciones (estado);
create trigger trg_liquidaciones_updated before update on public.liquidaciones
  for each row execute function public.set_updated_at();

create table public.liquidacion_items (
  id uuid primary key default gen_random_uuid(),
  liquidacion_id uuid not null references public.liquidaciones (id) on delete cascade,
  concepto text not null,
  monto bigint not null,
  destino_tipo public.destino_tipo not null,
  destino_ref uuid, -- arrendador_id o recaudador_id; null = plataforma
  created_at timestamptz not null default now()
);
create index idx_liquidacion_items_liq on public.liquidacion_items (liquidacion_id);

-- ---------------------------------------------------------------------------
-- Transacciones (recaudo via pasarela) (doc. seccion 6)
-- ---------------------------------------------------------------------------
create table public.transacciones (
  id uuid primary key default gen_random_uuid(),
  liquidacion_id uuid not null references public.liquidaciones (id) on delete restrict,
  monto bigint not null,
  estado public.estado_transaccion not null default 'pendiente',
  pasarela public.payment_provider not null default 'mock',
  pasarela_ref text,
  payload jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index idx_transacciones_liq on public.transacciones (liquidacion_id);
create trigger trg_transacciones_updated before update on public.transacciones
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Extracciones y cola de jobs del scraper — Fase 1 (doc. secciones 5.1, 6)
-- ---------------------------------------------------------------------------
create table public.extracciones (
  id uuid primary key default gen_random_uuid(),
  servicio_id uuid not null references public.servicios_publicos (id) on delete cascade,
  periodo date not null,
  valor_extraido bigint,
  ref_pago text,
  fecha_limite date,
  estado public.estado_job not null default 'pendiente',
  error text,
  created_at timestamptz not null default now()
);
create index idx_extracciones_servicio on public.extracciones (servicio_id);

create table public.scraping_jobs (
  id uuid primary key default gen_random_uuid(),
  servicio_id uuid not null references public.servicios_publicos (id) on delete cascade,
  periodo date not null,
  estado public.estado_job not null default 'pendiente',
  intentos int not null default 0,
  resultado jsonb,
  locked_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (servicio_id, periodo)
);
create index idx_scraping_jobs_estado on public.scraping_jobs (estado);
create trigger trg_scraping_jobs_updated before update on public.scraping_jobs
  for each row execute function public.set_updated_at();
