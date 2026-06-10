# Pasarelas de pago en Colombia — opciones para el MVP

Contexto: **Wompi exige la página en producción** para habilitar las llaves de producción (la
*vinculación/activación* revisa un comercio real y una URL viva). Eso choca con nuestro estado
actual (no subimos la BD a Supabase cloud todavía → no hay sitio en prod). Este documento revisa
alternativas viables para un MVP en Colombia. Tarifas aproximadas (jun 2026, **sin IVA salvo nota**;
verificar al contratar — cambian seguido).

## Lo importante primero (el bloqueo de Wompi)
- **Para integrar NO necesitas producción**: Wompi entrega **llaves de *sandbox* gratis al instante**
  en `comercios.wompi.co`. Ya tenemos el adapter sandbox listo (`infrastructure/payments/wompi.ts`).
- **Para cobrar dinero real** sí piden activación: RUT + cuenta bancaria (persona natural o jurídica;
  jurídica además cámara de comercio) + **revisión de ~2–3 días de un comercio/URL en vivo**. Ese es el
  "ya esté en prod".
- Hay dos caminos: **(A)** satisfacer a Wompi con un sitio mínimo en prod, o **(B)** usar una pasarela
  con onboarding más liviano para arrancar el MVP ya.

## Comparativa
| Pasarela | Comisión aprox. | Mensualidad | Medios | Onboarding | Sandbox | Notas para MVP |
| --- | --- | --- | --- | --- | --- | --- |
| **Wompi** (Bancolombia) | **2.65% + $700** | No | PSE, tarjetas, **Nequi, Daviplata** | Persona natural/jurídica; activación 2–3 días + URL en vivo | **Llaves al instante** | La más barata + confianza Bancolombia. Bloqueo actual = activación de prod. |
| **Mercado Pago** | 2.99% + IVA (inmediato 3.29% + $800) | No | PSE, tarjetas, Efecty, wallet | Persona natural/jurídica; **credenciales de prueba al instante** | Sí (test users) | **Split/marketplace nativo** (encaja con la dispersión). Salida a prod ágil. Gran fit MVP. |
| **ePayco** | ~3% + comisión fija | No | PSE, tarjetas, **Nequi, Daviplata**, Puntos Colombia | Persona natural; **vinculación ≤24h** | Sí (`test:true`) | Onboarding más liviano y soporte local. Muy usado por MVPs/pymes en Colombia. |
| **PayU** | ~3.19% | No | PSE, tarjetas, Efecty, Baloto | Persona natural/jurídica; más trámite | Sí (montos ≥1 USD) | Más "enterprise"/pesado. Mejor a escala que para arrancar. |
| PayZen | $400/tx | **$99.000/mes** | PSE, tarjetas, Nequi | jurídica | Sí | Mensualidad fija: no ideal para MVP de bajo volumen. |
| PayPal / Stripe | — | — | internacional, **sin PSE** | — | — | **Descartar**: no resuelven recaudo local Colombia (PSE/Nequi). Stripe no habilita comercios CO. |

## Recomendación para ARRIENDA+
1. **Seguir desarrollando sobre el sandbox de Wompi** (ya integrado): es lo más barato y con respaldo
   Bancolombia; integrar no requiere prod. Cuando quieras cobrar real, completas la activación.
2. **Para salir a producción pronto con mínima fricción → Mercado Pago.** Da credenciales de prueba al
   instante, su paso a producción es ágil y su **split de pagos (marketplace)** modela bien la
   dispersión canon↔plataforma. Comisión un poco mayor que Wompi, a cambio de desbloquear ya.
3. **Alternativa local liviana → ePayco** (vinculación ≤24h como persona natural, Nequi/Daviplata).

> **Sobre la dispersión multi-destino** (canon al arrendador + N comercializadoras): ninguna pasarela CO
> hace split arbitrario a N destinos de forma nativa para un MVP. MP/otros hacen split a **2 partes**
> (marketplace + vendedor), suficiente para "canon→arrendador, comisión→plataforma". El reparto a cada
> comercializadora sigue siendo **Fase 2** (convenios / pago referenciado), independiente de la pasarela.

## Ventaja de nuestra arquitectura
Gracias al puerto `PaymentGateway` (`application/ports/payment-gateway.ts`) + el factory
(`infrastructure/payments/factory.ts`), **cambiar o añadir pasarela = un adapter nuevo** en
`infrastructure/payments/` + un caso en el factory (`PAYMENTS_PROVIDER`). No toca casos de uso ni UI.
Plan: añadir `mercadopago.ts` (o `epayco.ts`) junto a `mock.ts`/`wompi.ts` cuando elijas proveedor.

## Cómo desbloquear Wompi sin subir la BD (opción A)
Wompi revisa un **sitio en vivo** (no la BD). Se podría publicar solo el **landing + páginas legales**
(términos/privacidad) en Cloudflare como "comercio en prod" para pasar la revisión, manteniendo la BD
local. Camino válido pero con incertidumbre (su revisión puede pedir el flujo de pago real). Mientras
tanto, el MVP avanza con Mercado Pago/ePayco.

## Fuentes
- [Wompi — Ambientes y llaves](https://docs.wompi.co/en/docs/colombia/ambientes-y-llaves/) ·
  [Wompi — proceso de vinculación](https://soporte.wompi.co/hc/es-419/articles/360020955173)
- [Mercado Pago — Split de pagos](https://www.mercadopago.com.co/developers/es/docs/split-payments/landing) ·
  [costos del Checkout](https://www.mercadopago.com.co/ayuda/costos-recibir-pagos-checkout_33399)
- [ePayco — transacciones de prueba](https://docs.epayco.com/docs/transacciones-de-prueba) ·
  [ePayco — medios de pago](https://epayco.com/)
- [PayU — probar tu solución](https://developers.payulatam.com/latam/es/docs/getting-started/test-your-solution.html)
- [Comparativa pasarelas Colombia 2025 (togrow)](https://togrowagencia.com/pasarelas-de-pago-en-colombia/)
