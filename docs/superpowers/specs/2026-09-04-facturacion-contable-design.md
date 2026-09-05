# Diseño: Facturación nivel contador (borrador, CFDI completo, complemento de pago, Excel)

- **Fecha:** 2026-09-04
- **Origen:** pedido directo del usuario durante pruebas en vivo del módulo Finanzas →
  Facturación: "integra todo lo que un contador debe requerir: borrador antes del timbrado,
  diseño de la factura con sus datos, complemento de pago, y exportar en Excel detallado".
- **Base:** `CLAUDE.md` §5.3 (Factura), §4.4 (Finanzas), §9 (Reportes). Extiende, no reemplaza.
- **Clasificación:** arquitectural (2 modelos nuevos, reubica cuándo nace la CxC, librería nueva).

## Fuera de alcance (decisión explícita, para no sobre-construir)

- Catálogos oficiales completos del SAT (c_ClaveProdServ ~52,000 entradas, c_ClaveUnidad
  ~3,000): se capturan como texto, no se importa un catálogo buscable.
- Cancelación de CFDI: no fue pedida: reduce el alcance a lo solicitado.
- Retenciones por concepto (estructura real del SAT): se modelan a nivel factura, no por línea.
- Timbrado real ante un PAC: sigue simulado, como ya documenta CLAUDE.md §5.3.

## 1. Cliente — datos fiscales del receptor

Campos nuevos, opcionales: `regimenFiscal`, `usoCfdi`, `codigoPostal`. El CFDI 4.0 real exige
código postal y régimen fiscal del receptor; hoy `Cliente` no los tenía.

## 2. Emisor — constante, no tabla

`backend/src/shared/datosFiscalesEmisor.ts`: RFC, razón social, régimen fiscal y código postal
de Monsa, marcados `ASUNCION` (ficticios hasta contar con el RFC real). Un solo emisor no
justifica un modelo propio — sería una tabla de una fila.

## 3. `Factura` — borrador real + campos CFDI + conceptos

### 3.1 Nuevo enum `EstatusDocumentoFiscal`

```
BORRADOR          -- captura editable, nada aguas abajo depende de esto todavia
PENDIENTE_TIMBRADO -- congelado, esperando el timbrado (solo FINAL)
TIMBRADA          -- CFDI emitido (simulado)
```

Reemplaza el `estatusPac: String?` de texto libre. Lo usan tanto `Factura` como
`ComplementoPago` (mismo ciclo de vida).

### 3.2 Ciclo por tipo

- **PROFORMA**: nace y permanece en `BORRADOR`. No tiene timbrado ni tiene sentido "enviar a
  timbrado" — es una referencia para el cliente, no un CFDI. Editable siempre (como hoy).
- **FINAL**: `BORRADOR` → (`PATCH /:id/enviar-timbrado`) → `PENDIENTE_TIMBRADO` → (`PATCH
  /:id/timbrar`) → `TIMBRADA`. Editable **solo en BORRADOR**.

### 3.3 Cambio de comportamiento: cuándo nace la Cuenta por Cobrar

Hoy `crearFactura` (FINAL) crea la CxC y mueve el Shipment a `FACTURADO` en el mismo paso que
genera el registro. Con un BORRADOR real eso ya no es correcto: una factura que el contador
sigue revisando no debe generar cartera todavía.

**Nuevo:** la CxC nace y el Shipment pasa a `FACTURADO` en `marcarTimbrada`, no en
`crearFactura`. `crearFactura` (FINAL) sigue exigiendo el gate 7 (shipment `PARA_FACTURAR`) y el
gate 6 (valorización) para poder generarse, pero el efecto aguas abajo se retrasa hasta que el
CFDI de verdad se emite. Esto es un refinamiento del gate 7 documentado en CLAUDE.md, no un gate
nuevo.

### 3.4 Campos nuevos en `Factura`

`regimenFiscalReceptor`, `usoCfdi`, `codigoPostalReceptor` (snapshot del cliente al momento de
facturar — un CFDI no debe cambiar si luego se edita el cliente), `formaPago` (clave SAT texto),
`metodoPago` (enum `MetodoPagoCfdi { PUE, PPD }` — determina si aplica complemento de pago),
`condicionesPago`, `tipoCambio`, `retencionIvaTasa`, `retencionIsrTasa` (opcionales, a nivel
factura).

### 3.5 Nuevo modelo `ConceptoFactura` (1:N con Factura)

`claveProdServ`, `claveUnidad`, `unidad`, `cantidad`, `descripcion`, `valorUnitario`, `importe`,
`objetoImpuesto`, `ivaTasa`, `ivaImporte`. Al generar la factura con el flujo actual (un monto)
se crea automáticamente **1 concepto** con esos datos por default (servicio de freight
forwarding del embarque). En `BORRADOR` el contador puede editar/agregar/quitar líneas vía
`PUT /api/facturas/:id/conceptos`. `Factura.montoSinIva` pasa a ser la suma de sus conceptos
(se recalcula en cada escritura de conceptos, se sigue guardando en la columna para no romper
lecturas existentes de CxC / resumen).

## 4. `ComplementoPago` (nuevo modelo — el REP de pagos)

1:N con `Factura`. Se genera **automáticamente**, nunca a mano, desde
`cxc.service.registrarCobro` cuando: la factura es `FINAL`, está `TIMBRADA`, y su
`metodoPago = PPD`. Un pago contra una factura `PUE` no genera complemento (ya está saldado en
el CFDI original) — esto es correcto conforme a cómo funciona el CFDI real.

Campos: `folio` (`MGC-PAGO-000001`, serie propia), `fechaPago`, `monto`, `moneda`,
`tipoCambio`, `formaPago`, `numOperacion`, `saldoAnterior`, `saldoInsoluto`, `estatus`
(`EstatusDocumentoFiscal`), `cfdiUuid`, `fechaTimbrado`. Mismas acciones que Factura:
`enviar-timbrado` y `timbrar` (ambas simuladas).

## 5. Documentos imprimibles (extiende `modules/reportes/`)

El renderizador de PDF (`reporte.pdf.ts`) y el componente `DocumentoImprimible.tsx` ya son
genéricos sobre `DocumentoRenderizable` (secciones de campos etiqueta/valor) — agregar un tipo
de documento nuevo es barato, no requiere maquetación nueva. Se agregan dos tipos:

- `FACTURA` — cabecera emisor/receptor con sus datos fiscales, una sección con los conceptos
  (mismo patrón usado hoy para listar contenedores), totales (subtotal, IVA, retenciones,
  total), folio y UUID (simulado).
- `COMPLEMENTO_PAGO` — datos del pago, saldo anterior/insoluto, referencia a la factura y su
  UUID.

`GET /api/reportes/factura/:id/cfdi[.../pdf]`, `GET
/api/reportes/complemento-pago/:id/documento[.../pdf]`. `DisponibilidadDocumento.entidad` gana
`"factura"` y `"complemento-pago"`. Sin envío por correo para estos dos (no se pidió).

## 6. Excel — libro completo para el contador

Nueva dependencia **`exceljs`** (JS puro, sin binarios — misma justificación que `pdf-lib` en
CLAUDE.md §3). `GET /api/reportes/facturacion/excel` arma un `.xlsx` con 4 hojas:

- **Facturas** — folio, tipo, estatus, embarque, cliente, RFC, régimen fiscal, uso CFDI, forma
  de pago, método de pago, condiciones de pago, subtotal, IVA, retenciones, total, moneda, tipo
  de cambio, UUID, fecha de timbrado.
- **Conceptos** — una fila por línea de cada factura: folio, clave prod/serv, clave unidad,
  descripción, cantidad, valor unitario, importe, IVA.
- **Complementos de pago** — folio, factura relacionada, fecha, monto, forma de pago, saldo
  anterior/insoluto, estatus, UUID.
- **Cuentas por cobrar** — estado actual de cartera (ya existente, se incluye para conciliar).

Encabezados con relleno de color y negritas, columnas con ancho ajustado por contenido, columnas
de importe con formato de moneda, fila de totales al pie de Facturas y Conceptos, filtro
automático en la fila de encabezado, panel de encabezado congelado (`freeze pane`).

Frontend: botón "Exportar a Excel" en `FacturacionPanel.tsx`. Nuevo helper
`descargarArchivo(url, nombreSugerido)` en `lib/api.ts` (blob + `<a download>` sintético, mismo
patrón que `abrirPdf` pero para descarga en vez de apertura en pestaña).

## 7. Migración de datos existentes

Las 3 facturas sembradas con "No FACTURA" real del Excel (folios `MGC-FACT-000002/000003/000005`)
representan CFDIs ya emitidos según el histórico → pasan a `estatusFactura = TIMBRADA` con un
`ConceptoFactura` único reconstruido de su `montoSinIva`, `metodoPago = PUE` (sin dato real en
el Excel, se asume de contado — no genera complementos de pago retroactivos, marcado
`ASUNCION`). Sus `CuentaPorCobrar` ya fueron creadas directo por el seed (sin pasar por
`crearFactura`/`marcarTimbrada`); eso no cambia.

## 8. Verificación

```bash
cd backend
npm install exceljs
npx prisma migrate dev --name facturacion_contable
npm run seed
npx tsc --noEmit

cd ../frontend
npm run build
```

Prueba manual: generar factura FINAL → queda BORRADOR, sin CxC todavía → editar sus conceptos →
"Enviar a timbrado" → ya no editable → "Timbrar" → ahora sí nace la CxC y el shipment pasa a
FACTURADO → registrar un cobro parcial contra una factura `PPD` → aparece un
`ComplementoPago` en BORRADOR → exportar el libro de Excel y confirmar las 4 hojas.
