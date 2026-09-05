# Requerimientos: modulos Pricing, Customer Service y Operaciones

> **HISTORICO (incorporado a CLAUDE.md el 2026-09-02).** Todo lo de este documento ya vive en
> CLAUDE.md: la cascada de 7 gates (seccion 2), Pricing / tipo de tarifa (4.5), Operaciones /
> notificaciones (4.6), y el modelo de datos nuevo — `RoutingOrder`, `NotificacionEnviada`,
> valorizacion, `Factura` PROFORMA/FINAL, emision DRAFT/FINAL, expediente fisico,
> revalidacion / BL endosado (secciones 5.x). Se conserva por el Anexo (dictado original de
> Customer Service). El diseño completo esta en
> `docs/superpowers/specs/2026-09-02-pricing-customer-operaciones-design.md`.
>
> **Dudas del Anexo resueltas con criterio (marcadas en su momento):**
> - Routing Order anclado a `Cotizacion` (1:1), no a `Booking` (se pide antes del Booking).
> - Gate 3 relajable con `Cliente.requiereRoutingOrder = false`.
> - PROFORMA salta el gate de "shipment cerrado"; usa serie propia `MGC-PROF-`.
> - Valorizacion = campos dedicados en `Shipment` (venta/compra reales + flag + fecha).
> - Cierre de carpeta: advertencia de divergencia de margen, sin bloqueo (Anexo: "no
>   necesariamente un bloqueo duro").
> - Politica "10 dias antes / 5 dias despues del zarpe" por cliente: NO se persiste; el log de
>   notificaciones registra el envio y el *cuando* sigue siendo alerta derivada en Operaciones.

## Contexto

Este documento traduce una explicacion operativa dictada por una persona de Customer Service
de Monsa Global Cargo (transcrita sin editar en el Anexo, al final de este archivo) en
requerimientos concretos para el sistema. **Lee primero CLAUDE.md completo** -- este documento
EXTIENDE la cascada y el modelo de datos ya documentados ahi, no los reemplaza.

La explicacion original describe pasos operativos reales que **hoy no existen en el sistema**:
un Routing Order/instrucciones antes del Booking, notificaciones estructuradas al cliente,
una "valorizacion" antes de facturar, y un flujo de despacho/revalidacion en Operaciones. No
son solo nombres de modulos nuevos -- son entidades y estados que faltan en el schema.

**Importante**: la interpretacion de abajo es mi lectura del dictado original. Donde haya
ambiguedad, prioriza el Anexo (texto original) sobre mi resumen, y si algo sigue sin quedar
claro, señala la duda explicitamente en tu respuesta en vez de asumir.

---

## 1. El flujo operativo real, extendido

La cascada actual en CLAUDE.md es:

```
Cliente/Proveedor activos -> Cotizacion -> Booking -> Shipment -> Finanzas
```

Segun esta explicacion, entre Cotizacion y Booking falta un paso, y despues de Shipment el
seguimiento tiene sub-etapas que hoy no se modelan. El flujo completo, tal como opera hoy
Monsa, es:

```
1. Pricing sube tarifas (por naviera, vigencia, tipo de tarifa) al sistema
2. Vendedor cotiza usando esas tarifas -> Cotizacion
3. Cliente acepta -> Cotizacion.status = ACEPTADA
4. Vendedor (o Customer Service) solicita al cliente el "Routing Order" / instrucciones
   -> NUEVO: no existe hoy como entidad
5. Vendedor indica a Customer Service con que agente hacer la reservacion
6. Customer Service envia instrucciones al agente
7. Agente reserva con la naviera -> Booking (vessel, naviera, ETD estimada)
   -> Booking.status = CONFIRMADO (gate ya existente)
8. Customer Service recibe documentos preliminares (House BL / Master BL Draft) y los sube
   -> ya existe Documento, pero falta distinguir borrador vs final
9. Nace el Shipment (folio) -- gate ya existente, sin cambios
10. Seguimiento (Customer Service + Operaciones, unificado en el sistema):
    - Se sube volumen, peso, contenedor, numero de master
    - Se da seguimiento a actualizaciones de fecha de arribo
    - Se solicita "valorizacion" a ventas (costo y venta reales) -> NUEVO, no existe hoy
    - Se notifica al cliente en fechas clave: cutoff documental, cutoff de contenedor, ETD,
      ETA -> NUEVO: hoy solo hay un booleano "avisoLlegadaEnviado", no un log de notificaciones
    - Aviso de arribo: minimo 10 dias antes del arribo (o 5 dias despues del zarpe segun el
      caso, u otras reglas especiales por cliente)
    - Se solicita factura (proforma o final) -> NUEVO: Factura no distingue proforma de final
11. Operaciones:
    - Ingresa datos del agente aduanal y la naviera para el despacho -> ya cubierto por
      ShipmentProveedor (ver CLAUDE.md seccion 5), sin cambios
    - Revisa y solicita pagos a la naviera -> ya cubierto por CuentaPorPagar, falta uso activo
    - Revalida ante la naviera y envia el BL endosado al cliente -> NUEVO: no hay campo para
      tracking de revalidacion ni de envio de BL endosado
    - Dar seguimiento al despacho aduanal y entrega a bodega -> parcialmente cubierto por
      Shipment.status y fechas existentes, falta el detalle de revalidacion
    - Corte / cierre de contenedor: vacios, demoras, cargos extra -> ya cubierto por
      CostoDemora y Shipment.fechaEntregaVacio, sin cambios estructurales
12. Cierre de carpeta: se revisa que los costos reales coincidan con lo cotizado/valorizado
    -> parcialmente cubierto por Shipment.profitReal vs Cotizacion.montoVenta/montoCompra,
    falta la validacion/checklist formal antes de permitir cerrar el shipment
```

---

## 2. Modulo Pricing (nuevo)

**Responsabilidad**: negociar y mantener actualizadas las tarifas con navieras, aerolineas y
transportistas. Es quien alimenta de tarifas vigentes a Ventas -- sin esto, Cotizaciones no
tiene datos reales con que cotizar.

El modelo `Tarifa` ya existe en el schema (ligado a `Proveedor`, con origen/destino/modalidad/
montoCompra/vigenteDesde/vigenteHasta) y cubre buena parte de esto, pero le falta:

- **Tipo de tarifa**: contrato (fija por vigencia), spot (cotizacion puntual), o "basket"
  (por producto o por volumen -- tarifas escalonadas). Agregar un enum `TipoTarifa` y el campo
  correspondiente en `Tarifa`.
- **Modulo dedicado en el frontend** para que Pricing suba, edite y de baja tarifas por
  naviera/vigencia, en vez de que esto viva escondido dentro de la pantalla de Proveedores.
  Puede ser una pestaña dentro de Proveedores o un modulo propio en el Sidebar -- decide segun
  lo que se sienta mas natural con el resto de la navegacion ya construida.
- Vista para Ventas que, al cotizar, muestre solo tarifas vigentes (vigenteDesde <= hoy <=
  vigenteHasta) y resalte cuando una tarifa esta por vencer.

---

## 3. Routing Order / Instrucciones (nueva entidad)

Cuando el cliente acepta la cotizacion, Customer Service (o el vendedor) solicita al cliente
las instrucciones formales de embarque, llamadas "Routing Order". Esto **no existe hoy** en el
schema y debe crearse como una entidad propia, relacionada 1:1 con la `Cotizacion` aceptada
(o con el futuro `Booking` -- decide cual referencia tiene mas sentido dado que el Routing
Order se pide ANTES de que exista el Booking, pero contiene datos que el Booking necesita).

Campos minimos, segun el dictado original:

- Datos del shipper (puede reusar los mismos campos que ya existen en Shipment.shipperNombre,
  o promoverlos a esta entidad si tiene mas sentido capturarlos aqui primero)
- Datos del consignee (relacion a Cliente, ya existe)
- POL (puerto de carga)
- POD (puerto de destino)
- **Destino final y tipo de servicio de entrega** -- esto es una decision de negocio real con
  varias opciones, modelalas como un enum:
  - `CY_PUERTO` -- el destino final es el mismo puerto (ej. Manzanillo, Veracruz)
  - `DENTRO_BL_RAIL` -- entrega a bodega via tren, dentro del BL (contratado con la naviera)
  - `DENTRO_BL_TRUCK` -- entrega a bodega via camion, dentro del BL (contratado con la naviera)
  - `FUERA_BL_CAMION` -- entrega via camion contratado por fuera del BL, no por la naviera
  - `RAM` -- servicio hasta aduana interna (ej. Pantaco); ahi termina el servicio de Monsa y
    el cliente ingresa su propio transporte
- Especificaciones especiales (texto libre)
- Agente designado para hacer la reservacion (FK a Proveedor, tipo AGENTE_ADUANAL o el que
  aplique) -- este es el dato que el vendedor le indica a Customer Service, y que Customer
  Service usa para enviar las instrucciones al agente.
- Status (ej. SOLICITADO / RECIBIDO) para saber si el cliente ya lo entrego o sigue pendiente.

**Gate nuevo a implementar**: un `Booking` no deberia poder crearse sin un Routing Order en
estado RECIBIDO -- extiende el gate 3 existente (cotizacion aceptada) para tambien exigir esto.
Evalua si este gate es estricto siempre o si aplica solo cuando el cliente requiere Routing
Order formal (puede haber casos simples donde no aplique -- si el texto original no lo aclara,
implementalo como gate obligatorio por defecto y dejalo facil de relajar despues).

---

## 4. Documentos preliminares (extension de `Documento`)

Customer Service recibe House BL y Master BL en version **draft** antes de la version final.
El modelo `Documento` ya tiene `emisionHbl` y `emisionMbl` como texto libre -- formaliza esto
con un enum `EstatusEmisionBL` (DRAFT, FINAL) en vez de texto libre, para poder filtrar y
alertar cuando un documento sigue en draft.

---

## 5. Notificaciones al cliente (nueva entidad, reemplaza el booleano actual)

El `avisoLlegadaEnviado` (booleano simple) que ya existe en `Shipment` no alcanza -- el
dictado describe multiples tipos de notificacion en distintos momentos: cutoff documental,
cutoff de contenedor, ETD, ETA, aviso de arribo (10 dias antes, o 5 dias despues del zarpe
segun el caso), y solicitud de factura. Reemplaza el booleano por una tabla de log:

```
NotificacionEnviada
  - id
  - shipmentId (FK)
  - tipo (enum: CUTOFF_DOCUMENTAL, CUTOFF_CONTENEDOR, ETD, ETA, AVISO_ARRIBO,
          SOLICITUD_FACTURA, OTRO)
  - fechaEnviada
  - enviadoPor (FK a Usuario)
  - comentario (texto libre, opcional)
```

Esto tambien te da, gratis, la base para una alerta automatica en el Dashboard tipo "embarques
a los que les falta el aviso de arribo y ya estan a menos de 10 dias del ETA" -- construyela
si el tiempo lo permite, no es obligatorio para esta iteracion.

---

## 6. Valorizacion (nuevo paso de workflow, no necesariamente nueva tabla)

Antes de solicitar la factura, Operaciones/Customer Service piden a Ventas confirmar costo y
venta reales del embarque ("valorizacion"). Esto ya tiene donde vivir en el schema
(`Shipment.profitReal`, y `Cotizacion.montoVenta`/`montoCompra` como el estimado original) --
lo que falta es el **paso formal**: un estado o flag que indique que la valorizacion ya se
pidio y ya se confirmo, antes de permitir el gate de facturacion. Evalua si conviene agregar
`Shipment.valorizacionConfirmada` (Boolean) y `Shipment.valorizacionConfirmadaEn` (DateTime?),
o si prefieres modelarlo como otro tipo de `NotificacionEnviada` interna. Justifica tu eleccion
en el codigo.

---

## 7. Factura: distinguir proforma de final

El dictado menciona que la solicitud de factura puede ser "una proforma o una factura [final]".
El modelo `Factura` actual no distingue esto. Agrega un campo `tipo` (enum: PROFORMA, FINAL) a
`Factura`. Una proforma no deberia requerir CFDI timbrado; una final si sigue el flujo ya
existente con el PAC.

---

## 8. Revalidacion y entrega (extension de Operaciones)

Operaciones revalida ante la naviera y envia el BL endosado al cliente, luego da seguimiento a
la entrega a bodega. Agrega a `Shipment` (o a una entidad de seguimiento aparte si prefieres
mantener `Shipment` mas liviano -- decide tu):

- `fechaRevalidacionNaviera` (DateTime?)
- `blEndosadoEnviado` (Boolean, default false) + `fechaBlEndosadoEnviado` (DateTime?)

---

## 9. Expediente fisico

El dictado menciona abrir un expediente fisico ademas de subir la info al sistema. Agrega
`Shipment.expedienteFisico` (Boolean, default false) -- es ademas un campo que ya existia en el
Excel original (`INDICAR SI HAY EXPEDIENTE`) y que no se habia migrado todavia; ciérralo aqui.

---

## 10. Cierre de carpeta: validacion antes de cerrar

Hoy `cerrarShipment` (en `shipment.service.ts`) no valida nada mas que la existencia del
shipment. Segun el dictado, antes de cerrar la carpeta se debe confirmar que los costos reales
coinciden con lo cotizado/valorizado. Agrega una validacion (o al menos una advertencia
explicita en la UI, no necesariamente un bloqueo duro) quesenale si
`Shipment.profitReal` diverge significativamente del margen estimado en `Cotizacion`
(`montoVenta - montoCompra`). Si decides bloquear en vez de advertir, documenta por que en
CLAUDE.md.

---

## 11. Instrucciones para el trabajo

1. Antes de tocar codigo, confirma que entendiste el flujo extendido de la seccion 1 -- si
   algo no cuadra con lo que ya esta construido, señalalo antes de continuar en vez de forzar
   una solucion.
2. Sigue el patron de 4 archivos (`schema`/`service`/`controller`/`routes`) ya establecido en
   el proyecto para cada modulo nuevo (Pricing, Routing Order, Notificaciones).
3. Extiende `schema.prisma` con las entidades y campos nuevos descritos arriba. Todos los
   campos nuevos deben ser opcionales o tener default, para no romper los datos semilla ya
   existentes.
4. Los gates nuevos (Routing Order recibido antes de Booking) deben implementarse igual que
   los gates existentes: un `if` explicito al inicio del metodo de servicio correspondiente,
   con `ReglaDeNegocioError` y un mensaje claro.
5. Actualiza el frontend: nueva pagina/modulo de Pricing, formulario de Routing Order dentro
   del flujo de Cotizaciones/Bookings, y visualizacion del log de notificaciones en el detalle
   del Shipment.
6. Al terminar, corre las verificaciones de compilacion en backend y frontend.
7. **Actualiza CLAUDE.md por completo**: la cascada extendida de la seccion 1 de este
   documento debe quedar reflejada en la seccion 2 de CLAUDE.md (gates), el modelo de datos
   nuevo en la seccion 5, y el estado actual en la seccion 9. CLAUDE.md debe seguir siendo
   capaz de explicar el sistema completo sin necesidad de este archivo -- una vez que
   incorpores esto, este documento se vuelve historico, no una segunda fuente de verdad
   permanente.
8. Si alguna parte del Anexo (texto original) contradice mi interpretacion de las secciones
   1-10, prioriza el Anexo y señala la discrepancia en tu resumen final.

---

## Anexo: transcripcion original, sin editar

> Pricing es 15 se encarga de realizar las negociaciones con los agentes para las tarifas
> aéreas marítimas terrestres. Pueden ser tarifas snack Spot O básquet Ya sea por productos Ya
> sea por volumen Entonces es el pricing cuando recibe esas tarifas, es quien se encarga de
> distribuirlas o subirlas al sistema Y en base a las vigencias ofertadas y por navieras
>
> Las cotizaciones que realizan los vendedores va de la mano con las tarifas que sube la parte
> de pricing, es decir, que analiza cuáles son las mejores Tarifas Con las vigencias que se
> tienen en base a las condiciones que que el cliente requiere y con ciertas Modalidades o
> beneficios que se le van a otorgar Entonces el vendedor cotiza en base a eso se la manda al
> cliente y obtiene una confirmación cuando tiene esta confirmación Ya pasa a la parte de cost
> ER
>
> Cuándo el vendedor cierra una una venta? Pasa la Estafeta al área Customer, ya sea por medio
> de unas instrucciones o en ese mismo seguimiento con el cliente incluye a la Customer para
> que la Customer solicite las instrucciones En base a lo que el vendedor esté ofertó esas
> instrucciones es un rutin Order, el rutin Order debe de llevar datos del Jeepers, datos del
> consignatario El puerto de carga al puerto de destino Si el destino final es el mismo
> puerto, es decir Manzanillo Veracruz y se llama Sigua o si va a llevar alguna modalidad con
> servicio de entrega hasta bodega, ya sea en del puerto a bodega en tren camión O todo camión
> dentro de BL, es decir que el servicio se hace con la naviera o un servicio de camión fuera
> de BL que se contrata por por fuera O un servicio real RAM Que una vez que llega a la aduana
> interna, ejemplo que es pan taco hasta ahí nosotros realizamos el servicio dentro de naviera
> y el cliente ingresa su propio transporte y entrega a bodega
>
> Misma área Costumer Service, cuando tiene ese Ruting Order. Obviamente el el vendedor le
> tiene que decir con qué agente realizar la reservación. Y manda instrucciones a ese agente,
> y ese agente la retroalimenta en base a lo que el proveedor le le entrega y la gente realiza
> la reserva con la naviera y cuando se tiene una reservación y detalles y eso se llama un
> Booking donde te da el detalles del buque La naviera y una, una ETD estimada, una fecha de
> salida estimada, ese es el Booking Y cuando ya se tiene una MS es que se tiene documentos, es
> decir que hay un House _ _. O hay un Master BL Draft Y el área Costumer recibe sus documentos
> y lo sube al sistema eso sería como parte del Booking
>
> Hay Customer y operaciones. Podría ir de la mano porque el área Costumer prácticamente ve
> todo lo internacional. Es decir Da los estatus al cliente y hasta que manda aviso de arribo.
> Pasaré a la Estafeta al área de operaciones para que todo para que el área de operaciones vea
> todo lo nacional eso se podría así como dividir a Costumer y operaciones Pero en término
> Sistema de que si nosotras ya vamos a hacer absolutamente todo, pues sería Pasar a la fase de
> seguimiento, independientemente si es internacional o nacional, donde se lee una vez que se
> reciben los detalles del BL Que se sube el volumen el peso, el contenedor, el número de
> Master se tiene que estar dando seguimiento en las actualizaciones de la fecha de arribo
> Solicitar A los chicos de venta a la valorización, es decir tener costo y venta. Ya final
> para mandar aviso de arribo que éste se tiene que mandar con por lo menos de 10 días antes
> del arribo o si hay algo en particular donde el cliente se le manda Un aviso cinco días
> después del zarpe O algunas especificaciones especiales Después de la visa de arribo se manda
> La solicitud de factura ya sea una proforma o una factura. Final La misma parte de
> operaciones Ingresa a la encomienda, es decir, los datos de la gente aduanal a las navieras
> Revisa el tema de los pagos, solicita pagos Revalida ante la naviera, manda los Vélez,
> endosados al cliente Da seguimiento al cliente o el agente aduanal, de cómo va la
> revalidación y su despacho como va la entrega a su bodega y realiza el corte o ingreso de De
> contenedor que sería el corte demás
>
> 1. Área de Pricing Obtener las mejores tarifas y condiciones comerciales con las líneas
> navieras, aerolíneas o transportistas terrestres.
> Recepción de tarifas y distribuir a la interna o subir al sistema por navieras, vigencia. Etc
> Vendedor... revisa las tarifas que la parte de princing subió y Envía la cotización formal a
> cliente para su aceptación y si cierra el embarque se la manda a Customer con las
> especificaciones o rutina order... O agregue a la customer con cliente para pedir a cliente
> las instrucciones.
> Routing order /instrucciones que se pide a cliente debe llevar
> Datos shipper
> Datos cnee
> POL (puerto de carga)
> POD puerto destino
> Destino final (CY cortado a puerto ) (Rail truck / Rail ramp/ truck dentro de naviera) o
> camion fuera de BL
> Y especificaciones especiales.
>
> 2. Área de Customer Service Fungir como el enlace principal con el cliente, asegurando la
> recepción de instrucciones completas e iniciando la reserva.
> resuelve dudas técnicas o comerciales, jejeje
> Recopilar doc del cliente.
> Recepción del Booking de parte del agente
> Que lleva
> Datos de reserva
> Buque
> ETD
> Etc
> Notificación puntual al cliente con las fechas clave (cierre de documental/en contenedor o
> cutoff, salida estimada/ETD, llegada estimada/ETA).
> Enviar aviso de arribo 10 días antes y pedir factura.
> Adiocnal abrir expediente físico y subir info a sistema.
>
> Área de Operaciones seguimiento nacional... Es decir confirmar el arribo, ingresar cartas a
> naviera, liberar revisar avances de despacho , pedir un pagos a navieras etc y confirmar
> vacíos o cargos extras demoras
> Cierre de carpetas Revisa que los costos reales coincidan con lo ofertado en cotización o
> valorizacion
