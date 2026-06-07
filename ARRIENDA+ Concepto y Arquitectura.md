# **ARRIENDA+**

**Plataforma de gestión y recaudo de arriendos con servicios públicos**

*Documento de Concepto y Arquitectura*

Tres roles · Recaudo automático puro (Web Scraping) · Modelo de comisión sobre canon

Versión 2.0 — Borrador de producto

Mercado objetivo: Colombia (Valle del Cauca y región)

## **1\. Resumen ejecutivo**

ARRIENDA+ es una plataforma que conecta a arrendadores y arrendatarios bajo la supervisión de un administrador, automatizando el cobro mensual del arriendo y, opcionalmente, de los servicios públicos asociados al inmueble (energía, agua y gas). El arrendador decide, por cada propiedad, entre dos modalidades de cobro: cobro completo (canon más servicios consolidados) o cobro sin servicios (solo el canon).

Bajo la modalidad de cobro completo, la plataforma ofrece una experiencia "cero toques" (zero-touch) para el arrendatario: no necesita reenviar facturas ni conectar correos. El sistema captura los valores automáticamente desde los portales de las empresas de servicios.

El modelo de ingresos de la plataforma es una comisión del 5% aplicada únicamente sobre el canon de arriendo. Los servicios públicos se tratan como un valor de paso (*pass-through*): se recaudan y se trasladan al recaudador correspondiente sin margen, de modo que el arrendatario no paga sobreprecio por sus recibos y la propuesta de valor se mantiene competitiva.

**Decisiones de diseño confirmadas:**

* La comisión del 5% se cobra solo sobre el canon, no sobre los servicios públicos.  
* El objetivo es un flujo automático de extremo a extremo desde la perspectiva del usuario (basado en extracción automatizada de datos).  
* El entregable de esta fase es el concepto y la arquitectura (este documento).

## **2\. Viabilidad técnica: lo que es posible y lo que no**

Esta sección define el núcleo tecnológico de la plataforma para lograr la captura automática de valores sin depender de integraciones oficiales que no existen en el mercado actual.

### **2.1. Las comercializadoras de servicios no exponen APIs públicas**

Empresas como Gases de Occidente, Celsia o Emcali no ofrecen interfaces de programación (APIs) públicas para que terceros consulten facturas o ejecuten pagos en nombre de un cliente de forma automatizada. Sus canales se limitan a portales web de consulta para usuarios humanos.

### **2.2. El habilitador técnico: Web Scraping y RPA**

Dado que no existe un contrato técnico formal, la plataforma utilizará técnicas de Web Scraping y Automatización Robótica de Procesos (RPA).

El arrendador, al configurar la propiedad por primera vez, registra los números de contrato (NIC, NIS o código de suscriptor) de energía, agua y gas. Mensualmente, un motor de extracción (compuesto por navegadores *headless*) navegará automáticamente los portales públicos de las comercializadoras, simulará la consulta humana, leerá el HTML de los resultados, y extraerá el valor exacto adeudado, la fecha límite y el código de pago referenciado.

### **2.3. El pago: recaudo y dispersión mediante pasarela**

El pago de la factura del servicio público se ejecuta mediante el código de barras o código de referencia de recaudo extraído por los robots, utilizando convenios bancarios (PSE y corresponsales). Las pasarelas de pago colombianas (como Wompi) permiten recaudar el consolidado del arrendatario y dispersar a múltiples destinos (arrendador, plataforma y empresas de servicios) de forma casi inmediata.

**Implicación regulatoria transversal:**

Las pasarelas de pago operan bajo un modelo de mandato: reciben el dinero por cuenta y riesgo del comercio para entregarlo según instrucciones. La plataforma NO debe retener ni "guardar" el dinero de los arrendatarios en cuentas propias, ya que constituiría captación ilegal. ARRIENDA+ opera como orquestador tecnológico.

### **2.4. Tres niveles de automatización**

| Nivel | Qué hace | Viabilidad | Recomendación |
| :---- | :---- | :---- | :---- |
| **1 — Lectura por Scraping** | Robots navegan en los portales de las comercializadoras para extraer valores y fechas usando los NIC/NIS configurados. | Media (Frágil ante cambios de UI y bloqueos de IP). | Base del MVP |
| **2 — Pago referenciado** | La plataforma paga la factura usando el código de recaudo extraído vía convenios bancarios en la pasarela. | Media (Requiere convenio avanzado con pasarela). | Incluir en fase 2 |

**Conclusión:** El flujo completo es automático para el usuario final, pero concentra la carga operativa en el mantenimiento continuo del clúster de Scraping en el backend.

## **3\. Roles del sistema**

La plataforma define tres roles con responsabilidades claramente separadas. Al usar Web Scraping, la carga de configuración inicial recae en el arrendador, liberando al arrendatario de cualquier tarea que no sea pagar.

### **3.1. Administrador**

* Crea y administra las entidades base: comercializadoras de servicios, recaudadores y catálogos.  
* Da de alta y verifica las cuentas de arrendadores.  
* Supervisa transacciones y monitorea alertas del motor de Scraping (fallos de extracción).  
* Configura los parámetros de negocio (comisiones, calendarios).

### **3.2. Arrendador (propietario)**

* Registra propiedades y elige la modalidad de cobro (completo o sin servicios).  
* **Registra los números de contrato (NIC/NIS)** de los servicios públicos de cada inmueble para habilitar la extracción automática.  
* Registra su cuenta bancaria para recibir las dispersiones del canon.  
* Consulta el estado de pagos y recaudos.

### **3.3. Arrendatario (inquilino)**

* Recibe la liquidación mensual consolidada (canon y servicios) con fecha límite.  
* Paga en un solo flujo (PSE, tarjeta) a través del enlace de la plataforma.  
* Consulta su historial de pagos y descarga comprobantes. *(La experiencia es pasiva hasta el momento del pago).*

### **3.4. Matriz de permisos (resumen)**

| Acción | Admin | Arrendador | Arrendatario |
| :---- | :---- | :---- | :---- |
| Crear entidades maestras | Sí | No | No |
| Registra propiedades | Sí | Sí | No |
| Elegir modalidad de cobro | No\* | Sí | No |
| **Registrar códigos de servicio (NIC/NIS)** | No | **Sí** | No |
| Ejecutar / autorizar pago | No | No | Sí |
| Recibir dispersión del canon | No | Sí | No |

*\* El admin puede intervenir por soporte.*

## **4\. Modalidades de cobro y modelo económico**

### **4.1. Modalidad A — Cobro completo**

La liquidación mensual del arrendatario incluye el canon más los recibos de servicios. La plataforma captura el valor de cada servicio mediante los bots de extracción, lo suma al canon y emite una sola liquidación.

### **4.2. Modalidad B — Cobro sin servicios**

La liquidación incluye únicamente el canon de arriendo. Los servicios públicos quedan por fuera del sistema.

### **4.3. Cómo se calcula y reparte el dinero (Ejemplo modalidad completa)**

| Concepto | Valor | Destino |
| :---- | :---- | :---- |
| Canon de arriendo | $1.500.000 | Arrendador |
| Comisión plataforma (5% del canon) | $75.000 | ARRIENDA+ |
| Energía (Celsia) | $180.000 | Recaudador energía |
| Agua (Acueducto) | $95.000 | Recaudador agua |
| Gas (Gases de Occidente) | $48.000 | Recaudador gas |
| **TOTAL que paga el arrendatario** | **$1.823.000** | — |

El arrendatario paga $1.823.000. La dispersión en la pasarela reparte: $1.425.000 al arrendador (canon menos comisión), $75.000 a la plataforma, y $323.000 a los tres recaudadores. **El inquilino paga sus servicios sin recargos ocultos.**

### **4.4. Costos transaccionales**

La pasarela cobra una tarifa por transacción. Dado que el recaudo de servicios no tiene margen, se debe definir si este costo lo absorbe el arrendador (descontándolo del canon), la plataforma (reduciendo su 5%), o si se añade un fee fijo transparente por uso de plataforma al arrendatario.

## **5\. Arquitectura de la solución**

### **5.1. Componentes principales**

| Componente | Responsabilidad |
| :---- | :---- |
| **Aplicación web / móvil** | Interfaces de usuario por rol (Dashboard). |
| **Motor de Web Scraping (RPA)** | Clúster de navegadores *headless* (ej. Puppeteer/Playwright) con rotación de IPs/Proxies para evadir bloqueos y extraer datos del DOM de las comercializadoras. |
| **API / Backend** | Lógica central, orquestador del cronograma de cobros y conciliación. |
| **Integración de pagos** | Pasarela para recaudo y dispersión (API de terceros). |
| **Base de datos** | Usuarios, propiedades, NIC/NIS, liquidaciones y auditoría. |
| **Programador de tareas (Cron)** | Desencadena los bots de scraping en las fechas de corte correspondientes a cada servicio. |

### **5.2. Flujo mensual de cobro completo**

1. El **Programador de tareas** identifica que es fecha de corte para una propiedad.  
2. El **Motor de Scraping** inicia sesión o consulta el portal público de la comercializadora usando el NIC/NIS guardado.  
3. El bot extrae el valor adeudado, fecha límite y número de referencia para pago.  
4. El backend consolida los valores extraídos con el canon de arriendo.  
5. Se genera y envía la liquidación al arrendatario vía correo/WhatsApp.  
6. El arrendatario paga el total mediante la pasarela integrada.  
7. La pasarela ejecuta la dispersión automática de los fondos.

### **5.3. Punto de dependencia frágil (Riesgo principal)**

El motor de scraping es el eslabón más inestable de la arquitectura. Si una comercializadora:

* Cambia la estructura visual (HTML/CSS) de su portal.  
* Implementa CAPTCHAs agresivos (ej. Cloudflare Turnstile).  
* Bloquea el rango de IPs del servidor de la plataforma (AWS/GCP).  
  ...la captura fallará.  
  **Mitigación técnica:** Implementar sistema de alertas inmediatas por fallo de selectores, usar un proveedor de proxies residenciales robusto, y tener una interfaz de "contingencia manual" para que el administrador o arrendador pueda digitar el valor si el bot está caído por mantenimiento.

## **6\. Entidades de datos (Modelo conceptual)**

| Entidad | Atributos clave | Relaciones |
| :---- | :---- | :---- |
| Usuario | id, rol, contacto, cuenta\_bancaria | Tiene un rol (admin, arrendador, arrendatario) |
| Propiedad | id, dirección, modalidad\_cobro | Pertenece a un arrendador |
| Contrato Arriendo | id, fechas, canon, inquilino\_id | Une propiedad y arrendatario |
| Servicio Público | id, tipo (gas/agua), **NIC\_NIS** | Asociado a una propiedad |
| Extracción (Log) | id, periodo, valor\_extraido, ref\_pago | Generada por bot, pertenece a un Servicio |
| Liquidación | id, periodo, total, estado | Agrupa canon y extracciones del mes |
| Transacción | id, monto, estado, pasarela\_id | Asociada a una liquidación |

## **7\. Hoja de ruta sugerida**

**Fase 0 — Validación base (Core Financiero)**

* Registro de propiedades, contratos y liquidación únicamente del canon.  
* Recaudo vía pasarela y dispersión al arrendador (validación del 5%).  
* *Objetivo:* Probar adopción del sistema de pagos y onboarding.

**Fase 1 — Motor de Scraping (MVP Servicios)**

* Desarrollo de los scripts de extracción para las 2 o 3 comercializadoras principales de la región (ej. Gases de Occidente, Emcali).  
* Generación de liquidaciones consolidadas usando los valores extraídos.

**Fase 2 — Pago referenciado automático**

* Integración de los códigos de referencia extraídos con los convenios bancarios de la pasarela para ejecutar el pago automático a la comercializadora tras el recaudo.

**Fase 3 — Resiliencia y Escala**

* Implementación de rotación de proxies residenciales y resolución automática de CAPTCHAs.  
* Manejo de mora, reintentos de extracción y conciliaciones contables avanzadas.

## **8\. Consideraciones legales y de cumplimiento**

Antes de operar comercialmente, se deben validar estos puntos con asesoría legal especializada en tecnología:

1. **Riesgo de Scraping y Términos de Uso:** El uso de bots para extraer información suele violar los términos y condiciones de las páginas web de las comercializadoras. Aunque la información consultada (una factura) pertenece indirectamente al usuario, la comercializadora podría aplicar bloqueos tecnológicos (baneo de IPs) o, en casos extremos, enviar requerimientos de cese (*Cease and Desist*) por sobrecarga de servidores.  
2. **No Captación Financiera:** El recaudo y la dispersión deben ocurrir estrictamente bajo el modelo de mandato de la pasarela de pagos. La plataforma debe ser solo una instrucción tecnológica de enrutamiento de dinero.  
3. **Tratamiento de Datos:** Política de privacidad robusta y consentimiento explícito del arrendador para que la plataforma actúe como un robot en su nombre para consultar los portales públicos.  
4. **Naturaleza Contractual:** Aclarar en los Términos de Servicio de la plataforma que ARRIENDA+ es un facilitador de pagos y no asume responsabilidad solidaria por la falta de pago de arriendos o cortes de servicios por parte del inquilino.