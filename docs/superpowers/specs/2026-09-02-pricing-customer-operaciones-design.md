# Diseño: Pricing, Customer Service y Operaciones (cascada extendida)

- **Fecha:** 2026-09-02
- **Fuente de requerimientos:** `docs/requerimientos-pricing-customer-operaciones.md`
  (interpretación + Anexo con el dictado original de Customer Service de Monsa).
- **Base:** `CLAUDE.md` §1-§13. Este diseño EXTIENDE la cascada y el modelo; no los reemplaza.
- **Clasificación:** arquitectural (entidades nuevas, gates nuevos, cascada renumerada).

---

## 0. Hallazgos previos (código real vs CLAUDE.md restaurado)

CLAUDE.md se borró y se restauró de un respaldo. Comparación código ↔ documentación:

**En sync:** los 14 módulos backend, las páginas frontend, los componentes y las 3
migraciones coinciden con CLAUDE.md §12. Pricing (`tarifas` + `/pricing`) y Operaciones
(`operaciones` + `/operaciones`) ya existen completos. `schema.prisma` = los 13 modelos
"vigentes" exactos.

**Drifts detectados (se corrigen como parte de este trabajo):**

1. **Numeración de gates inconsistente.** CLAUDE.md §2 numera 5 gates. Los comentarios del
   código numeran distinto: `booking.service.ts` dice "GATE 2" y cubre *cotización ACEPTADA
   + proveedor activo* juntos; `shipment.service.ts crearShipment` = "GATE 3" (CLAUDE.md:
   gate 4); `cerrarShipment` = "GATE 4"; `factura.service.ts` = "GATE FINAL". Otros archivos
   (`reporte.service.ts`, `shipment.schema.ts`) citan la numeración del código. Mismas
   reglas, etiquetas distintas. → Este diseño renumera TODO a 7 gates consistentes en
   CLAUDE.md y en los comentarios del código.
2. **`esEstimado` no se persiste.** CLAUDE.md §2 lo trata como campo de `Cotizacion`. Es un
   flag solo-input en `crearCotizacionSchema` (`default false`), nunca se guarda. El gate
   funciona porque `marcarAceptada` re-ejecuta `verificarClienteActivo`. Sin cambio; se
   aclara la redacción de CLAUDE.md.
3. **`avisoLlegadaEnviado` NO existe.** Requerimientos §5 dice "reemplaza el booleano
   actual" — no hay booleano. `operacion.service.ts` deriva la alerta explícitamente. →
   Solo se **agrega** `NotificacionEnviada`; no hay nada que reemplazar.
4. **`Shipment.profitReal` NO existe** (parte del bloque desincronizado de CLAUDE.md §5, ya
   auto-marcado). `CostoDemora` real = solo `diasDemora, costoDemora, ventaDemoraSinIva`.
   Sin `ShipmentProveedor`, `Seguro`, `operativo`, campos de corrección de MBL.
   Requerimientos §6 y §10 asumen `profitReal` presente → este diseño crea campos de
   valorización que cubren esa necesidad.
5. **`Documento.emisionHbl/emisionMbl`** son texto libre hoy; solo los consume
   `reporte.service.ts` como string de display. Ningún gate depende de ellos. El seed no los
   puebla. → Se reemplazan por enum sin pérdida de datos.

---

## 1. Cascada operativa extendida (7 gates)

Reemplaza la lista de 5 gates de CLAUDE.md §2. Cada gate = un `if` explícito al inicio del
método de servicio correspondiente, con `ReglaDeNegocioError` y mensaje claro en español.

```
Cliente/Proveedor activos
  → Cotización (gate 1)
  → Cotización ACEPTADA (gate 2)
  → Routing Order RECIBIDO (gate 3, NUEVO)
  → Booking: proveedor ACTIVO (gate 4)
  → Booking CONFIRMADO → folio de Shipment (gate 5)
  → Seguimiento: valorización confirmada (gate 6, NUEVO)
  → Shipment cerrado PARA_FACTURAR → Factura FINAL (gate 7)
```

| Gate | Regla | Dónde | Cambio |
|------|-------|-------|--------|
| 1 | Cotización en firme (`esEstimado = false`) requiere `Cliente.estatus = ACTIVO`. Un prospecto recibe estimados; el gate se re-valida en `marcarAceptada`. | `clientes/cliente.service.ts` `verificarClienteActivo`, llamado desde `cotizaciones/cotizacion.service.ts` | sin cambio |
| 2 | `RoutingOrder` y `Booking` requieren `Cotizacion.status = ACEPTADA`. | `routing-orders/routing-order.service.ts` `crearRoutingOrder`; `bookings/booking.service.ts` `crearBooking` | RO añade este check; Booking ya lo tenía |
| 3 | **NUEVO.** `crearBooking` exige un `RoutingOrder` con `status = RECIBIDO` para la cotización — **salvo** que `cliente.requiereRoutingOrder = false`. | `bookings/booking.service.ts` `crearBooking` | nuevo `if` |
| 4 | `Booking` requiere proveedor `estatus = ACTIVO` (≥1 tarifa vigente). | `proveedores/proveedor.service.ts` `verificarProveedorActivo`, llamado desde `crearBooking` | sin cambio |
| 5 | El folio de shipment (`MGC26xxxxxx`) solo se genera con `Booking.status = CONFIRMADO`. | `shipments/shipment.service.ts` `crearShipment` | sin cambio (renumerado desde "gate 3/4") |
| 6 | **NUEVO.** `crearFactura` (ambos tipos) exige `shipment.valorizacionConfirmada = true`. | `facturacion/factura.service.ts` `crearFactura` | nuevo `if` |
| 7 | `crearFactura` con `tipo = FINAL` exige `shipment.status = PARA_FACTURAR`. **`tipo = PROFORMA` lo salta** (solo requiere shipment en status de seguimiento activo: `NUEVO_EMBARQUE`/`BOOKING_CONFIRMED`/`PARA_CERRAR`/`PARA_FACTURAR`). | `facturacion/factura.service.ts` `crearFactura` | ajustado |

**Soft-check de cierre (NO es gate, no bloquea):** `cerrarShipment` calcula
`divergenciaMargen = (valorizacionVenta - valorizacionCompra) - (cotizacion.montoVenta -
cotizacion.montoCompra)` y lo devuelve en la respuesta. La UI de Embarques muestra un banner
de advertencia si la divergencia supera un umbral (10% del margen estimado, o monto absoluto
> 50 en la moneda). Justificación en el código y en CLAUDE.md: el Anexo dice "no
necesariamente un bloqueo duro"; un margen que cambió es información para Finanzas, no un
error que impida cerrar.

---

## 2. Cambios de schema (`backend/prisma/schema.prisma`)

Regla: **todos los campos nuevos son opcionales o con `default`** para no romper el seed.
Único cambio destructivo: se eliminan `Documento.emisionHbl` / `emisionMbl` (texto libre que
el seed no puebla).

### 2.1 Enums nuevos (6)

```prisma
enum TipoTarifa {
  CONTRATO   // fija por vigencia negociada
  SPOT       // cotización puntual
  BASKET     // escalonada por producto o volumen
}

enum StatusRoutingOrder {
  SOLICITADO // se pidió al cliente, aún no llega
  RECIBIDO   // el cliente entregó las instrucciones — habilita el gate 3
}

enum TipoServicioEntrega {
  CY_PUERTO         // destino final = el mismo puerto (Manzanillo, Veracruz)
  DENTRO_BL_RAIL    // a bodega vía tren, dentro del BL (contratado con la naviera)
  DENTRO_BL_TRUCK   // a bodega vía camión, dentro del BL
  FUERA_BL_CAMION   // camión contratado por fuera del BL
  RAM               // hasta aduana interna (ej. Pantaco); ahí termina el servicio de Monsa
}

enum EstatusEmisionBL {
  DRAFT
  FINAL
}

enum TipoNotificacion {
  CUTOFF_DOCUMENTAL
  CUTOFF_CONTENEDOR
  ETD
  ETA
  AVISO_ARRIBO
  SOLICITUD_FACTURA
  OTRO
}

enum TipoFactura {
  PROFORMA
  FINAL
}
```

### 2.2 Modelo `RoutingOrder` (nuevo, 1:1 con `Cotizacion`)

```prisma
model RoutingOrder {
  id                  String               @id @default(uuid())
  cotizacionId        String               @unique
  cotizacion          Cotizacion           @relation(fields: [cotizacionId], references: [id])
  status              StatusRoutingOrder   @default(SOLICITADO)

  shipperNombre       String?
  shipperDireccion    String?
  // El consignee NO se duplica: es cotizacion.cliente. Se documenta en el código.
  pol                 String?              // puerto de carga
  pod                 String?              // puerto de destino
  destinoFinal        String?
  tipoServicioEntrega TipoServicioEntrega?
  especificaciones    String?              @db.Text

  // Agente que el vendedor indica a Customer Service para hacer la reservación.
  agenteId            String?
  agente              Proveedor?           @relation("RoutingOrderAgente", fields: [agenteId], references: [id])

  fechaSolicitud      DateTime             @default(now())
  fechaRecibido       DateTime?
  creadoEn            DateTime             @default(now())
  actualizadoEn       DateTime             @updatedAt
}
```

Relación inversa: `Cotizacion.routingOrder RoutingOrder?`,
`Proveedor.routingOrdersComoAgente RoutingOrder[] @relation("RoutingOrderAgente")`.

### 2.3 Modelo `NotificacionEnviada` (nuevo, N:1 con `Shipment`)

```prisma
model NotificacionEnviada {
  id           String           @id @default(uuid())
  shipmentId   String
  shipment     Shipment         @relation(fields: [shipmentId], references: [id])
  tipo         TipoNotificacion
  fechaEnviada DateTime         @default(now())
  enviadoPorId String?
  enviadoPor   Usuario?         @relation("NotificacionesEnviadas", fields: [enviadoPorId], references: [id])
  comentario   String?          @db.Text
  creadoEn     DateTime         @default(now())

  @@index([shipmentId])
}
```

Relaciones inversas: `Shipment.notificaciones NotificacionEnviada[]`,
`Usuario.notificacionesEnviadas NotificacionEnviada[] @relation("NotificacionesEnviadas")`.
Es un log: sin endpoint de borrado ni edición.

### 2.4 Campos agregados a modelos existentes

| Modelo | Campo | Tipo | Motivo |
|--------|-------|------|--------|
| `Tarifa` | `tipo` | `TipoTarifa @default(CONTRATO)` | Requerimientos §2. |
| `Cliente` | `requiereRoutingOrder` | `Boolean @default(true)` | Escape hatch del gate 3 (Q2). |
| `Shipment` | `expedienteFisico` | `Boolean @default(false)` | Requerimientos §9 (col. Excel `INDICAR SI HAY EXPEDIENTE`). |
| `Shipment` | `valorizacionVenta` | `Decimal? @db.Decimal(14,2)` | Requerimientos §6: venta real confirmada por Ventas. |
| `Shipment` | `valorizacionCompra` | `Decimal? @db.Decimal(14,2)` | Requerimientos §6: costo real. |
| `Shipment` | `valorizacionConfirmada` | `Boolean @default(false)` | Gate 6. |
| `Shipment` | `valorizacionConfirmadaEn` | `DateTime?` | Auditoría del gate 6. |
| `Shipment` | `fechaRevalidacionNaviera` | `DateTime?` | Requerimientos §8. |
| `Shipment` | `blEndosadoEnviado` | `Boolean @default(false)` | Requerimientos §8. |
| `Shipment` | `fechaBlEndosadoEnviado` | `DateTime?` | Requerimientos §8. |
| `Factura` | `tipo` | `TipoFactura @default(FINAL)` | Requerimientos §7. |
| `Documento` | `estatusEmisionHbl` | `EstatusEmisionBL?` | Requerimientos §4. **Reemplaza** `emisionHbl String?`. |
| `Documento` | `estatusEmisionMbl` | `EstatusEmisionBL?` | Requerimientos §4. **Reemplaza** `emisionMbl String?`. |

Conteo en CLAUDE.md §5: de **13 modelos / 10 enums** → **15 modelos / 16 enums**.

### 2.5 Migración

`npx prisma migrate dev --name pricing_customer_operaciones`. Un solo archivo de migración.
Drop de `Documento.emisionHbl` / `emisionMbl` incluido — el seed no los escribe, sin
pérdida de datos en desarrollo.

---

## 3. Backend — módulos nuevos (patrón de 4 archivos)

### 3.1 `modules/routing-orders/`

- **`routing-order.schema.ts`**
  - `crearRoutingOrderSchema`: `cotizacionId` (uuid), + todos los campos opcionales
    (`shipperNombre`, `shipperDireccion`, `pol`, `pod`, `destinoFinal`,
    `tipoServicioEntrega` enum, `especificaciones`, `agenteId` uuid nullish).
  - `actualizarRoutingOrderSchema`: mismos campos, todos `.optional()` / `.nullish()`, con
    el patrón `"" → null` para fechas ausentes (igual que `shipment.schema.ts`).
- **`routing-order.service.ts`**
  - `crearRoutingOrder(data)` — **gate 2**: la cotización debe existir y estar `ACEPTADA`.
    Rechaza si ya existe RO para esa cotización (relación 1:1). Si `agenteId` viene, valida
    que el proveedor exista.
  - `actualizarRoutingOrder(id, data)` — editable solo mientras `status = SOLICITADO`.
    Pasa por `limpiarEntrada()`.
  - `marcarRecibido(id)` — set `status = RECIBIDO`, `fechaRecibido = now()`. Idempotente-ish:
    error si ya está `RECIBIDO`.
  - `obtenerRoutingOrder(id)` / `listarRoutingOrders({ cotizacionId, status })` — include
    `cotizacion: { include: { cliente: true } }`, `agente`.
- **`routing-order.controller.ts`** — adapta Request/Response, parsea con el schema.
- **`routing-order.routes.ts`** — `asyncHandler` en todas:
  - `GET /api/routing-orders?cotizacionId=&status=`
  - `GET /api/routing-orders/:id`
  - `POST /api/routing-orders`
  - `PATCH /api/routing-orders/:id`
  - `PATCH /api/routing-orders/:id/recibir`
- Registrar en `app.ts`: `app.use("/api/routing-orders", routingOrderRouter)` después de
  `cotizaciones` y antes de `bookings` (orden de la cascada).

### 3.2 `modules/notificaciones/`

- **`notificacion.schema.ts`** — `crearNotificacionSchema`: `tipo` (enum `TipoNotificacion`),
  `comentario` (string trim opcional). `shipmentId` viene del path, `enviadoPorId` del token.
- **`notificacion.service.ts`**
  - `registrarNotificacion(shipmentId, usuarioId, data)` — valida que el shipment exista;
    crea la fila. `enviadoPorId = usuarioId` (puede ser null si el token no lo trae, no debería).
  - `listarPorShipment(shipmentId)` — orderBy `fechaEnviada desc`, include `enviadoPor` con
    `SELECT_USUARIO_PUBLICO`.
- **`notificacion.controller.ts`** — lee `req.user` (lo pone `requireAuth`) para el autor.
- **`notificacion.routes.ts`** — router montado como sub-recurso de shipments:
  - `GET /api/shipments/:id/notificaciones`
  - `POST /api/shipments/:id/notificaciones`
  - Se puede registrar dentro de `shipment.routes.ts` (`shipmentRouter.use("/:id/notificaciones", ...)`)
    o como router propio montado en `app.ts` con path `/api/shipments/:shipmentId/notificaciones`.
    **Decisión:** router propio `notificacionRouter` con `mergeParams: true`, montado desde
    `shipment.routes.ts` para mantener el path pero sin inflar el service de shipments.

### 3.3 Extensiones a módulos existentes

- **`modules/tarifas/`**
  - `tarifa.schema.ts`: `tipo: tipoTarifaEnum.default("CONTRATO")` en crear, `.optional()` en
    actualizar.
  - `tarifa.service.ts`: `crearTarifa` y `actualizarTarifa` propagan `tipo`; `listarTarifas`
    acepta `filtros.tipo` y lo pasa al `where`.
  - `POST /api/proveedores/:id/tarifas` (en `proveedor.service.ts` `agregarTarifa`) también
    acepta `tipo` opcional (default `CONTRATO`) — el schema de `proveedor.schema.ts` gana el campo.

- **`modules/bookings/`**
  - `booking.service.ts` `crearBooking` — **gate 3 nuevo**, antes de `verificarProveedorActivo`:
    ```
    const cliente = await prisma.cliente.findUnique({ where: { id: cotizacion.clienteId } });
    if (cliente?.requiereRoutingOrder) {
      const ro = await prisma.routingOrder.findUnique({ where: { cotizacionId: cotizacion.id } });
      if (!ro || ro.status !== "RECIBIDO") {
        throw new ReglaDeNegocioError(
          "No se puede crear el booking: falta el Routing Order del cliente en estado RECIBIDO"
        );
      }
    }
    ```
  - Renumerar comentarios: este archivo pasa a documentar gates 2, 3 y 4.

- **`modules/shipments/`**
  - `shipment.schema.ts`:
    - `actualizarShipmentSchema` gana: `expedienteFisico` (bool), `fechaRevalidacionNaviera`
      (fecha `"" → null`), `blEndosadoEnviado` (bool), `fechaBlEndosadoEnviado` (fecha).
    - `actualizarDocumentoSchema`: `emisionHbl` / `emisionMbl` (texto) → `estatusEmisionHbl` /
      `estatusEmisionMbl` (`z.enum(["DRAFT","FINAL"]).nullish()`).
    - Nuevo `confirmarValorizacionSchema`: `valorizacionVenta` (number positive),
      `valorizacionCompra` (number positive).
  - `shipment.service.ts`:
    - `actualizarShipment` — propaga los campos nuevos (ya pasa `limpio as never`).
    - `actualizarDocumento` — campos de emisión enum.
    - Nuevo `confirmarValorizacion(id, data)` — set `valorizacionVenta`, `valorizacionCompra`,
      `valorizacionConfirmada = true`, `valorizacionConfirmadaEn = now()`. Solo si el shipment
      está en un status de seguimiento activo (`EDITABLES`).
    - `cerrarShipment` — tras el update, calcula y devuelve `divergenciaMargen`:
      ```
      { shipment, divergenciaMargen: { estimado, valorizado, delta, alerta: boolean } }
      ```
      `alerta = true` si `valorizacionConfirmada` y `|delta| > max(0.1 * |estimado|, 50)`.
      No lanza error.
  - `shipment.routes.ts`: `PATCH /api/shipments/:id/valorizacion`; montar
    `notificacionRouter` en `/:id/notificaciones`.
  - `INCLUDE_SHIPMENT` / `obtenerShipment` — incluir `notificaciones` (con `enviadoPor`
    público) y `booking.cotizacion` (ya está) para el cálculo de divergencia en el front.

- **`modules/facturacion/`**
  - `factura.schema.ts`: `crearFacturaSchema` gana `tipo: z.enum(["PROFORMA","FINAL"]).default("FINAL")`.
  - `factura.service.ts` `crearFactura`:
    - **gate 6** (ambos tipos): `if (!shipment.valorizacionConfirmada) throw ...`.
    - **gate 7** (solo FINAL): `if (data.tipo === "FINAL" && shipment.status !== "PARA_FACTURAR") throw ...`.
    - **PROFORMA**: status del shipment debe estar en seguimiento activo
      (`["NUEVO_EMBARQUE","BOOKING_CONFIRMED","PARA_CERRAR","PARA_FACTURAR"]`); número con
      serie `siguienteNumeroProforma()` → prefijo `MGC-PROF-`; **no** llama
      `crearDesdeFactura`; **no** hace `shipment.update({ status: "FACTURADO" })`;
      `estatusPac` queda `"no_aplica"`.
    - **FINAL**: flujo actual sin cambios (serie `MGC-FACT-`, crea CxC, mueve a `FACTURADO`).
    - Se permite 1 proforma + 1 final por shipment: el check `if (shipment.factura)` cambia a
      contar por tipo (una FINAL bloquea otra FINAL; una PROFORMA no bloquea la FINAL).
      → **Ajuste de modelo:** `Factura.shipmentId` deja de ser `@unique`; se agrega
      `@@unique([shipmentId, tipo])`. `Shipment.factura Factura?` → `Shipment.facturas Factura[]`.
      *(Ver §6 Riesgos — este es el cambio con más radio.)*
  - `factura.controller.ts` / `routes.ts` — sin cambios de forma; `marcarTimbrada` rechaza si
    `tipo = PROFORMA`.

- **`modules/cotizaciones/`**
  - `cotizacion.service.ts` `obtenerCotizacion` — include `routingOrder: { include: { agente: true } }`.

- **`modules/dashboard/`** *(opcional, si el tiempo lo permite)*
  - `avisosArriboPendientes()` — shipments activos con `eta` dentro de 10 días, sin
    `fechaArriboReal`, y sin ninguna `NotificacionEnviada` de `tipo = AVISO_ARRIBO`.
  - Añadir al `kpis()` o como lista aparte para un tile en el Dashboard.

---

## 4. Frontend

Mismo lenguaje visual de CLAUDE.md §4.2.1 (navy/teal/amber, `rounded-xl`, `shadow-tarjeta`,
iconos `lucide-react`). Reusar `DataTable`, `Modal`, `Field`/`Select`, `StatusBadge`,
`Button` (con `motivoDeshabilitado`), `CascadeStepper`, `Aviso`.

### 4.1 `lib/api.ts` / tipos

- Nuevos tipos espejo: `RoutingOrder`, `NotificacionEnviada`, `TipoTarifa`,
  `TipoServicioEntrega`, `EstatusEmisionBL`, `TipoNotificacion`, `TipoFactura`.
- Etiquetas legibles en `lib/format.ts` `etiqueta()` para los enums nuevos.

### 4.2 `/pricing` (`pages/Pricing.tsx`, ya existe)

- Columna "Tipo" en la `DataTable` con `StatusBadge` (contrato = teal, spot = amber,
  basket = navy).
- `Select` "Tipo de tarifa" en el formulario de alta y en `FormularioEdicion` (descriptor
  `CampoFormulario`).
- Filtro por tipo junto al de modalidad / proveedor / solo vigentes.

### 4.3 Routing Order — dentro de `pages/Cotizaciones.tsx`

- En la fila de una cotización `ACEPTADA`: `accionesExtra`:
  - Si no hay RO → botón "Solicitar Routing Order" abre `<Modal>` con formulario:
    `shipperNombre`, `shipperDireccion`, `pol`, `pod`, `destinoFinal`,
    `tipoServicioEntrega` (`<Select>` del enum con etiquetas), `especificaciones`
    (`<TextArea>`), `agente` (`<Select>` de proveedores — filtrado a tipos
    `AGENTE_ADUANAL`, `COLOADER`, `NAVIERA`, `OTRO`).
  - Si hay RO en `SOLICITADO` → `StatusBadge` + botón "Editar RO" + botón "Marcar recibido".
  - Si hay RO en `RECIBIDO` → `StatusBadge` verde + "Ver RO" (solo lectura en `DetalleDrawer`).
- `useMutation` → `invalidateQueries(["cotizaciones"])`.

### 4.4 `pages/Bookings.tsx`

- `<CascadeStepper>` gana un paso "Routing Order" entre "Cotización aceptada" y "Booking".
- El botón "Crear booking" usa `motivoDeshabilitado` = texto exacto del gate 3
  (`"No se puede crear el booking: falta el Routing Order del cliente en estado RECIBIDO"`)
  cuando la cotización elegida no tiene RO `RECIBIDO` y el cliente `requiereRoutingOrder`.
- Para saber el estado del RO, la query de cotizaciones aceptadas incluye `routingOrder`
  (backend ya lo agrega en `obtenerCotizacion`; para la lista se añade a
  `listarCotizaciones` un `select` mínimo del RO: `{ status: true }`).

### 4.5 `pages/Embarques.tsx`

- Formulario de documentación (`FormularioEdicion` / modal):
  - "Emisión HBL" / "Emisión MBL": `text` → `<Select>` `DRAFT` / `FINAL` / (vacío).
  - Nuevos campos: "Expediente físico" (checkbox), "Fecha revalidación naviera" (date),
    "BL endosado enviado" (checkbox) + "Fecha envío BL endosado" (date).
- Acción de fila "Valorización" → `<Modal>` con `valorizacionVenta` / `valorizacionCompra`
  (`numeroInput`), muestra el estimado de la cotización al lado para comparar. Al confirmar,
  `PATCH /api/shipments/:id/valorizacion`. Badge "Valorizada" cuando `valorizacionConfirmada`.
- Al cerrar el embarque: si la respuesta trae `divergenciaMargen.alerta`, mostrar `<Aviso>`
  tipo bloqueo/info con el delta antes de confirmar (no impide cerrar, solo advierte —
  segunda confirmación).

### 4.6 Notificaciones — panel en el detalle del Shipment

- En `pages/Operaciones.tsx` (tablero) y/o `components/DetalleDrawer.tsx`: sección
  "Notificaciones al cliente":
  - `DataTable` compacta: tipo (`StatusBadge`), fecha, enviado por, comentario.
  - Botón "Registrar notificación" → `<Modal>`: `<Select>` de `TipoNotificacion` (etiquetas
    legibles), `<TextArea>` comentario. `POST /api/shipments/:id/notificaciones`.
- `Operaciones.tsx` — nueva acción de fila "Notificar" que abre el mismo modal.

### 4.7 `pages/finanzas/FacturacionPanel.tsx`

- Al generar factura: `<Select>` "Tipo" PROFORMA / FINAL.
  - PROFORMA: sin gate de shipment cerrado (solo valorización). Se lista con badge
    "PROFORMA", sin acción "Timbrar", no aparece en cuentas por cobrar.
  - FINAL: flujo actual.
- La `DataTable` de facturas gana columna "Tipo".

### 4.8 `pages/Dashboard.tsx` *(opcional)*

- `KpiCard` o lista "Avisos de arribo pendientes" (ETA < 10 días, sin `AVISO_ARRIBO`),
  con `alerta` cuando hay ≥1.

### 4.9 `components/Sidebar.tsx`

- Sin entradas nuevas. Routing Order vive en Cotizaciones; Notificaciones en el detalle del
  Shipment; Pricing y Operaciones ya están.

---

## 5. Seed (`backend/prisma/seed.ts`)

- Añadir `tipo` a las tarifas sembradas (mayoría `CONTRATO`, alguna `SPOT` para variedad).
- Para las 5 cotizaciones reales: crear su `RoutingOrder` en `status = RECIBIDO` (así la
  cadena existente sigue siendo válida bajo el gate 3). Marcar con `ASUNCION:` los campos no
  presentes en el Excel.
- Para los shipments sembrados: `valorizacionConfirmada = true` con
  `valorizacionVenta`/`valorizacionCompra` = los montos de la cotización (así el gate 6 no
  rompe el estado sembrado). Marcar `ASUNCION:`.
- `expedienteFisico = true` en los que el Excel indicaba expediente.
- El bloque de embarques reales sigue auto-omitiéndose si ya hay shipments.

---

## 6. Riesgos y decisiones

1. **`Factura` deja de ser 1:1 con `Shipment`.** Para permitir proforma + final por
   embarque, `shipmentId` pierde `@unique` y pasa a `@@unique([shipmentId, tipo])`.
   Impacto: `Shipment.factura` → `Shipment.facturas Factura[]`; ajustar
   `shipment.service.ts` `obtenerShipment` (include), `dashboard.service.ts`
   (`rentabilidadPorEmbarque` no usa factura, OK), `reporte.service.ts` (no usa factura),
   `factura.service.ts` (`crearFactura` check por tipo, `resumenFacturacion` filtra
   `tipo = FINAL` para el monto facturado real). Migración: los datos sembrados tienen
   ≤1 factura, sin colisión.
   **Alternativa descartada:** modelo `Proforma` separado — duplica casi todos los campos de
   `Factura` para un documento que es la misma estructura sin timbrado.
2. **Drop de `Documento.emisionHbl/emisionMbl`.** El seed no los escribe y solo
   `reporte.service.ts` los lee (display). Riesgo bajo. Si en la BD de desarrollo actual hay
   datos capturados a mano, se pierden — aceptable en MVP (confirmar antes de correr la
   migración en una BD con datos reales).
3. **Gate 6 sobre datos sembrados.** Sin el ajuste del seed (§5), las 3 facturas sembradas
   quedarían bloqueadas por falta de valorización. El seed las marca confirmadas.
4. **`requireRol` sigue sin aplicarse.** `PATCH /api/shipments/:id/valorizacion` conceptualmente
   es de Ventas; se deja un comentario `// TODO requireRol(VENTAS)` como el resto del sistema.
5. **Renumeración de gates** toca comentarios en `cotizacion.service.ts`, `booking.service.ts`,
   `shipment.service.ts`, `factura.service.ts`, `reporte.service.ts`, `shipment.schema.ts`,
   `cotizacion.schema.ts`. Solo comentarios y strings de error — sin cambio de lógica salvo
   los gates 3, 6 y 7.

---

## 7. Verificación (antes de dar por terminado)

```bash
cd backend
npx prisma migrate dev --name pricing_customer_operaciones
npm run seed                 # debe correr sin error
npx tsc --noEmit             # sin errores

cd ../frontend
npm run build                # tsc -b + vite build, sin errores
```

Prueba manual de la cascada extendida:
1. Cotización → aceptar → intentar Booking sin RO → debe bloquear (gate 3).
2. Crear RO → marcarlo RECIBIDO → Booking ahora permitido.
3. Cliente con `requiereRoutingOrder = false` → Booking permitido sin RO.
4. Shipment → intentar Factura FINAL sin valorización → bloquea (gate 6).
5. Confirmar valorización → Factura PROFORMA permitida aunque el shipment no esté cerrado.
6. Cerrar shipment con divergencia > umbral → banner de advertencia, pero cierra.
7. Registrar notificaciones → aparecen en el log del detalle del shipment.

---

## 8. Actualización de `CLAUDE.md` (parte del entregable)

- **§2** — reemplazar los 5 gates por los 7 de §1 de este doc + el soft-check de cierre.
- **§4** — `modules/routing-orders/`, `modules/notificaciones/` en la estructura; cambios de
  páginas (Pricing tipo de tarifa, RO en Cotizaciones, valorización/BL en Embarques,
  notificaciones en el detalle, tipo en Facturación).
- **§4.1** — `routing-orders` y `notificaciones` en la lista de módulos con patrón de 4
  archivos; `notificaciones` NO es de solo lectura (recibe body).
- **§5** — `RoutingOrder`, `NotificacionEnviada`, los 6 enums nuevos, los campos nuevos de
  `Tarifa`/`Cliente`/`Shipment`/`Factura`/`Documento`; conteo → 15 modelos / 16 enums;
  `Factura` ahora 1:N con `Shipment`. Nota sobre qué queda del bloque desincronizado
  (`ShipmentProveedor`, `Seguro` siguen pendientes; la valorización cubre la necesidad de
  `profitReal`).
- **§9** — sin cambios estructurales (los documentos no cambian salvo que la carta de
  instrucciones ahora lee `estatusEmisionHbl/Mbl` enum).
- **§12** — estado actual: 16 módulos backend, cascada de 7 gates, entidades nuevas.
- **§13** — quitar de "siguiente tarea" lo ya hecho; el punto 2 (reconciliar backlog de §5)
  se reduce a `ShipmentProveedor` + `Seguro`.
- Encabezado del doc de requerimientos → marcar como **histórico / incorporado a CLAUDE.md**.

---

## 9. Fuera de alcance (confirmado)

- Política de "aviso de arribo 10 días antes / 5 días después del zarpe" **por cliente**: no
  se persiste. El log registra el envío; el *cuándo* sigue siendo alerta derivada.
- `ShipmentProveedor` (proveedores múltiples por rol) y `Seguro` — siguen en el backlog de
  CLAUDE.md §5.
- Timbrado CFDI real, portal de cliente, alta de usuarios, `requireRol` — sin cambio
  respecto a CLAUDE.md §12.
- Repo no está bajo git — el spec no se commitea (se deja el archivo en `docs/superpowers/specs/`).
