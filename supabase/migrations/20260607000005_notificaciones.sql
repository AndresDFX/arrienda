-- ============================================================================
-- ARRIENDA+ — Modulo de notificaciones (Fase 1)
--
-- Config parametrizable por el admin (global) y SOBRESCRIBIBLE por el arrendador.
-- El job diario calcula los dias hasta la fecha de corte de cada contrato y, si
-- coincide con un umbral configurado (dias_antes_corte), crea una notificacion.
-- ============================================================================

create type public.canal_notificacion as enum ('email', 'whatsapp');
create type public.tipo_notificacion as enum (
  'corte_proximo',
  'liquidacion_emitida',
  'pago_confirmado',
  'extraccion_fallida'
);
create type public.estado_notificacion as enum ('pendiente', 'enviada', 'fallida');

-- Config: una fila global (admin) + overrides por arrendador.
create table public.notificacion_config (
  id uuid primary key default gen_random_uuid(),
  scope text not null check (scope in ('global', 'arrendador')),
  arrendador_id uuid references public.profiles (id) on delete cascade,
  dias_antes_corte int[] not null default '{5,3,1}',
  canal_email boolean not null default true,
  canal_whatsapp boolean not null default false,
  activo boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (
    (scope = 'global' and arrendador_id is null)
    or (scope = 'arrendador' and arrendador_id is not null)
  ),
  unique (arrendador_id) -- un override por arrendador
);
-- Solo puede existir UNA config global.
create unique index uniq_notif_config_global on public.notificacion_config (scope)
  where scope = 'global';
create trigger trg_notif_config_updated before update on public.notificacion_config
  for each row execute function public.set_updated_at();

-- Log/cola de notificaciones (dedupe + auditoria).
create table public.notificaciones (
  id uuid primary key default gen_random_uuid(),
  contrato_id uuid references public.contratos (id) on delete cascade,
  tipo public.tipo_notificacion not null,
  canal public.canal_notificacion not null,
  destinatario text not null,
  dias_antes int,
  periodo date,
  mensaje text,
  estado public.estado_notificacion not null default 'pendiente',
  enviada_at timestamptz,
  created_at timestamptz not null default now(),
  -- evita avisos duplicados del mismo umbral/canal en el mismo periodo
  unique (contrato_id, tipo, periodo, dias_antes, canal)
);
create index idx_notificaciones_estado on public.notificaciones (estado);

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
alter table public.notificacion_config enable row level security;
alter table public.notificaciones enable row level security;

-- Config: el admin gestiona todo; el arrendador ve el global + gestiona su override.
create policy notif_config_select on public.notificacion_config
  for select to authenticated
  using (public.is_admin() or scope = 'global' or arrendador_id = auth.uid());
create policy notif_config_admin_all on public.notificacion_config
  for all to authenticated
  using (public.is_admin()) with check (public.is_admin());
create policy notif_config_arrendador on public.notificacion_config
  for all to authenticated
  using (scope = 'arrendador' and arrendador_id = auth.uid())
  with check (scope = 'arrendador' and arrendador_id = auth.uid());

-- Notificaciones: admin todo; involucrados ven las de sus contratos.
create policy notificaciones_select on public.notificaciones
  for select to authenticated
  using (public.is_admin() or (contrato_id is not null and public.can_see_contrato(contrato_id)));

-- Config global por defecto (avisar 5, 3 y 1 dias antes; email on).
insert into public.notificacion_config (scope, dias_antes_corte, canal_email)
select 'global', '{5,3,1}', true
where not exists (select 1 from public.notificacion_config where scope = 'global');
