# Limitaciones conocidas

## AquaServicios (agua) — EN STAND-BY ⏸️
El portal `factura.aquaservicios.com` protege la consulta con **reCAPTCHA v2 checkbox**
(reto de imágenes). La automatización headless/headful **no lo supera** de forma confiable.
Probado: clic directo y perfil persistente "en frío" → Google igual pide el reto.

**Opciones para reactivarlo (cuando se decida):**
- **2captcha / anti-captcha** (pago, ~$1–3 por 1000): el solver devuelve el token, lo inyectamos
  en `#g-recaptcha-response` y enviamos. Sitekey: `6LeIoykbAAAAAPoEaUN867AUIUqV-LflnOfsIqUI`.
  Pendiente: `TWOCAPTCHA_API_KEY` en `.env` + implementación en el provider.
- **Contingencia manual** (gratis, recomendada por doc. §5.3): el admin/arrendador digita el valor
  cuando el bot no puede (la tabla `extracciones` ya soporta estado `manual`).
- **Humano en el loop** (gratis): el scraper headful pausa para que una persona resuelva el checkbox.
- **Perfil persistente + sesión de Google** (gratis, no garantizado): puede pasar sin reto si el
  perfil está "caliente"; en frío no funciona.

El provider [`apps/scraper/src/providers/aquaservicios.ts`](../apps/scraper/src/providers/aquaservicios.ts)
queda implementado pero lanza un error claro hasta que se elija una de las opciones.

**Nota:** Acuavalle (la otra comercializadora de agua) **sí funciona** gratis (reCAPTCHA invisible),
así que la categoría "agua" está cubierta para esa fuente.

## Wompi — pendiente de llaves
El gateway está implementado (Payment Links + verificación de firma del webhook). Falta:
1. **Llaves sandbox** (`WOMPI_PUBLIC_KEY`, `WOMPI_PRIVATE_KEY`, `WOMPI_EVENTS_SECRET`).
2. **Webhook**: como TanStack Start (v1.168) no expone server-routes, el webhook irá como
   **Supabase Edge Function** (`supabase/functions/wompi-webhook`) — desplegable a cloud.
   Para local sin túnel, se confirma el pago consultando la transacción por referencia.

Detalle en [WOMPI-INTEGRACION.md](WOMPI-INTEGRACION.md).
