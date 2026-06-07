# Plan de integración de Wompi (sandbox) — probar con los datos actuales

Objetivo: reemplazar el `MockGateway` por **Wompi** en modo sandbox y cobrar una
liquidación real generada por la app (canon + servicios extraídos), validando el
flujo recaudo → webhook → estado `pagada`. Reusa el puerto `PaymentGateway` que ya existe.

## 0. Qué ya está listo (no se reescribe)
- Puerto [`PaymentGateway`](../apps/web/src/server/payments/gateway.ts): `crearRecaudo()` + `verificarWebhook()`.
- [`MockGateway`](../apps/web/src/server/payments/mock.ts) (Fase 0) y el stub [`WompiGateway`](../apps/web/src/server/payments/wompi.ts) a completar.
- Factory por `PAYMENTS_PROVIDER` ([index.ts](../apps/web/src/server/payments/index.ts)).
- La server fn [`generarLiquidacion`](../apps/web/src/server/liquidacion.ts) ya llama `gateway.crearRecaudo(...)` y guarda la `transaccion` con `pasarela_ref`. Solo cambia la implementación detrás del puerto.

## 1. Conceptos Wompi relevantes
- **Llaves (sandbox):** `pub_test_*` (pública) y `prv_test_*` (privada). Base URL `https://sandbox.wompi.co/v1`.
- **Acceptance token:** `GET /merchants/{pub_key}` devuelve `presigned_acceptance.acceptance_token` (aceptación de términos), requerido al crear transacciones.
- **Payment Links** (lo que usaremos): `POST /payment_links` (con llave privada) → devuelve un `id` y una URL de checkout (`https://checkout.wompi.co/l/{id}`). Encaja con nuestro `checkoutUrl`. El cliente paga ahí con **PSE/tarjeta**.
- **Firma de integridad:** para transacciones directas, `SHA256(referencia + monto_en_centavos + moneda + integrity_secret)`. Para Payment Links no es obligatoria, pero el **webhook** sí trae checksum.
- **Webhook (eventos):** Wompi hace `POST` a una URL configurada con el evento `transaction.updated`. Se valida con el **events secret** comparando `signature.checksum` = `SHA256(props_concatenadas + timestamp + events_secret)`.
- **Montos:** en **centavos** (`amount_in_cents`). Nuestros montos son pesos enteros → `× 100`.

## 2. Variables de entorno (sandbox)
Añadir a `.env` / `.dev.vars` (y como secrets del Worker en prod):
```
PAYMENTS_PROVIDER="wompi"
WOMPI_BASE_URL="https://sandbox.wompi.co/v1"
WOMPI_PUBLIC_KEY="pub_test_xxx"
WOMPI_PRIVATE_KEY="prv_test_xxx"
WOMPI_INTEGRITY_SECRET="test_integrity_xxx"
WOMPI_EVENTS_SECRET="test_events_xxx"
```
(Se obtienen en el dashboard de comercios de Wompi en modo prueba.)

## 3. Implementación (detrás del puerto, sin tocar la lógica de negocio)
En [`apps/web/src/server/payments/wompi.ts`](../apps/web/src/server/payments/wompi.ts):

**`crearRecaudo(input)`** — crear un Payment Link:
1. `POST {WOMPI_BASE_URL}/payment_links` con `Authorization: Bearer {WOMPI_PRIVATE_KEY}` y cuerpo:
   ```jsonc
   {
     "name": "Arriendo <periodo>",
     "description": input.descripcion,
     "single_use": true,
     "currency": "COP",
     "amount_in_cents": input.monto * 100,
     "redirect_url": "<APP_BASE_URL>/arrendatario",
     "reference": input.referencia      // = `${contratoId}-${periodo}` (idempotente)
   }
   ```
2. Devolver `{ pasarelaRef: data.id, checkoutUrl: "https://checkout.wompi.co/l/"+data.id, estado: 'pendiente' }`.

**`verificarWebhook(rawBody, headers)`** — validar y normalizar el evento:
1. Parsear el body; tomar `event`, `data.transaction` (`id`, `status`, `reference`, `amount_in_cents`), `signature.checksum`, `timestamp`.
2. Recalcular el checksum: concatenar los valores de `signature.properties` (en orden) + `timestamp` + `WOMPI_EVENTS_SECRET`, `SHA256`, comparar con `signature.checksum`. Si no coincide → throw (rechazar).
3. Mapear `status`: `APPROVED → 'aprobada'`, `DECLINED/ERROR → 'rechazada'`, `VOIDED → 'reversada'`.
4. Devolver `{ pasarelaRef: transaction.id, estado, liquidacionId }` (la `liquidacionId` se resuelve por la `reference` o por `pasarela_ref` en la tabla `transacciones`).

> Crypto en Workers: usar `crypto.subtle.digest('SHA-256', ...)` (Web Crypto, disponible en Cloudflare Workers) — no `node:crypto`.

## 4. Endpoint de webhook
Wompi necesita una URL pública que reciba `transaction.updated`. Opciones:
- **Server route de TanStack Start**: `apps/web/src/routes/api/wompi/webhook.ts` (POST) → `getPaymentGateway().verificarWebhook(rawBody, headers)` → con `service role` marca `transacciones.estado` y `liquidaciones.estado='pagada'` (misma lógica que `confirmarPagoMock`).
- Configurar esa URL (`https://<worker>/api/wompi/webhook`) en el dashboard de Wompi (eventos).
- **Local:** exponer con un túnel (cloudflared/ngrok) hacia `localhost:3000` para recibir el webhook del sandbox.

> Refactor sugerido: extraer la lógica de "confirmar pago" (hoy en [`confirmarPagoMock`](../apps/web/src/server/pagos.ts)) a una función `aplicarPago(pasarelaRef, estado)` reutilizada por el mock y por el webhook de Wompi.

## 5. Dispersión multi-destino (⚠️ Fase 2)
Wompi **no** dispersa nativamente a varias cuentas (arrendador + recaudadores) en el API básico; requiere convenio de dispersión/marketplace (doc. §2.3/§2.4). Para esta prueba: el recaudo entra a **una** cuenta de comercio (la plataforma) y la dispersión se modela en `liquidacion_items` (ya lo hacemos) pero se ejecuta manual/Fase 2. Dejar `crearRecaudo` cobrando el total; documentar la dispersión como pendiente.

## 6. Probar con los datos ACTUALES
1. `PAYMENTS_PROVIDER=wompi` + llaves sandbox en `.dev.vars`; reiniciar la web.
2. Como **arrendador** → generar liquidación de un contrato (canon + gas $17.556 si la propiedad tiene el servicio) → `generarLiquidacion` llama a `WompiGateway.crearRecaudo` → guarda `transaccion (pasarela='wompi', pasarela_ref=<link id>)` y devuelve `checkoutUrl` de Wompi.
3. Como **arrendatario** → "Pagar" abre el `checkoutUrl` de Wompi sandbox.
4. Pagar con **tarjeta de prueba** Wompi: `4242 4242 4242 4242`, cualquier fecha futura, CVV `123`, o PSE sandbox (banco de prueba → aprobar).
5. Wompi dispara `transaction.updated (APPROVED)` → nuestro webhook valida el checksum → marca la liquidación `pagada`.
6. Verificar en Studio: `transacciones.estado='aprobada'`, `liquidaciones.estado='pagada'`.

## 7. Checklist de implementación
- [ ] Crear comercio sandbox en Wompi y copiar las 4 llaves.
- [ ] Implementar `WompiGateway.crearRecaudo` (Payment Links) y `verificarWebhook` (checksum con Web Crypto).
- [ ] Server route `api/wompi/webhook` + `aplicarPago()` compartida.
- [ ] Configurar URL de eventos en Wompi (túnel en local).
- [ ] `amount_in_cents` (×100) y `reference` idempotente.
- [ ] E2E con tarjeta de prueba → estado `pagada`.
- [ ] (Fase 2) Dispersión multi-destino vía convenio.
