# AGENTS.md — Sistema de gestion de Monsa Global Cargo (MGC)

Este es el UNICO archivo de contexto del proyecto. Contiene todo lo necesario para continuar
el desarrollo sin tener que reexplicar nada: el porque del proyecto, las decisiones de
arquitectura, el modelo de datos completo, las convenciones de codigo, como correrlo en local
y el estado exacto de avance. Leelo completo antes de proponer cambios de arquitectura o
convenciones distintas a las de aqui.

> **Nota historica (2026-09-02).** Este archivo se borro y se restauro desde un respaldo
> viejo; el respaldo estaba muy por detras del codigo (le faltaban auth, reportes, Pricing,
> Operaciones, Contactos, Finanzas). Se reconstruyo a partir de una copia fiel al codigo y se
> le incorporo la extension de Pricing/Customer Service/Operaciones que antes vivia en
> `docs/requerimientos-pricing-customer-operaciones.md` (ese documento queda como historico).

---

## 1. Que es esto y por que existe

Monsa Global Cargo (MGC) es una empresa freight forwarder. Su equipo de customer service lleva
hoy toda la operacion — cotizaciones, bookings, embarques, pagos a proveedores y un dashboard
manual — en un archivo Excel: `REP_EMBARQUES_MGC26_DASHBOARD.xlsx`. Este proyecto reemplaza
ese Excel con un sistema web propio, sin perder ninguno de los campos ni catalogos que el
equipo ya usa a diario.

El Excel fue analizado a fondo, hoja por hoja y columna por columna, antes de escribir una
sola linea de codigo. Es la fuente de verdad del modelo de datos, de los catalogos maestros y
del contenido del dashboard. Ver la seccion 6 ("Hallazgos del Excel original") para el detalle
completo de ese analisis — justifica varias decisiones de diseno que de otra forma parecerian
arbitrarias.

## 2. Regla de negocio central: la cascada operativa

Este es el principio mas importante del sistema y debe respetarse en cualquier feature nueva.
**Ningun modulo puede avanzar si el anterior no esta completo.** Los "gates" ya implementados
en el backend (un `if` explicito al inicio del metodo de servicio correspondiente, en
`backend/src/modules/*/*.service.ts`) son **7**, en este orden:

1. **Gate cliente activo** — una cotizacion "en firme" (`esEstimado: false`) no se puede crear
   si el cliente no tiene `estatus = ACTIVO` (KYC + credito aprobados). `esEstimado` es un
   flag **solo de entrada** (no se persiste): un prospecto puede recibir un estimado, pero
   `marcarAceptada` re-ejecuta `verificarClienteActivo`, asi que la cotizacion no pasa a
   ACEPTADA hasta que el cliente este ACTIVO. Implementado en `clientes/cliente.service.ts`
   (`verificarClienteActivo`), llamado desde `cotizaciones/cotizacion.service.ts`.
2. **Gate cotizacion aceptada** — ni el Routing Order ni el Booking se crean si la cotizacion
   no esta en status `ACEPTADA`. Implementado en `routing-orders/routing-order.service.ts`
   (`crearRoutingOrder`) y en `bookings/booking.service.ts` (`crearBooking`).
3. **Gate Routing Order recibido** — un booking no se puede crear si la cotizacion no tiene un
   `RoutingOrder` en status `RECIBIDO`. Se **relaja por cliente**: si
   `Cliente.requiereRoutingOrder = false` el gate no aplica (embarques simples sin
   instrucciones formales). Implementado en `bookings/booking.service.ts` (`crearBooking`).
4. **Gate proveedor activo** — un booking no se puede crear si el proveedor no tiene
   `estatus = ACTIVO` (lo cual requiere al menos una tarifa cargada). Implementado en
   `proveedores/proveedor.service.ts` (`verificarProveedorActivo`), llamado desde
   `bookings/booking.service.ts`.
5. **Gate booking confirmado** — el folio de shipment (formato `MGC26000001`, igual que el
   Excel) solo se genera cuando el booking esta en status `CONFIRMADO`. Esto es intencional:
   en el Excel original se reservaba el folio de golpe para 200 filas aunque solo ~15
   correspondieran a embarques reales, mezclando reservas con embarques reales en la misma
   tabla. Aqui el folio nace en el momento correcto. Implementado en
   `shipments/shipment.service.ts` (`crearShipment`).
6. **Gate valorizacion confirmada** — no se genera **ninguna** factura (proforma ni final)
   si el shipment no tiene `valorizacionConfirmada = true` (costo y venta reales confirmados
   por Ventas via `PATCH /api/shipments/:id/valorizacion`). Implementado en
   `facturacion/factura.service.ts` (`crearFactura`).
7. **Gate shipment cerrado** — una factura **FINAL** exige un shipment en status
   `PARA_FACTURAR` (que solo se alcanza al cerrar el embarque, `cerrarShipment`). Una factura
   **PROFORMA** salta este gate: se pide durante el seguimiento, no timbra, no genera cuenta
   por cobrar ni mueve el status del shipment. Implementado en
   `facturacion/factura.service.ts` (`crearFactura`).

**Ciclo fiscal de la Factura (no es un gate nuevo, es la consecuencia del gate 7):** una
factura **FINAL** nace en `estatus = BORRADOR` — capturable y revisable, sin efecto en
Finanzas todavia — pasa a `PENDIENTE_TIMBRADO` con `PATCH /:id/enviar-timbrado` (se congela:
`actualizarFactura` y `actualizarConceptos` ya no aceptan cambios) y solo al timbrarse
(`PATCH /:id/timbrar`, `marcarTimbrada`) nace su `CuentaPorCobrar` y el Shipment pasa a
`FACTURADO`. Antes de este cambio la CxC nacia junto con la factura; con un borrador real eso
ya no es correcto (ver `docs/superpowers/specs/2026-09-04-facturacion-contable-design.md`).
Una **PROFORMA** se queda siempre en `BORRADOR`: no timbra, no tiene sentido "enviar a
timbrado".

**Soft-check de cierre (NO es gate, no bloquea):** `cerrarShipment` devuelve
`divergenciaMargen` — la diferencia entre el margen valorizado (`valorizacionVenta -
valorizacionCompra`) y el estimado de la cotizacion (`montoVenta - montoCompra`). Si
`|delta| > max(10% del estimado, 50)`, `alerta = true` y la UI de Embarques muestra un aviso
al cerrar. No impide cerrar: el dictado de Customer Service pedia advertencia, no bloqueo.

La cascada tambien se aplica a la **edicion** (seccion 10), a la **generacion de documentos**
(seccion 9) y al **borrado de la ultima tarifa de un proveedor activo** (seccion 4.5).

Si agregas una operacion nueva que salta una etapa de la cascada, esta mal disenada — revisa
primero si falta un gate antes de escribir el endpoint.

## 3. Stack tecnico

- **Backend**: Node.js + Express + TypeScript. Arquitectura de monolito modular (un folder por
  dominio de negocio, no microservicios — ver seccion 4).
- **Base de datos**: **MySQL 8**, instalado directamente en la maquina de desarrollo (sin
  Docker — decision explicita del cliente). Accedida via Prisma ORM. La cadena de conexion se
  configura en `backend/.env` (ver seccion 7).
- **Validacion de entrada**: Zod, un schema por modulo (`<nombre>.schema.ts`).
- **Autenticacion**: `bcryptjs` (hash de contrasenas) + `jsonwebtoken` (JWT con el rol dentro).
  Ver seccion 11.
- **Documentos PDF**: `pdf-lib` — JS puro, sin binarios. La justificacion de por que NO se uso
  puppeteer esta escrita en el encabezado de `backend/src/modules/reportes/reporte.pdf.ts`.
- **Libro de Excel**: `exceljs` — misma justificacion que pdf-lib (JS puro, sin binarios).
  Usado solo para `GET /api/reportes/facturacion/excel` (seccion 9).
- **Correo saliente**: `nodemailer`, detras de `backend/src/shared/mailer.ts`. Sin credenciales
  en el repo: si faltan las variables SMTP, el envio falla con un mensaje explicito.
- **Frontend**: React + Vite + TypeScript + Tailwind CSS. TanStack Query para data fetching y
  cache, React Router para navegacion, `lucide-react` para iconografia (liviano, tree-shakeable,
  se integra con las clases de Tailwind sin CSS extra).
- **Paleta de marca**: navy `#0B3D5C`, teal `#1C7293`, amber `#F2A93B`. En `tailwind.config.js`
  cada uno tiene una escala 50-900 derivada del tono base, para fondos suaves y bordes tenues
  **sin meter colores ajenos a la marca**. Rojo (`rose`) y verde (`emerald`) estan reservados
  exclusivamente para el dato que lo amerita — perdida, vencido, cierre exitoso — nunca como
  decoracion.
- **Logotipo**: tres archivos. `frontend/src/assets/LogoMonsa.png` (PNG sin canal alfa, fondo
  casi blanco `#F4F4F4`) en la cabecera de los documentos imprimibles.
  `frontend/src/assets/LogoMonsaTransparente.png` — misma imagen que `LogoMonsa.png` pero con
  canal alfa real (fondo quitado por umbral de color, sin libreria de imagenes: script
  descartable, no versionado) — usado en el **sidebar** para que no se vea el rectangulo casi
  blanco sobre el fondo `bg-white` del sidebar. `frontend/src/assets/LogoMonsaPNG.png` (PNG
  RGBA, con el wordmark "MONSA GLOBAL CARGO" y un halo de color de fondo) encabeza el
  **login**, sobre la tarjeta navy. `backend/assets/logoMonsa.png` es la copia a 520 px de
  `LogoMonsa.png` para los PDF — ver seccion 9.
- **Sidebar, Topbar y login (rediseno):** el `<Sidebar>` es **blanco** (`bg-white` +
  `border-r`), con el logotipo grande y centrado arriba (`h-20`, `justify-center`) — no una
  franja pequena a la izquierda — seguido de logo + navegacion agrupada ("Operacion" /
  "Administracion"), sin numeros de paso — el orden de `lib/navegacion.ts` ya es el de la
  cascada, y el CascadeStepper de cada pagina ya comunica en que paso esta el usuario. Link
  activo con fondo `teal-50` + texto `teal-700` + un punto teal (no relleno solido). La sesion
  (avatar, nombre, rol, cerrar sesion) vive en `<Topbar>` (`components/Topbar.tsx`), una barra
  sticky arriba del contenido con un breadcrumb del modulo activo a la izquierda y el boton de
  tema (luna/sol) a la derecha — no en el fondo del sidebar. El `Login` es un fondo `#F4F6FB`
  con patron de puntos y dos tarjetas `rounded-3xl` flotantes lado a lado: izquierda navy con
  la textura `puerto-navy.jpg` muy velada + la lista de pasos del sistema; derecha blanca con
  el logo, `<h2>` "Bienvenidos" y el formulario (correo / contrasena con icono y ojo para
  ver/ocultar).
- **Ancho de contenido:** el area de trabajo (`<main>` dentro de `Layout` en `App.tsx`) usa
  `max-w-[1600px]` en vez del `max-w-7xl` original, para aprovechar pantallas anchas en las
  tablas de Facturacion/Embarques/Operaciones, que son las que mas columnas concentran.
- **Modo oscuro:** `tailwind.config.js` tiene `darkMode: "class"`. `frontend/src/lib/theme.tsx`
  expone `ThemeProvider`/`useTheme` (mismo patron que `lib/auth.tsx`): guarda `"claro"` /
  `"oscuro"` en `localStorage` (`mgc.tema`), cae a `prefers-color-scheme` si no hay nada
  guardado, y alterna la clase `dark` en `<html>`. Un `<script>` inline en la cabecera de
  `index.html` aplica esa clase ANTES de que React monte, para no parpadear del tema equivocado.
  El toggle vive en `<Topbar>` (icono luna/sol). Convencion de paleta oscura, aplicada a **todos**
  los componentes compartidos y a cada pagina (incluye las celdas de `<DataTable>` que fijaban
  su propio color de texto, ej. folios/nombres en negrita — un bug real de contraste que se
  encontro y corrigio durante el rollout, no solo un ajuste cosmetico):
  - fondo de la app → `dark:bg-slate-950`; superficies elevadas (tarjetas, sidebar, topbar,
    modales) → `dark:bg-slate-900`.
  - bordes → `dark:border-slate-800` (`dark:border-slate-700` en divisores/hover dentro de
    modales).
  - texto fuerte → `dark:text-slate-100`/`dark:text-slate-200`; texto tenue →
    `dark:text-slate-400`/`dark:text-slate-500` (UUIDs, fechas, metadatos).
  - chips/tiles suaves de color de marca (`bg-teal-50 text-teal-700`) →
    `dark:bg-teal-900/40 dark:text-teal-300` (mismo patron para navy/amber/emerald/rose/violet;
    `/20`-`/30` de opacidad en los avisos).
  - encabezados de tabla (`bg-slate-50`) → `dark:bg-slate-800/60`; `divide-slate-100` →
    `dark:divide-slate-800`.
  - Los documentos imprimibles (`<DocumentoImprimible>`) NO llevan modo oscuro: son reportes
    JasperReports en escala de grises, exentos del lenguaje visual de la app (seccion 4.2.1).

No se uso NestJS ni .NET porque el usuario pidio explicitamente Node + React + Tailwind.
Mantener esa decision salvo instruccion contraria explicita.

## 4. Estructura completa del proyecto

```
monsa-gestion/
├── AGENTS.md                    # Este archivo
│
├── docs/
│   ├── requerimientos-pricing-customer-operaciones.md   # HISTORICO: ya incorporado aqui
│   └── superpowers/specs/
│       ├── 2026-09-02-pricing-customer-operaciones-design.md
│       └── 2026-09-04-facturacion-contable-design.md
│
├── backend/
│   ├── package.json
│   ├── tsconfig.json
│   ├── .env.example             # DATABASE_URL, PORT, NODE_ENV, JWT_*, SMTP_*
│   ├── assets/
│   │   └── logoMonsa.png        # Logotipo a 520px, embebido en la cabecera de cada PDF
│   ├── prisma/
│   │   ├── schema.prisma        # Modelo de datos completo (seccion 5)
│   │   ├── migrations/          # ..._init, ..._finanzas_cuentas_por_cobrar,
│   │   │                        # ..._auth_usuario_password, ..._pricing_customer_operaciones,
│   │   │                        # ..._facturacion_contable, ..._catalogos_sat_cancelacion
│   │   ├── seed.ts              # Semilla con catalogos reales de la hoja LISTAS del Excel
│   │   └── importarCatalogosSat.ts # NUEVO — npm run seed:sat, catalogos SAT (seccion 5.5)
│   └── src/
│       ├── app.ts               # Ensambla todas las rutas Express + middlewares (+ requireAuth)
│       ├── server.ts            # Entry point (arranca en PORT, default 4000)
│       ├── config/prisma.ts     # Cliente Prisma singleton
│       ├── shared/
│       │   ├── limpiarEntrada.ts     # "" -> null, undefined -> omitir (usado por todos los PATCH)
│       │   ├── mailer.ts             # nodemailer; falla explicito si faltan las variables SMTP
│       │   ├── datosFiscalesEmisor.ts # NUEVO — constante EMISOR_CFDI (RFC/razon social de Monsa)
│       │   └── middleware/
│       │       ├── auth.ts           # requireAuth (JWT) + requireRol + firmarToken
│       │       └── errorHandler.ts   # ReglaDeNegocioError + asyncHandler
│       └── modules/
│           ├── auth/                # login JWT (seccion 11)
│           ├── clientes/            # cliente.schema/service/controller/routes.ts (+ datos fiscales)
│           ├── proveedores/         # idem
│           ├── tarifas/             # Pricing: CRUD de Tarifa + tipo de tarifa (seccion 4.5)
│           ├── cotizaciones/        # idem (incluye el routingOrder al leer)
│           ├── routing-orders/      # Routing Order / instrucciones del cliente (gate 3)
│           ├── bookings/            # idem
│           ├── shipments/           # idem (+ valorizacion, + campos de Operaciones)
│           ├── notificaciones/      # log de notificaciones al cliente (colgado de shipments)
│           ├── operaciones/         # tablero de seguimiento (solo lectura, seccion 4.6)
│           ├── facturacion/         # + tipo PROFORMA/FINAL, ciclo BORRADOR/.../TIMBRADA,
│           │                        #   conceptos (seccion 5.3/5.4)
│           ├── complementos-pago/   # NUEVO — REP de pagos, solo lectura + timbrado (seccion 5.4)
│           ├── catalogos-sat/       # NUEVO — solo lectura sobre las tablas Sat* (seccion 5.5)
│           ├── cuentas-por-pagar/   # submodulo de Finanzas
│           ├── cuentas-por-cobrar/  # submodulo de Finanzas (+ genera ComplementoPago al cobrar)
│           ├── reportes/            # documentos imprimibles + PDF + Excel (seccion 9)
│           │                        #   reporte.excel.ts (NUEVO, exceljs)
│           ├── usuarios/            # solo lectura (SELECT_USUARIO_PUBLICO)
│           └── dashboard/           # solo lectura (+ avisos-arribo-pendientes)
│
└── frontend/
    └── src/
        ├── main.tsx              # QueryClientProvider + BrowserRouter + AuthProvider
        ├── App.tsx               # <RutaProtegida> + layout. Rutas: /login, /, /contactos,
        │                         #  /pricing, /cotizaciones, /bookings, /embarques,
        │                         #  /operaciones, /finanzas[/:submodulo], /reportes,
        │                         #  /documentos/:entidad/:id/:tipo (vista imprimible, fuera del layout)
        ├── index.css             # Directivas Tailwind + reglas @media print (seccion 9)
        ├── assets/               # LogoMonsa.png, LogoMonsaTransparente.png (sidebar),
        │                         #   LogoMonsaPNG.png (login), puerto-navy.jpg
        ├── lib/
        │   ├── api.ts            # axios + interceptores (Bearer, 401 -> logout) + abrirPdf()
        │   │                     #   + descargarArchivo() (NUEVO, para el libro de Excel)
        │   ├── auth.tsx          # AuthProvider / useAuth (token en localStorage, valida con /auth/yo)
        │   ├── documentos.ts     # Tipos espejo de modules/reportes + constructores de URL
        │   ├── navegacion.ts     # NUEVO — GRUPOS_NAV unico, usado por Sidebar y Topbar
        │   └── format.ts         # dinero/dineroCompacto/fecha/fechaInput/numeroInput/texto/etiqueta
        ├── components/
        │   ├── Sidebar.tsx        # Solo logo + navegacion agrupada, sin numeros de paso
        │   ├── Topbar.tsx         # NUEVO — breadcrumb del modulo activo + sesion (cerrar sesion)
        │   ├── DataTable.tsx      # Tabla generica + columna de acciones Ver/Editar (seccion 10)
        │   ├── DetalleDrawer.tsx  # Panel lateral de solo lectura con TODOS los campos ("Ver")
        │   ├── FormularioEdicion.tsx # Formulario declarativo por descriptores ("Editar")
        │   ├── DocumentoImprimible.tsx / EnviarCorreoModal.tsx
        │   ├── EstatusMaterialTimeline.tsx # Stepper visual del estatus del material (seccion 4.6)
        │   ├── ComboboxCatalogoSat.tsx # NUEVO — autocompletado sobre ClaveProdServ/ClaveUnidad
        │   ├── CancelarCfdiModal.tsx   # NUEVO — cancelacion, compartido Factura/ComplementoPago
        │   ├── StatusBadge.tsx / PageHeader.tsx / Card.tsx / Button.tsx / Tooltip.tsx
        │   ├── Aviso.tsx / Field.tsx / Modal.tsx / SegmentedControl.tsx
        │   ├── CascadeStepper.tsx    # Stepper de la cascada (6 nodos: incluye "Routing Order")
        │   └── KpiCard.tsx
        └── pages/
            ├── Login.tsx / Dashboard.tsx / Contactos.tsx  # Contactos: + datos fiscales del cliente
            ├── Pricing.tsx        # CRUD de tarifas de compra + tipo de tarifa (seccion 4.5)
            ├── Cotizaciones.tsx   # cotizacion en firme + aceptacion + Routing Order (modal)
            ├── Bookings.tsx       # creacion (bloquea sin Routing Order RECIBIDO) + confirmacion
            ├── Embarques.tsx      # creacion, cierre, documentacion MBL/HBL, carta,
            │                      #  valorizacion (modal), notificaciones (modal), revalidacion/BL
            ├── Operaciones.tsx    # tablero de seguimiento + tracking (timeline) + notificaciones
            ├── Finanzas.tsx       # shell con 4 submodulos (tabs internas)
            ├── Reportes.tsx       # catalogo de documentos con su disponibilidad
            ├── reportes/VistaDocumento.tsx
            └── finanzas/
                ├── CuentasPorPagar.tsx
                ├── CuentasPorCobrar.tsx     # + forma de pago / num. operacion al cobrar
                ├── FacturacionPanel.tsx     # PROFORMA/FINAL, ciclo BORRADOR/.../TIMBRADA,
                │                            #  editor de conceptos, exportar a Excel
                └── ComplementosPago.tsx     # NUEVO — solo lectura + timbrado simulado
```

### 4.1 Patron de modulo en el backend

Cada modulo del backend sigue siempre el mismo patron de 4 archivos:

- **`<nombre>.schema.ts`** — validacion Zod de los inputs. Nunca se valida a mano en el controller.
- **`<nombre>.service.ts`** — toda la logica de negocio y los gates. Es el UNICO lugar del
  modulo que llama a `prisma`.
- **`<nombre>.controller.ts`** — adapta `Request`/`Response`. Parsea con el schema, llama al
  service, regresa JSON. Sin logica de negocio.
- **`<nombre>.routes.ts`** — registra los endpoints Express envueltos con `asyncHandler`.

Los modulos `routing-orders`, `notificaciones` y `complementos-pago` siguen este patron;
`notificaciones` SI recibe body (no es de solo lectura) y su router se monta con `mergeParams`
bajo `/api/shipments/:id/notificaciones` desde `shipment.routes.ts`. `complementos-pago` no
tiene `POST` propio: nace desde `cxc.service.registrarCobro` (seccion 5.4), su router solo
expone lectura + las dos transiciones de estatus. Los unicos sin schema Zod son `dashboard`,
`usuarios` y `operaciones` (solo lectura, no reciben body).

Todo PATCH de edicion pasa su input por `limpiarEntrada()` antes de tocar Prisma: el frontend
manda el registro completo, asi que un campo vaciado llega como `""` y debe escribirse como
`null`, no como cadena vacia.

### 4.2 Patron de pagina en el frontend

Cada pagina sigue el patron de `Contactos.tsx` / `Cotizaciones.tsx`:

1. `<PageHeader>` con titulo, subtitulo y (si aplica) UNA sola accion primaria.
2. `<CascadeStepper>` en las paginas operativas, con `nota` de que falta para avanzar.
3. `useQuery` de TanStack Query para listar (`queryKey` = nombre del recurso).
4. `<DataTable>` generico, columnas inline; `alinear: "der"` para numeros, `renderDetalle` en
   vez de comprimir 10 columnas.
5. Formulario simple o `<Modal>` para creacion/transicion de estado, con `<Field>` +
   `<TextInput>` / `<Select>` y `<Button>`.
6. `useMutation` + `queryClient.invalidateQueries`; los errores de negocio se muestran tal cual,
   extraidos con `mensajeError()` de `lib/api.ts`.
7. `<StatusBadge>` para cualquier campo `status`/`estatus`.
8. Acciones de fila (`onVer` / `onEditar` / `accionesExtra`) via `<DataTable>` (seccion 10).

### 4.2.1 Lenguaje visual (obligatorio para pantallas nuevas)

- **Superficie**: `rounded-xl` + `border border-slate-200/80` + `shadow-tarjeta`. Sin bordes
  gruesos, sombras duras ni gradientes.
- **Fondo de la app**: `bg-lienzo` (`#F5F7FA`).
- **Jerarquia**: etiqueta en `text-etiqueta` mayusculas (`text-slate-500`), valor dominante
  grande y `tabular` cuando es numero, contexto en `text-xs text-slate-500`.
- **Iconos**: `lucide-react`, `size={14..19}`, `strokeWidth` 1.9-2.2. Cada KPI, cada `<Card>` y
  cada accion de fila lleva uno.
- **Color**: solo la paleta de marca. Rojo/verde solo para perdida, vencimiento o cierre.
- **Numeros en tablas**: columnas con `alinear: "der"` (el `<DataTable>` les aplica `tabular` y
  `whitespace-nowrap`).
- **Excepcion**: los documentos imprimibles (`<DocumentoImprimible>`) NO siguen este lenguaje
  (son reportes JasperReports en escala de grises, seccion 9).

### 4.3 Modulo unico de Contactos (decision de UI)

`Clientes` y `Proveedor` se fusionaron en una sola pagina (`/contactos`) con un
`<SegmentedControl>`. **El backend NO se fusiono**: `Cliente` y `Proveedor` siguen siendo
entidades, endpoints y gates separados. El toggle se refleja en la URL (`?tipo=proveedores`).

### 4.4 Modulo Finanzas (4 submodulos)

`/finanzas/:submodulo`:
- **Cuentas por pagar** (`cuentas-por-pagar`) — lo que Monsa debe a proveedores. Modelo
  `CuentaPorPagar`.
- **Cuentas por cobrar** (`cuentas-por-cobrar`) — lo que el cliente debe a Monsa. Modelo
  `CuentaPorCobrar` (seccion 5.1). El formulario de cobro captura tambien forma de pago y
  numero de operacion: alimentan el `ComplementoPago` que nace solo si la factura es PPD.
- **Facturacion** (`facturacion`) — el modulo `Factura`, con tipo PROFORMA / FINAL, ciclo
  fiscal BORRADOR/PENDIENTE_TIMBRADO/TIMBRADA, editor de `ConceptoFactura` y boton "Exportar a
  Excel" (seccion 5.3, seccion 9).
- **Complementos de pago** (`complementos-pago`) — el REP de pagos. Solo lectura + acciones de
  timbrado: nace automaticamente, nunca por alta manual (seccion 5.3).

## 4.5 Modulo Pricing (catalogo de tarifas de compra)

Pagina `/pricing`, modulo backend `tarifas` (patron completo de 4 archivos). Vista transversal
del modelo `Tarifa`.

- `GET /api/tarifas?proveedorId=&modalidad=&tipo=&soloVigentes=` — lista con el proveedor
  incluido y un campo derivado `vigente`. "VIGENTE / PROGRAMADA / VENCIDA" no se persiste.
- `POST /api/tarifas` — `proveedorId` en el body. Tambien sigue funcionando
  `POST /api/proveedores/:id/tarifas`.
- `PATCH /api/tarifas/:id` — el proveedor no se reapunta.
- `DELETE /api/tarifas/:id` — bloquea borrar la ultima tarifa de un proveedor `ACTIVO` (es lo
  que exige el gate 4 para activarlo).
- **Tipo de tarifa** (`Tarifa.tipo`, enum `TipoTarifa`): `CONTRATO` (fija por vigencia
  negociada), `SPOT` (puntual), `BASKET` (escalonada por producto/volumen). Default `CONTRATO`.
  Clasifica el origen del precio; no cambia como se cotiza. La pagina lo muestra como columna
  con `<StatusBadge>` y como filtro.

No es un paso de la cascada; en el sidebar va en el grupo "Operacion", entre Contactos y
Cotizaciones.

## 4.6 Modulo Operaciones (tablero de seguimiento)

Pagina `/operaciones`, modulo backend `operaciones` (solo lectura). El alta y el cierre siguen
en `/embarques`.

- `GET /api/operaciones?status=&customerServiceId=` — shipments activos con campos calculados
  al leer (nunca persistidos): `diasEnPuerto`, `diasParaEta`, `atrasado`,
  `avisoLlegadaPendiente` (ETA dentro de 10 dias, sin arribo real y **sin ninguna
  `NotificacionEnviada` de tipo `AVISO_ARRIBO`** — el log de notificaciones apaga la alerta).
  Incluye tambien el log `notificaciones`.
- `GET /api/operaciones/resumen` — KPIs.
- La escritura del tracking reusa `PATCH /api/shipments/:id/tracking`. El modal de tracking usa
  `<EstatusMaterialTimeline>` (`components/EstatusMaterialTimeline.tsx`): un stepper clickeable
  de etapas estandar (maritimo: POR ZARPAR → EN TRANSITO → EN PUERTO → LIBERADO → ENTREGADO;
  terrestre: POR CARGAR → EN TRANSITO → ENTREGADO) que escribe `Shipment.estatusMaterial`
  (sigue siendo texto libre), con un campo "Detalle / otro" para valores fuera de las etapas y
  una sugerencia derivada de las fechas. Las tablas muestran `<ProgresoMaterial>` (etiqueta +
  "X/N"). En `Embarques.tsx` el mismo campo es un `<select>` de esas etapas
  (`opcionesEstatusMaterial`).
- Accion de fila "Notificar" — registra una `NotificacionEnviada` (mismo endpoint que Embarques,
  ver seccion 5.2).

En el sidebar va despues de Embarques, sin numero de paso.

## 5. Modelo de datos completo

Definido en `backend/prisma/schema.prisma`, sobre MySQL. **25 modelos, 18 enums** (8 de los
modelos son catalogos oficiales del SAT de solo lectura, ver seccion 5.5).

### Enums (18)

Migrados de la hoja `LISTAS` del Excel salvo los marcados *(nuevo)*:

- `TipoOperacion`: IMPORTACION, EXPORTACION, TERRESTRE
- `ModalidadCarga`: FCL, LCL, AEREO, TERRESTRE, FTL, LTL, SEGURO
- `StatusShipment`: NUEVO_EMBARQUE, BOOKING_CONFIRMED, PARA_CERRAR, PARA_FACTURAR, FACTURADO,
  CANCELADO, TERMINADO
- `StatusCotizacion`: BORRADOR, ENVIADA, ACEPTADA, RECHAZADA, EXPIRADA
- `StatusBooking`: SOLICITADO, CONFIRMADO, CANCELADO
- `TipoProveedor`: NAVIERA, AEROLINEA, COLOADER, AGENTE_ADUANAL, TRANSPORTISTA, ALMACEN,
  SEGURO, OTRO
- `EstatusCliente`: PROSPECTO, EN_VALIDACION_KYC, ACTIVO, SUSPENDIDO
- `EstatusProveedor`: EN_HOMOLOGACION, ACTIVO, SUSPENDIDO
- `EstatusCobro`: PENDIENTE, PARCIAL, COBRADA, VENCIDA — ver seccion 5.1
- `RolUsuario`: VENTAS, OPERACIONES, CUSTOMER_SERVICE, FINANZAS, CONTABILIDAD, ADMIN
- `TipoTarifa` *(nuevo)*: CONTRATO, SPOT, BASKET — ver seccion 4.5
- `StatusRoutingOrder` *(nuevo)*: SOLICITADO, RECIBIDO — ver seccion 5.2
- `TipoServicioEntrega` *(nuevo)*: CY_PUERTO, DENTRO_BL_RAIL, DENTRO_BL_TRUCK, FUERA_BL_CAMION,
  RAM — ver seccion 5.2
- `EstatusEmisionBL` *(nuevo)*: DRAFT, FINAL — estado de emision de un HBL/MBL en `Documento`
  (antes era texto libre `emisionHbl`/`emisionMbl`, se reemplazo)
- `TipoNotificacion` *(nuevo)*: CUTOFF_DOCUMENTAL, CUTOFF_CONTENEDOR, ETD, ETA, AVISO_ARRIBO,
  SOLICITUD_FACTURA, OTRO — ver seccion 5.2
- `TipoFactura` *(nuevo)*: PROFORMA, FINAL — ver seccion 5.3
- `EstatusDocumentoFiscal` *(nuevo)*: BORRADOR, PENDIENTE_TIMBRADO, TIMBRADA, CANCELADA —
  ciclo compartido por `Factura` y `ComplementoPago`, ver seccion 5.3
- `MetodoPagoCfdi` *(nuevo)*: PUE, PPD — ver seccion 5.3

### Entidades (17)

`Usuario`, `Cliente`, `Proveedor`, `Tarifa`, `Cotizacion`, `RoutingOrder` *(nuevo)*, `Booking`,
`Shipment`, `NotificacionEnviada` *(nuevo)*, `Documento`, `Contenedor`, `CostoDemora`,
`CuentaPorPagar`, `Factura`, `ConceptoFactura` *(nuevo)*, `ComplementoPago` *(nuevo)*,
`CuentaPorCobrar`.

- **`Usuario`** — nombre, email, rol, `passwordHash` (nullable, bcrypt, NUNCA se expone — ver
  seccion 8 y 11). Relaciones: vendedor en `Cotizacion`, customer service en `Shipment`, autor
  en `NotificacionEnviada`.
- **`Cliente`** — razonSocial, alias, rfc, `estatus` (gate 1), limiteCredito, diasCredito,
  datos de contacto, **`requiereRoutingOrder` (Boolean, default true)** — escape hatch del
  gate 3. **Datos fiscales del receptor** *(nuevo)*: `regimenFiscal?`, `usoCfdi?`,
  `codigoPostal?` — se copian ("snapshot") a la `Factura` al emitirla, ver seccion 5.3.
- **`Proveedor`** — nombre, `tipo`, `estatus` (gate 4), datos de contacto. Tiene `Tarifa[]`,
  `Booking[]`, `CuentaPorPagar[]` y `routingOrdersComoAgente RoutingOrder[]`.
- **`Tarifa`** — `proveedorId`, origen, destino, `modalidad`, **`tipo` (`TipoTarifa`, default
  `CONTRATO`)**, montoCompra, moneda, vigenteDesde, vigenteHasta?.
- **`Cotizacion`** — folio propio (`COT26xxxxxx`), FK a Cliente y a Usuario (vendedor),
  incoterm, modalidad, origen, destino, `montoVenta` vs `montoCompra` (obligatorios: el margen
  **estimado** nace aqui), moneda, `status` (`ACEPTADA` = gate 2), validaHasta?. Relacion 1:1
  `routingOrder RoutingOrder?`.
- **`RoutingOrder`** *(nuevo)* — 1:1 con `Cotizacion`. `status` (`StatusRoutingOrder`),
  `shipperNombre?`, `shipperDireccion?`, `pol?`, `pod?`, `destinoFinal?`,
  `tipoServicioEntrega?` (`TipoServicioEntrega`), `especificaciones? @db.Text`, `agenteId?`
  (FK a `Proveedor`, el agente que el vendedor indica a Customer Service), `fechaSolicitud`,
  `fechaRecibido?`. El consignee NO se duplica: es `cotizacion.cliente`. `status = RECIBIDO`
  es lo que abre el gate 3.
- **`Booking`** — 1:1 con Cotizacion, FK a Proveedor (naviera/coloader principal), `referencia`
  (SO number), `status` (`CONFIRMADO` = gate 5), confirmadoEn?.
- **`Shipment`** — 1:1 con Booking, folio `MGC26xxxxxx`. Campos operativos tomados 1:1 de
  `MONSA26`: tipoOperacion, modalidad, `status`, estatusMaterial, consignee (FK a Cliente),
  shipperNombre, customerService (FK a Usuario), incoterm, `poCliente` (columna "PO" del
  Excel), vessel, voyage, puertoOrigen, paisOrigen, puertoDestino, destinoFinal, etd, eta,
  fechaArriboReal, fechaLiberacion, grossWeight, cbm, totalItems. **Campos nuevos:**
  - `expedienteFisico` (Boolean, default false) — columna "INDICAR SI HAY EXPEDIENTE" del Excel.
  - `valorizacionVenta?` / `valorizacionCompra?` (Decimal) — costo y venta REALES confirmados
    por Ventas, distintos del estimado de la cotizacion.
  - `valorizacionConfirmada` (Boolean, default false) + `valorizacionConfirmadaEn?` — gate 6.
  - `fechaRevalidacionNaviera?`, `blEndosadoEnviado` (Boolean, default false),
    `fechaBlEndosadoEnviado?` — seguimiento de Operaciones (revalidacion + envio de BL endosado).
  - Relacion 1:N `facturas Factura[]` (antes 1:1) y `notificaciones NotificacionEnviada[]`.
- **`NotificacionEnviada`** *(nuevo)* — N:1 con `Shipment`. `tipo` (`TipoNotificacion`),
  `fechaEnviada` (default now), `enviadoPorId?` (FK a `Usuario`, del token JWT), `comentario?
  @db.Text`. Es un **log**: no se edita ni se borra. Reemplaza la idea de un unico booleano
  "aviso enviado" que nunca llego a existir en el schema.
- **`Documento`** — 1:1 con Shipment. mbl, hbl, manifiesto, **`estatusEmisionHbl?` /
  `estatusEmisionMbl?` (`EstatusEmisionBL`)** (antes texto libre `emisionHbl`/`emisionMbl`,
  reemplazados; permite alertar cuando un BL sigue en DRAFT), cartaInstruccionesUrl.
- **`Contenedor`** — 1:N desde Shipment. numero, tipo, sello.
- **`CostoDemora`** — 1:N desde Shipment. diasDemora, costoDemora, ventaDemoraSinIva.
- **`CuentaPorPagar`** — modela la hoja `CONTROL DE PAGOS`. FK real a Shipment y Proveedor.
  numeroFactura, monto, moneda, fechaSolicitud, fechaLimitePago, fechaPagoConfirmado,
  esGarantia, comentarios. El "estatus" se deriva de las fechas, no se persiste.
- **`Factura`** — ver seccion 5.3.
- **`CuentaPorCobrar`** — ver seccion 5.1.

### 5.1 `CuentaPorCobrar`

Modelo aparte (1:1 con `Factura`, FK tambien a `Cliente`): `monto`, `moneda`, `montoCobrado`
(default 0), `fechaEmision`, `fechaVencimiento?`, `fechaCobro?`, `estatusCobro` (`EstatusCobro`),
`comentarios?`. Separado de `Factura` por simetria con `CuentaPorPagar`, porque `Factura`
modela el CFDI y la cobranza es un proceso operativo con su propio ciclo, y para soportar
cobros parciales (`montoCobrado` acumula). **Nace automaticamente al generar la factura FINAL**
(`factura.service.crearFactura` -> `cxc.service.crearDesdeFactura`) y hereda `diasCredito` del
cliente para `fechaVencimiento`. `VENCIDA` no se persiste: se deriva al leer. Una factura
PROFORMA **no** genera cuenta por cobrar.

Endpoints: `GET /api/cuentas-por-cobrar?estado=&clienteId=`, `GET .../resumen`,
`PATCH .../:id/cobrar` (body `{ monto, fechaCobro?, comentarios? }`).

### 5.2 `RoutingOrder` y `NotificacionEnviada` (endpoints)

**Routing Order** (`modules/routing-orders/`):
- `GET /api/routing-orders?cotizacionId=&status=`, `GET /api/routing-orders/:id`
- `POST /api/routing-orders` — gate 2 (cotizacion ACEPTADA). Rechaza si ya existe RO para esa
  cotizacion.
- `PATCH /api/routing-orders/:id` — editable solo mientras `status = SOLICITADO`.
- `PATCH /api/routing-orders/:id/recibir` — pasa a `RECIBIDO` + `fechaRecibido = now()`. Es lo
  que abre el gate 3.
- En el frontend vive dentro de `Cotizaciones.tsx` (accion de fila "Routing Order" sobre una
  cotizacion ACEPTADA, abre un modal). `Bookings.tsx` bloquea "Crear booking" con tooltip
  cuando la cotizacion elegida no tiene RO `RECIBIDO` (y el cliente lo requiere).

**Notificaciones** (`modules/notificaciones/`), colgado de shipments:
- `GET /api/shipments/:id/notificaciones`
- `POST /api/shipments/:id/notificaciones` (body `{ tipo, comentario? }`; `enviadoPorId` sale
  del token). Es un log — sin PATCH ni DELETE.
- En el frontend: accion de fila "Notificar" en `Embarques.tsx` y `Operaciones.tsx`, y el log
  se ve en el `DetalleDrawer` de ambas.

### 5.3 `Factura` (tipo PROFORMA / FINAL, ciclo fiscal completo)

Ver `docs/superpowers/specs/2026-09-04-facturacion-contable-design.md` para el diseno completo
(pedido explicito del usuario: "todo lo que un contador debe requerir" — borrador antes del
timbrado, datos CFDI completos, complemento de pago, exportacion a Excel).

- `shipmentId` **no es `@unique`**: la restriccion es `@@unique([shipmentId, tipo])`, asi que
  un embarque puede tener a lo sumo **una PROFORMA y una FINAL**. `Shipment.facturas
  Factura[]`.
- `tipo` (`TipoFactura`, default `FINAL`), numeroFactura (`@unique`), `estatus`
  (`EstatusDocumentoFiscal`, default `BORRADOR`, reemplaza el antiguo `estatusPac: String?`),
  cfdiUuid?, montoSinIva (= suma de sus `conceptos`), moneda, fechaTimbrado?.
- **Datos fiscales CFDI** *(nuevo)*: `regimenFiscalReceptor?`, `usoCfdi?`,
  `codigoPostalReceptor?` (snapshot del `Cliente` al momento de facturar — un CFDI ya
  generado no cambia si luego se edita el cliente), `formaPago?`, `metodoPago`
  (`MetodoPagoCfdi`, default `PUE`), `condicionesPago?`, `tipoCambio?`, `retencionIvaTasa?`,
  `retencionIsrTasa?` (retenciones a nivel factura, no por concepto — ver "fuera de alcance"
  del spec).
- **Emisor**: constante en `backend/src/shared/datosFiscalesEmisor.ts` (`EMISOR_CFDI`) — RFC,
  razon social, regimen fiscal y CP de Monsa. `ASUNCION`: datos ficticios hasta contar con el
  RFC real. Un solo emisor no justifica un modelo propio.
- **PROFORMA**: serie propia `MGC-PROF-000001` (no consume la serie fiscal `MGC-FACT-`), se
  queda **siempre en `BORRADOR`** (no tiene "enviar a timbrado" ni timbra —
  `marcarTimbrada`/`enviarATimbrado` la rechazan), no crea `CuentaPorCobrar`, no mueve el
  status del shipment. Solo exige el gate 6 y que el shipment este en seguimiento activo.
  Editable siempre.
- **FINAL**: `BORRADOR` → (`PATCH /:id/enviar-timbrado`) → `PENDIENTE_TIMBRADO` → (`PATCH
  /:id/timbrar`) → `TIMBRADA`. Exige gates 6 y 7 **al crearse** (queda en BORRADOR); la
  `CuentaPorCobrar` nace y el Shipment pasa a `FACTURADO` recien al **timbrarse**
  (`marcarTimbrada`), no al crearse — antes de este cambio nacian juntas, pero un borrador en
  revision no debe generar cartera. Editable **solo en BORRADOR**
  (`actualizarFactura`/`actualizarConceptos` lo exigen).
- `PUT /api/facturas/:id/conceptos` — reemplaza las lineas del CFDI (ver 5.4) y recalcula
  `montoSinIva`. Solo mientras `BORRADOR`.
- `resumenFacturacion` cuenta el monto facturado solo sobre las FINAL **ya `TIMBRADA`**
  (una `CANCELADA` no cuenta: el CFDI quedo sin efecto); expone `proformas`,
  `pendientesTimbrado` (BORRADOR + PENDIENTE_TIMBRADO, sin contar canceladas) y `canceladas`.
- **Cancelacion** (`PATCH /api/facturas/:id/cancelar`, solo desde `TIMBRADA` → `CANCELADA`,
  simulada): exige `motivoCancelacion` (clave del catalogo `SatMotivoCancelacion`, seccion
  5.5) y, si el motivo es "01 — con relacion", `folioSustitucionUuid` (el UUID del CFDI que
  sustituye a este). Guarda `motivoCancelacion`, `folioSustitucionUuid?`, `fechaCancelacion`.
  **No revierte** la `CuentaPorCobrar` ni el status del `Shipment`: el impacto contable de
  cancelar un CFDI ya emitido (cobros parciales, nota de credito, etc.) es una decision del
  contador, no algo que el sistema resuelva solo — la UI lo advierte. **Bloqueada** si la
  factura tiene algun `ComplementoPago` que no este ya `CANCELADA` (hay que cancelar esos
  primero: no se deja un REP apuntando a una factura cancelada).

### 5.4 `ConceptoFactura` y `ComplementoPago` *(nuevo)*

- **`ConceptoFactura`** — 1:N con `Factura`. Una linea del CFDI: `claveProdServ`,
  `claveUnidad`, `unidad?`, `cantidad`, `descripcion`, `valorUnitario`, `importe` (calculado
  en el service, nunca confiado del cliente), `objetoImpuesto`, `ivaTasa`, `ivaImporte`
  (calculado). Al generar la factura por el flujo rapido (un monto) nace **un concepto
  automatico**; en BORRADOR se edita/parte en varias lineas desde `FacturacionPanel.tsx`
  (`EditorConceptos`), buscando `claveProdServ`/`claveUnidad` en el catalogo oficial del SAT
  con `<ComboboxCatalogoSat>` (seccion 5.5) — ya no se escriben a mano.
- **`ComplementoPago`** — 1:N con `Factura`. El REP de pagos. **Nace solo desde
  `cuentas-por-cobrar/cxc.service.registrarCobro`**, nunca por alta manual, cuando la factura
  relacionada es `FINAL` + `TIMBRADA` + `metodoPago = PPD` (un cobro contra una `PUE` no
  genera complemento: ya esta saldada en el CFDI original). Campos: `folio`
  (`MGC-PAGO-000001`), `fechaPago`, `monto`, `moneda`, `tipoCambio?`, `formaPago`,
  `numOperacion?`, `saldoAnterior`, `saldoInsoluto`, `estatus` (mismo
  `EstatusDocumentoFiscal`), `cfdiUuid?`, `fechaTimbrado?`, y la misma terna de cancelacion
  (`motivoCancelacion?`, `folioSustitucionUuid?`, `fechaCancelacion?`). Mismas acciones que
  Factura: `PATCH .../enviar-timbrado`, `.../timbrar`, `.../cancelar` (solo desde `TIMBRADA`).
  Pagina de solo lectura + acciones: `Finanzas → Complementos de pago`.

### 5.5 Catalogos oficiales del SAT (CFDI 4.0)

8 modelos de solo lectura, poblados por `backend/prisma/importarCatalogosSat.ts`
(`npm run seed:sat` — **no** forma parte de `npm run seed`: son ~55,000 filas de datos de
referencia, no cambian en el dia a dia y descargarlos en cada resembrado dependeria de
internet en un flujo que hoy es local, AGENTS.md seccion 7):

- `SatClaveProdServ` (~52,500 filas: `clave`, `descripcion`, `palabrasSimilares?`) y
  `SatClaveUnidad` (~2,400: `clave`, `nombre`, `simbolo?`) — se consultan por texto
  (`LIKE`, sin FULLTEXT) desde `GET /api/catalogos-sat/clave-prod-serv?q=` y
  `.../clave-unidad?q=`, maximo 20 resultados. El frontend los busca con
  `<ComboboxCatalogoSat>` (`components/ComboboxCatalogoSat.tsx`): un input con
  autocompletado, no un `<select>` (inviable con ese volumen).
- `SatRegimenFiscal`, `SatUsoCfdi`, `SatFormaPago`, `SatMoneda`, `SatObjetoImp` — catalogos
  chicos (3 a 178 filas), se listan completos (`GET /api/catalogos-sat/<nombre>`) y alimentan
  `<select>` normales en Contactos (regimen/uso CFDI del cliente), FacturacionPanel (moneda,
  forma de pago) y CuentasPorCobrar (forma de pago del cobro).
- `SatMotivoCancelacion` — las 4 claves fijas del manual de cancelacion de CFDI del SAT
  (01-04, sin cambios desde 2018). **No viene del mismo mirror que los demas**: se siembra a
  mano dentro de `importarCatalogosSat.ts` (documentado ahi). Alimenta
  `<CancelarCfdiModal>` (`components/CancelarCfdiModal.tsx`, compartido por Factura y
  ComplementoPago).
- **Fuente**: mirror comunitario que sincroniza en tiempo real desde el SAT
  (`github.com/bambucode/catalogos_JSON_CFDI`, rama `cfdi-4.0`) — mismo enfoque que usan
  librerias conocidas del ecosistema CFDI mexicano (`phpcfdi/resources-sat-catalogs`). El
  import borra e inserta de nuevo cada tabla (no upsert fila por fila): se puede re-correr
  para refrescar sin acumular duplicados.
- Modulo backend de solo lectura: `modules/catalogos-sat/` (sin schema Zod, como
  `dashboard`/`usuarios`/`operaciones`).

### Que se dejo fuera deliberadamente

- `NO DE SEMANA`, `TT`, `DIAS EN PUERTO`, `TOTAL DE DIAS`, `HOY` — valores calculados en el
  Excel via formula (algunas rotas, seccion 6). Aqui se calculan en el service/query, no se
  almacenan.
- `DIA EN QUE SE SUBIO EL ROUTING`, `NO. SEGUIMIENTO EN SISTEMA` — metadatos del proceso manual
  que dejan de tener sentido con `creadoEn`/`actualizadoEn` y un ID unico por registro.
- `CODIGO DE TARIFA VIP`, `CARTA GARANTIA` — columnas casi vacias en el analisis; fuera del MVP.

### Backlog de modelado pendiente (NO esta en el schema)

- **`ShipmentProveedor`** — tabla N:N Shipment↔Proveedor con un campo `rol`, para representar
  que un embarque tiene a la vez naviera, coloader Y agente aduanal (columnas `AGENTE`,
  `NAVIERA`, `COLOADER` del Excel, independientes entre si). Hoy `Booking` solo permite UN
  proveedor.
- **`Seguro`** — 1:1 con Shipment (tipo, numeroPoliza, numeroFacturaPoliza, empresaSeguro). El
  Excel tiene 4 columnas dedicadas.
- La necesidad de `profitReal` capturado al cierre quedo cubierta por `Shipment.valorizacion*`.
- Politica de "aviso de arribo 10 dias antes / 5 dias despues del zarpe" **por cliente**: no se
  persiste; el log registra el envio y el *cuando* sigue siendo alerta derivada.

## 6. Hallazgos del Excel original (por que el sistema esta disenado asi)

Analisis linea por linea de `REP_EMBARQUES_MGC26_DASHBOARD.xlsx` (hojas `MONSA26`,
`CONTROL DE PAGOS`, `LISTAS`, `REP_AUT`):

- **9.6 MB para 200 filas de datos reales** porque el formato de celda se aplico hasta la fila
  1,048,576 por error (XML interno de esa hoja: 107 MB descomprimido). De ahi que el sistema
  nuevo no dependa de Excel para nada critico y que el modelo tenga limites y tipos explicitos.
- **El dashboard manual (`REP_AUT`) tenia formulas `SUMIF`/`COUNTIF` rotas** — comparaban
  contra etiquetas de texto que no coincidian con los datos. De ahi que `dashboard.service.ts`
  use `groupBy` de Prisma sobre enums fijos, nunca comparacion de texto libre.
- **Columnas de fecha con formulas de resta daban resultados sin sentido** cuando faltaba una
  fecha (46,204 "dias" de demora en un caso). De ahi que los campos de fecha sean nullable y
  la logica explicita en el service maneje los casos sin fecha.
- **Solo 5 de 200 folios tenian profit capturado**, y el shipper llegaba a tener `"xxxxxxx"` en
  filas que eran folios reservados, no embarques. De ahi que `Shipment` solo nazca de un
  `Booking` confirmado (gate 5) y que venta/compra se capturen obligatoriamente en la
  `Cotizacion`.
- **La hoja `LISTAS` es el catalogo maestro real** — fuente directa de los `enum` y del `seed.ts`.
- **`CONTROL DE PAGOS` vinculaba por texto de folio copiado a mano** — en el modelo nuevo es
  una FK real (`CuentaPorPagar.shipmentId`).

## 7. Como correr el proyecto en local

Requiere **MySQL 8 instalado y corriendo** (sin Docker). Crea la base una sola vez:

```sql
CREATE DATABASE monsa_gestion CHARACTER SET utf8mb4;
```

(El `backend/.env` actual apunta a `mysql://USUARIO:CONTRASENA@localhost:3306/monsa_gestion`.)

```bash
# 1. Backend
cd backend
cp .env.example .env      # ajusta DATABASE_URL si usas otro usuario/password
npm install
npm run prisma:migrate    # o: npx prisma migrate deploy
npm run seed
npm run seed:sat            # catalogos oficiales del SAT (seccion 5.5) -- requiere internet
npm run dev                # http://localhost:4000  (health check en /health)

# 2. Frontend (en otra terminal)
cd frontend
npm install
npm run dev                # http://localhost:5173 (proxy /api -> :4000)
```

Si necesitas re-sembrar limpio: `npx prisma migrate reset --force` + `npm run seed`.

**Para entrar al sistema** (usuarios sembrados por `seed.ts`, ver seccion 11):

| Correo                          | Rol              | Contrasena     |
| ------------------------------- | ---------------- | -------------- |
| `admin@monsaglobalcargo.com`    | ADMIN            | `CONFIGURAR_LOCALMENTE`     |
| `karen@monsaglobalcargo.com`    | VENTAS           | `CONFIGURAR_LOCALMENTE`  |
| `araceli@monsaglobalcargo.com`  | CUSTOMER_SERVICE | `CONFIGURAR_LOCALMENTE`  |

### 7.1 Variables de entorno (`backend/.env.example`)

| Variable                                                        | Para que sirve                                                                 |
| -------------------------------------------------------------- | ----------------------------------------------------------------------------- |
| `DATABASE_URL`, `PORT`, `NODE_ENV`                              | Conexion a MySQL y arranque del server.                                       |
| `JWT_SECRET`                                                    | Firma del JWT (min. 16 caracteres). Si falta, en desarrollo usa un secreto obvio; en produccion el arranque **falla**. |
| `JWT_EXPIRES_IN`                                                | Vigencia del token (`8h` por defecto).                                        |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD`, `SMTP_FROM` | Envio de la carta de instrucciones. **Vacias a proposito**: mientras lo esten, el envio falla con un mensaje explicito que la UI muestra. Nunca poner credenciales reales en el repo. |

Otros comandos: `npm run prisma:studio`, `npm run build && npm start`.

## 8. Convenciones del proyecto

- **Nombres de dominio en espanol** (Cliente, Proveedor, Shipment, Cotizacion, Booking,
  Factura, RoutingOrder). No traducir a ingles en archivos nuevos.
- **TypeScript estricto** en ambos proyectos.
- Los errores de negocio se lanzan como `ReglaDeNegocioError` con un mensaje legible en
  espanol — el frontend los muestra tal cual, no se inventan mensajes genericos.
- Folios: Shipment `MGC26000001`, Cotizacion `COT26000001`, Factura final `MGC-FACT-000001`,
  Factura proforma `MGC-PROF-000001`.
- Tailwind con utilidades, sin CSS-in-JS.
- Componentes reutilizables en `frontend/src/components/`; no duplicar tablas o badges.
- Base de datos **MySQL**, no PostgreSQL. SQL crudo debe usar sintaxis MySQL (`YEARWEEK()`).
- **`Usuario` nunca sale completo de la API.** Toda lectura usa `SELECT_USUARIO_PUBLICO`
  (`modules/usuarios/usuario.service.ts`). `cotizaciones`, `shipments`, `dashboard`,
  `operaciones` y `notificaciones` leen al usuario con `select`, no con include.
- **Un gate se comunica, no se esconde.** Cuando una accion no esta disponible por la cascada,
  el boton se muestra **deshabilitado con el motivo en un tooltip** (`motivoDeshabilitado` en
  `<Button>`, `deshabilitada` en las acciones del `<DataTable>`), nunca se oculta. El texto del
  motivo debe coincidir con el `ReglaDeNegocioError` que lanzaria el backend.
- `requireRol(...)` existe pero **no se aplica** a ninguna ruta (el MVP no define la matriz de
  permisos). `PATCH /api/shipments/:id/valorizacion` lleva un comentario `// TODO requireRol(VENTAS)`.

## 9. Modulo de Reportes y documentos

Vive en `backend/src/modules/reportes/` y en `frontend/src/pages/Reportes.tsx` +
`pages/reportes/VistaDocumento.tsx`. Extiende la cascada al terreno documental: **un documento
solo se genera cuando el dato que representa ya existe**.

| Documento                  | Entidad  | Gate                                                        |
| -------------------------- | -------- | ---------------------------------------------------------- |
| Confirmacion de booking    | Booking  | `status = CONFIRMADO`                                       |
| Carta de instrucciones     | Shipment | El embarque existe y no esta `CANCELADO`                    |
| HBL                        | Shipment | `Documento.hbl` capturado                                    |
| MBL                        | Shipment | `Documento.mbl` capturado                                    |
| Factura (CFDI)             | Factura  | PROFORMA siempre disponible; FINAL exige `estatus = TIMBRADA` |
| Complemento de pago (REP)  | ComplementoPago | Siempre disponible (nace ya con los datos del cobro) |

Factura y Complemento de pago reusan la misma estructura `DocumentoRenderizable` y el mismo
renderizador de PDF generico (`reporte.pdf.ts`) que el resto del modulo — agregar un tipo de
documento nuevo no exige maquetacion nueva. `GET /api/reportes/facturacion/excel` genera un
libro `.xlsx` (libreria **exceljs**, JS puro, misma justificacion que `pdf-lib`) con 4 hojas:
Facturas, Conceptos, Complementos de pago y Cuentas por cobrar, con encabezados con formato,
columnas de moneda y fila de totales — botón "Exportar a Excel" en `FacturacionPanel.tsx`.

`GET /api/reportes` devuelve el catalogo completo con `disponible` y `motivoBloqueo`; la pagina
`/reportes` lista todas las filas, las bloqueadas incluidas, con su motivo visible.

**Una estructura, dos renderizadores:** `reporte.service.ts` arma un `DocumentoRenderizable` y
de ahi salen el JSON (que pinta `<DocumentoImprimible>`) y el PDF (`reporte.pdf.ts`, pdf-lib).
El PDF cuelga de un segmento `/pdf`, no de una extension `.pdf` (Express 4 mezcla el punto con
el `:param`).

**Estilo (obligatorio):** reportes empresariales estilo JasperReports — banda de cabecera de
tres celdas (logotipo | razon social + titulo | tabla de parametros), encabezados de seccion
con relleno gris, datos en celdas con borde completo sobre reticula de 3 columnas, banda de pie.
Escala de grises; el unico color es el del logotipo. El empaquetado de filas se replica a mano
en ambos renderizadores (`agruparEnFilas()` en `DocumentoImprimible.tsx` == `cerrarFila()` en
`reporte.pdf.ts`). El pie en pantalla NO lleva `Pagina N de M` (Chrome parte la pagina); en el
PDF si.

La carta de instrucciones muestra ahora el estatus de emision del HBL/MBL leyendo
`Documento.estatusEmisionHbl` / `estatusEmisionMbl` (enum `EstatusEmisionBL`).

**Logotipo en los PDF:** `reporte.pdf.ts` embebe `backend/assets/logoMonsa.png`, resuelto
desde `__dirname` (funciona igual con `tsx` y con el build). Si el archivo no esta, avisa una
vez por consola y genera el PDF sin logotipo.

**Envio por correo:** `POST /api/reportes/shipment/:id/carta-instrucciones/enviar` corre el
gate del documento y manda el PDF adjunto. `GET /api/reportes/estado-correo` dice si el SMTP
esta configurado.

## 10. Acciones Ver / Editar en las tablas

`<DataTable>` soporta `onVer` (abre `<DetalleDrawer>` con todos los campos), `onEditar` +
`edicionBloqueada` (abre `<FormularioEdicion>`), y `accionesExtra` para lo especifico de cada
modulo. `<FormularioEdicion>` es declarativo (`CampoFormulario[]`, soporta `checkbox` y
`select`); `construirPayload` aplica el mismo criterio `"" → null` que `limpiarEntrada`.

Endpoints de edicion y su regla (todos rechazan la edicion cuando el registro ya sostiene algo
aguas abajo):

| Endpoint                          | Editable mientras...                                        |
| --------------------------------- | ---------------------------------------------------------- |
| `PATCH /api/clientes/:id`         | siempre; el `estatus` no se escribe a mano. Un cliente ACTIVO no puede quedarse sin el RFC que ya tenia. |
| `PATCH /api/proveedores/:id`      | siempre; el `estatus` lo mueve `activar` (exige tarifa).    |
| `PATCH /api/tarifas/:id`          | siempre; el proveedor no se reapunta.                       |
| `PATCH /api/cotizaciones/:id`     | `status` sea BORRADOR o ENVIADA.                            |
| `PATCH /api/routing-orders/:id`   | `status = SOLICITADO` (un RO RECIBIDO ya alimenta el booking). |
| `PATCH /api/bookings/:id`         | no este CANCELADO. El proveedor solo mientras siga SOLICITADO. |
| `PATCH /api/shipments/:id`        | status en NUEVO_EMBARQUE / BOOKING_CONFIRMED / PARA_CERRAR / PARA_FACTURAR. |
| `PATCH /api/shipments/:id/documento` | siempre (upsert de `Documento`). Habilita HBL/MBL.       |
| `PATCH /api/shipments/:id/valorizacion` | shipment abierto. Setea venta/compra reales + confirma (gate 6). |
| `PATCH /api/shipments/:id/cerrar` | shipment en status abierto. Devuelve `divergenciaMargen`.   |
| `PATCH /api/cuentas-por-pagar/:id`| el pago no este confirmado.                                 |
| `PATCH /api/cuentas-por-cobrar/:id`| no este COBRADA. Solo terminos de cobranza.               |
| `PATCH /api/facturas/:id`         | `estatus = BORRADOR`. Ya no incluye `montoSinIva` (ver `PUT .../conceptos`). |
| `PUT /api/facturas/:id/conceptos` | `estatus = BORRADOR`. Reemplaza las lineas y recalcula `montoSinIva`.        |
| `PATCH /api/facturas/:id/enviar-timbrado` | Solo FINAL, desde BORRADOR. Congela la captura.               |

## 11. Autenticacion y usuarios

- **Modelo**: `Usuario.passwordHash String?` (bcrypt, 10 rondas). Nullable porque los usuarios
  sembrados antes del modulo de auth existen sin credenciales. **Nunca se expone** (seccion 8).
- **Login**: `POST /api/auth/login` → `{ token, usuario }`. El JWT lleva `sub`, `email`,
  `nombre` y `rol`. El mensaje de credenciales invalidas es identico para "no existe", "sin
  contrasena", "inactivo" y "contrasena incorrecta".
- **Proteccion**: `app.use("/api", requireAuth)` va montado **antes** de todos los routers. Las
  unicas excepciones son `/health` y `/api/auth/login` (`RUTAS_PUBLICAS`).
- **`requireRol(...roles)`** existe pero no se aplica todavia.
- **Frontend**: `AuthProvider` (`lib/auth.tsx`) guarda el token en `localStorage` y al montar
  lo valida contra `/api/auth/yo`. El interceptor de axios agrega el `Bearer` y, ante un 401,
  limpia la sesion y redirige a `/login`. Descarga de PDFs via `abrirPdf()` (una ventana nueva
  no manda el header `Authorization`).
- **Contrasenas de desarrollo**: `CONFIGURAR_LOCALMENTE` (constante `PASSWORD_ADMIN`) y `CONFIGURAR_LOCALMENTE`
  (`PASSWORD_DESARROLLO`), en `prisma/seed.ts`. El `upsert` del seed reescribe el `passwordHash`.

## 12. Estado actual del proyecto

**Mantener esta seccion actualizada conforme se avance.**

- **Backend: completo para el MVP y verificado.** 18 modulos: auth, clientes, proveedores,
  tarifas (Pricing), cotizaciones, routing-orders, bookings, shipments, notificaciones,
  operaciones, facturacion, complementos-pago, **catalogos-sat**, cuentas-por-pagar,
  cuentas-por-cobrar, reportes, dashboard, usuarios. Los **7 gates** de la cascada
  implementados (seccion 2), aplicados tambien a la edicion, a la generacion de documentos y
  al borrado de la ultima tarifa. `npx tsc --noEmit` corre sin errores.
- **Base de datos: MySQL 8 local**, `mysql://USUARIO:CONTRASENA@localhost:3306/monsa_gestion`.
  Migraciones en `backend/prisma/migrations/`:
  - `..._init` — schema base.
  - `..._finanzas_cuentas_por_cobrar` — `CuentaPorCobrar`, `EstatusCobro`, `Shipment.poCliente`.
  - `..._auth_usuario_password` — `Usuario.passwordHash`.
  - `..._pricing_customer_operaciones` — `RoutingOrder`, `NotificacionEnviada`, 6 enums nuevos,
    `Tarifa.tipo`, `Cliente.requiereRoutingOrder`, campos de valorizacion / revalidacion /
    expediente en `Shipment`, `Factura.tipo` + `@@unique([shipmentId, tipo])`, `Documento`
    emision → enum.
  - `..._facturacion_contable` — `ConceptoFactura`, `ComplementoPago`, `EstatusDocumentoFiscal`,
    `MetodoPagoCfdi`, campos fiscales en `Factura` (reemplaza `estatusPac: String?` por
    `estatus: EstatusDocumentoFiscal`), datos fiscales en `Cliente`. Incluye a mano el
    drop/recreate del FK `Factura_shipmentId_fkey` (el indice que lo respaldaba cambio de
    forma).
  - `..._catalogos_sat_cancelacion` — 8 tablas `Sat*` (seccion 5.5), `CANCELADA` agregado a
    `EstatusDocumentoFiscal`, campos `motivoCancelacion`/`folioSustitucionUuid`/
    `fechaCancelacion` en `Factura` y `ComplementoPago`.
  Todas generadas con `prisma migrate diff` y aplicadas con `migrate deploy` (entorno no
  interactivo, sin prompts).
- **Datos semilla: 5 embarques reales** (folios MGC26000001, 000002, 000006, 000007, 000009)
  con cadena completa Cliente → Cotizacion → **RoutingOrder (RECIBIDO)** → Booking → Shipment
  (**valorizacionConfirmada = true**) → Documento/Contenedor → Factura FINAL (**estatus
  TIMBRADA**, con su `ConceptoFactura`) → CuentaPorPagar + CuentaPorCobrar. Incluye
  MGC26000009 con margen negativo real (-16.83 USD). El bloque se auto-omite si ya hay
  shipments. Los catalogos SAT se pueblan aparte con `npm run seed:sat` (seccion 5.5). La BD
  de desarrollo existente se backfilleo varias veces conforme avanzo el trabajo (ROs +
  valorizacion; estatus TIMBRADA + conceptos) para que los flujos ya probados por el usuario
  siguieran validos bajo los gates nuevos.
- **Frontend: completo para el MVP y verificado.** `npm run build` corre sin errores.
  Navegacion: `/login`, `/` (Dashboard), `/contactos` (con datos fiscales del cliente, catalogo
  real de regimen/uso CFDI), `/pricing` (con tipo de tarifa), `/cotizaciones` (con Routing
  Order), `/bookings` (bloquea sin RO), `/embarques` (valorizacion, notificaciones,
  revalidacion/BL, emision DRAFT/FINAL, timeline de estatus del material), `/operaciones`
  (notificaciones, timeline), `/finanzas/:submodulo` (Facturacion con PROFORMA/FINAL/ciclo
  fiscal/conceptos buscables/Excel/cancelacion, Complementos de pago con cancelacion),
  `/reportes` (incluye Factura y Complemento de pago, con estatus CANCELADA),
  `/documentos/:entidad/:id/:tipo`. `<CascadeStepper>` tiene 6 nodos (incluye "Routing Order").
- **Verificado de punta a punta contra la API y en navegador** (2026-09-02 a 2026-09-05): gate 3
  (booking bloqueado sin RO RECIBIDO, permitido despues de `/recibir`), gate 6 (factura
  bloqueada sin valorizacion), gate 7 (FINAL bloqueada si el shipment no esta PARA_FACTURAR;
  PROFORMA permitida antes), serie `MGC-PROF-` separada; **ciclo fiscal completo**: factura
  FINAL nace BORRADOR sin CxC → editable → `enviar-timbrado` (se congela, rechaza edicion) →
  `timbrar` (nace la CxC, shipment pasa a FACTURADO) → cobro PPD genera `ComplementoPago`
  automatico → **cancelacion** (bloqueada con complemento activo; motivo 01 exige folio de
  sustitucion; monto facturado se ajusta) → Excel exporta las 4 hojas con columnas de
  cancelacion → PDF/vista imprimible de Factura y Complemento renderizan con los datos reales
  y el estatus CANCELADA. Probado tanto por API (curl) como por navegador real (Contactos,
  Facturacion, Complementos de pago, Reportes) via chrome-devtools — asi se encontro y
  corrigio en el momento un bug real: `listarFacturas()` no incluia `complementosPago`,
  provocando un `TypeError` en el frontend al cancelar desde la tabla (ya corregido, reusa
  `INCLUDE_FACTURA`).
- **Repositorio Git**: subido a `https://github.com/UlisesGarcia34/sistemaGestionMonsa.git`
  (rama `main`), con `.gitignore` (node_modules, dist, .env*, logs) y `README.md` en la raiz.
- **Rediseno de Sidebar/Topbar/modo oscuro** (2026-09-04, ver seccion 3): logotipo transparente
  mas grande y centrado en el sidebar, contenido de cada modulo a `max-w-[1600px]`, y toggle de
  tema claro/oscuro completo (`ThemeProvider`, `darkMode: "class"`) aplicado a todos los
  componentes compartidos y a cada pagina — incluida la correccion de un bug real de contraste
  (celdas de `<DataTable>` con `text-slate-900` fijo, invisibles en fondo oscuro) encontrado
  durante la verificacion visual en navegador. `npm run build` sin errores; verificado en
  Dashboard, Cotizaciones, Embarques y Facturacion con el toggle en ambos sentidos.
- **`usuarios`**: solo lectura. El alta de usuarios y la matriz de permisos por rol siguen
  fuera del MVP.
- **`docs/requerimientos-pricing-customer-operaciones.md`** y
  **`docs/superpowers/specs/2026-09-04-facturacion-contable-design.md`**: HISTORICOS. Todo su
  contenido esta incorporado en este archivo.
- **No implementado todavia**: `ShipmentProveedor` y `Seguro` (backlog de modelado, seccion 5),
  alta/administracion de usuarios desde la UI, `requireRol` aplicado a rutas, portal de cliente,
  timbrado CFDI real ante un PAC (hoy simulado, igual que el complemento de pago y su
  cancelacion), SMTP real, tracking automatico via APIs de navieras, migracion de los 200
  folios del Excel, alerta de aviso de arribo en el Dashboard (el endpoint existe; falta el
  tile), RFC/domicilio fiscal real del emisor (hoy ficticios en `datosFiscalesEmisor.ts`).

## 13. Siguiente tarea sugerida

1. Reemplazar `EMISOR_CFDI` (`backend/src/shared/datosFiscalesEmisor.ts`) con el RFC y domicilio
   fiscal reales de Monsa antes de cualquier uso fuera de desarrollo — hoy son ficticios.
2. Reconciliar el backlog de modelado de la seccion 5: decidir si `ShipmentProveedor` (varios
   proveedores por rol) y `Seguro` entran, aplicarlos como migracion y actualizar `shipments`.
3. Agregar el tile "avisos de arribo pendientes" al Dashboard (endpoint ya existe).
4. Diseñar el plan de migracion de los 200 folios reales del Excel hacia las tablas.
5. Completar la administracion de usuarios sobre la autenticacion ya existente: alta/baja desde
   la UI, cambio de contrasena en pantalla, aplicar `requireRol` segun la matriz de permisos.
6. Configurar SMTP real en `backend/.env` y validar el envio de la carta de instrucciones.
7. Correr `npm run seed:sat` en cualquier entorno nuevo (requiere internet la primera vez) para
   poblar los catalogos SAT — sin eso, `<ComboboxCatalogoSat>` y los `<select>` fiscales
   quedan vacios.
8. Empezar Fase 2 del roadmap: portal de cliente e integraciones con navieras.

## 14. MVP de embarques y KPI (2026-09-05)

Esta sección actualiza las descripciones anteriores que ya no coinciden con el código:

- Migración `20260905010000_mvp_embarques`: agrega version/cancelación en Shipment, ConsecutivoShipment y AuditoriaShipment (27 modelos en total). No carga históricos.
- Todos los PATCH operativos de Shipment exigen `version`; tracking rechaza `status`. La política compartida vive en `shipment.politicas.ts`; cerrar no admite estados terminales ni factura FINAL. Documento/tracking/valorización también bloquean expedientes con factura FINAL.
- Cancelación ADMIN con motivo/fecha/autor, bloqueada con facturas o CxP. Valorización VENTAS/ADMIN. `requireRol` ya se aplica a estas dos rutas; la matriz restante sigue pendiente.
- `transaccion.ts` usa aislamiento serializable y reintentos acotados. Folios de Shipment usan consecutivo atómico; altas/ediciones se auditan en la misma transacción. Creación de Factura y alta/reasignación CxP se coordinan transaccionalmente con cancelación.
- `GET /api/shipments/pagina` es la lista liviana paginada de la UI; `/api/shipments` mantiene contrato de arreglo para otros selectores. Detalle bajo demanda incluye acciones de dominio y últimos 50 cambios con nombre del autor. El cliente envía versión al guardar y muestra conflictos 409.
- `GET /api/dashboard/embarques`: filtros comunes con lista, agregados reales por moneda y cobertura; se comparte en Dashboard y Embarques. Operaciones usa el mismo cálculo de días/alertas. Ventana de avisos hoy a +10 inclusive, atrasos separados. El periodo filtra alta técnica, no estado histórico.
- Dashboard ya no usa importes estimados como margen real. Endpoints anteriores de rentabilidad y avisos se alinean; `/dashboard/kpis` devuelve porMoneda y escalares null cuando no existe una moneda única. Cartera general sigue visible con ventana independiente de 45 días.
- Frontend conserva componentes/paleta/modo oscuro; filtros en URL, búsqueda por relaciones, paginación, cancelación con confirmación, acciones deshabilitadas con motivo. Solo bookings confirmados sin shipment aparecen en el alta.
- Pruebas: `npm test` (unitarias) y `npm run test:integration` desde backend. Integración crea y elimina una base MySQL local exclusiva `mgc_test_<timestamp>_<pid>`, aplica migraciones y prueba HTTP real; requiere CREATE/DROP DATABASE. Nunca ejecutar estos casos contra datos operativos.
- Alcance y decisiones detallados en `docs/arquitectura-crud-kpi-monsa26.md`, sección 16. Importación, Seguro, ShipmentProveedor, bitácora manual, demoras por contenedor y matriz completa de permisos siguen pendientes; no confundir el MVP con toda la arquitectura objetivo.
