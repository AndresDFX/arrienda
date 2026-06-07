# Módulo de notificaciones

Avisa a los involucrados antes de la fecha de corte (y en eventos clave). Es
**parametrizable por el admin** (config global) y **sobrescribible por el arrendador**.
El job de scraping corre **a diario** y, de paso, evalúa qué avisos enviar.

## Modelo de datos (migración `20260607000005_notificaciones.sql`)
- **`notificacion_config`**: una fila `scope='global'` (admin) + una por arrendador
  (`scope='arrendador'`, override). Campos: `dias_antes_corte int[]` (def. `{5,3,1}`),
  `canal_email`, `canal_whatsapp`, `activo`. RLS: admin gestiona el global; el arrendador
  ve el global y gestiona su override; default global sembrado por la migración.
- **`notificaciones`**: cola/log con `unique (contrato_id, tipo, periodo, dias_antes, canal)`
  para **deduplicar** (no avisar dos veces el mismo umbral/canal/periodo). Estados
  `pendiente|enviada|fallida`.

## Lógica (en `@arrienda/shared`, testeada)
`packages/shared/src/notificaciones.ts`:
- `proximoCorte(diaCorte, hoy)` / `diasHastaCorte(diaCorte, hoy)`.
- `umbralAviso(diaCorte, hoy, diasAntes[])` → el umbral que toca hoy, o `null`.
- `configEfectiva(global, override)` → combina override sobre global, campo a campo.
- `canalesActivos(cfg)`.

## Job diario (corre con el scraper)
Pseudocódigo de `apps/scraper/src/notify.ts` (a implementar — usa service role):
```
config_global = leer notificacion_config global
para cada contrato activo:
  cfg = configEfectiva(global, override_del_arrendador(contrato))
  if !cfg.activo: continuar
  n = umbralAviso(contrato.dia_corte, hoy, cfg.diasAntesCorte)
  if n == null: continuar
  para canal in canalesActivos(cfg):
    insert notificaciones (contrato, tipo='corte_proximo', periodo, dias_antes=n, canal, destinatario, 'pendiente')
      on conflict do nothing      -- dedupe
luego: despachar las 'pendiente' por su canal y marcar 'enviada'
```
Se engancha al **mismo disparo diario** del scraper (tarea programada de Windows /
Cloud Run / GitHub Actions). Tras extraer, llama al paso de notificaciones.

## Canales / envío
- **Email**: local vía **Mailpit** (SMTP `localhost:1025`, UI `:8025`); prod vía Resend/SMTP.
- **WhatsApp**: Fase posterior (WhatsApp Cloud API / Twilio).
- El despacho lee `notificaciones` en estado `pendiente`, envía y marca `enviada`/`fallida`.

## Otros tipos (mismo mecanismo)
`liquidacion_emitida` (al generar), `pago_confirmado` (webhook), `extraccion_fallida`
(alerta al admin/arrendador cuando el scraper falla — doc. §5.3).

## Estado
- [x] **`apps/scraper/src/notify.ts`** — cálculo + inserción (dedupe) + **despacho por email (Mailpit)**.
  Probado end-to-end: `notify 2026-06-30` → correo en Mailpit, fila `estado='enviada'`.
  Correr: `node --env-file=.env --experimental-strip-types apps/scraper/src/notify.ts [--fecha YYYY-MM-DD] [--dry]`
  (`--fecha` simula "hoy"; `--dry` calcula sin enviar). Ya está enganchado al **run diario**
  del scraper (`scripts/run-scraper.ps1`: scrape → notify).
- [ ] UI: panel admin (config global) y arrendador (override) sobre `notificacion_config`.
- [ ] Disparar `liquidacion_emitida` y `pago_confirmado` desde las server functions.
- [ ] Resend (prod) + WhatsApp (Cloud API).
