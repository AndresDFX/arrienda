-- ============================================================================
-- ARRIENDA+ — Datos semilla de desarrollo
-- Se aplican con `supabase db reset`. Solo catalogos (datos del admin), no
-- usuarios: los usuarios se crean via Supabase Auth (Studio o signUp).
-- ============================================================================

insert into public.recaudadores (id, nombre, cuenta_bancaria) values
  ('22222222-2222-2222-2222-222222222222', 'Celsia (energia)', 'CTA-ENERGIA-001'),
  ('33333333-3333-3333-3333-333333333333', 'Acuavalle (acueducto)', 'CTA-AGUA-001'),
  ('44444444-4444-4444-4444-444444444444', 'Gases de Occidente', 'CTA-GAS-001')
on conflict (id) do nothing;

-- provider_key: vincula con el proveedor del scraper (apps/scraper/src/providers).
-- requiere_credenciales: true para portales autenticados (piden usuario+contraseña).
insert into public.comercializadoras (nombre, tipo, portal_url, recaudador_id, provider_key, requiere_credenciales) values
  ('Celsia', 'energia', 'https://clientes.celsia.com', '22222222-2222-2222-2222-222222222222', 'celsia', true),
  ('Gases de Occidente', 'gas', 'https://portalrecaudos.gdo.com.co/pagorecaudo.aspx', '44444444-4444-4444-4444-444444444444', 'gases-de-occidente', false),
  ('Acuavalle', 'agua', 'https://wompi.acuavalle.gov.co', '33333333-3333-3333-3333-333333333333', 'acuavalle', false),
  ('AquaServicios', 'agua', 'https://factura.aquaservicios.com', null, 'aquaservicios', false)
on conflict do nothing;

-- Sugerencia para crear usuarios de prueba (ejecutar en Studio tras crearlos en Auth):
--   update public.profiles set rol = 'admin', nombre = 'Admin Demo' where id = '<uuid-del-usuario>';
