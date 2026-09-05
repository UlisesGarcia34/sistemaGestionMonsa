import ExcelJS from "exceljs";
import { prisma } from "@/config/prisma";

// ---------------------------------------------------------------------------
// Libro de Excel para el contador: Facturacion completa en 4 hojas.
//
// LIBRERIA ELEGIDA: exceljs. JS puro, sin binarios ni dependencias nativas --
// misma justificacion que pdf-lib para los PDF (ver encabezado de
// reporte.pdf.ts): este proyecto corre en la maquina del equipo sin Docker,
// asi que cualquier libreria que dependa de un binario nativo (ej. motores
// que envuelven librerias de C) es friccion evitable.
// ---------------------------------------------------------------------------

const NAVY = "FF0B3D5C";
const BLANCO = "FFFFFFFF";
const GRIS_TOTAL = "FFF1F5F9";

function encabezado(hoja: ExcelJS.Worksheet, columnas: { header: string; key: string; width: number }[]) {
  hoja.columns = columnas;
  const fila = hoja.getRow(1);
  fila.font = { bold: true, color: { argb: BLANCO } };
  fila.fill = { type: "pattern", pattern: "solid", fgColor: { argb: NAVY } };
  fila.alignment = { vertical: "middle" };
  hoja.views = [{ state: "frozen", ySplit: 1 }];
  hoja.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: columnas.length } };
}

function filaTotal(hoja: ExcelJS.Worksheet, valores: Record<string, unknown>) {
  const fila = hoja.addRow(valores);
  fila.font = { bold: true };
  fila.fill = { type: "pattern", pattern: "solid", fgColor: { argb: GRIS_TOTAL } };
  return fila;
}

const FORMATO_MONEDA = '#,##0.00';
const FORMATO_FECHA = "dd/mm/yyyy";

function num(v: unknown): number {
  return v == null ? 0 : Number(v);
}

export async function generarLibroFacturacion(): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Monsa Global Cargo — sistema de gestion";
  workbook.created = new Date();

  const [facturas, complementos, cxc] = await Promise.all([
    prisma.factura.findMany({
      include: { shipment: { include: { consignee: true } }, conceptos: true },
      orderBy: { creadoEn: "desc" },
    }),
    prisma.complementoPago.findMany({
      include: { factura: { include: { shipment: { include: { consignee: true } } } } },
      orderBy: { fechaPago: "desc" },
    }),
    prisma.cuentaPorCobrar.findMany({
      include: {
        cliente: true,
        factura: { select: { numeroFactura: true, shipment: { select: { folio: true } } } },
      },
      orderBy: { fechaEmision: "desc" },
    }),
  ]);

  // ---- Hoja Facturas -------------------------------------------------
  const hojaFacturas = workbook.addWorksheet("Facturas");
  encabezado(hojaFacturas, [
    { header: "Folio", key: "folio", width: 18 },
    { header: "Tipo", key: "tipo", width: 10 },
    { header: "Estatus", key: "estatus", width: 18 },
    { header: "Embarque", key: "embarque", width: 14 },
    { header: "Cliente", key: "cliente", width: 30 },
    { header: "RFC", key: "rfc", width: 14 },
    { header: "Regimen fiscal", key: "regimenFiscal", width: 16 },
    { header: "Uso CFDI", key: "usoCfdi", width: 10 },
    { header: "CP receptor", key: "cp", width: 10 },
    { header: "Forma de pago", key: "formaPago", width: 12 },
    { header: "Metodo de pago", key: "metodoPago", width: 12 },
    { header: "Condiciones de pago", key: "condiciones", width: 18 },
    { header: "Moneda", key: "moneda", width: 8 },
    { header: "Tipo de cambio", key: "tipoCambio", width: 12 },
    { header: "Subtotal", key: "subtotal", width: 14 },
    { header: "IVA", key: "iva", width: 12 },
    { header: "Retencion IVA", key: "retIva", width: 12 },
    { header: "Retencion ISR", key: "retIsr", width: 12 },
    { header: "Total", key: "total", width: 14 },
    { header: "UUID fiscal", key: "uuid", width: 26 },
    { header: "Fecha emision", key: "fechaEmision", width: 14 },
    { header: "Fecha timbrado", key: "fechaTimbrado", width: 14 },
    { header: "Motivo cancelacion", key: "motivoCancelacion", width: 20 },
    { header: "Fecha cancelacion", key: "fechaCancelacion", width: 14 },
  ]);

  let totalSubtotal = 0;
  let totalIva = 0;
  let totalGeneral = 0;

  for (const f of facturas) {
    const subtotal = num(f.montoSinIva);
    const iva = f.conceptos.reduce((acc, c) => acc + num(c.ivaImporte), 0);
    const retIva = f.retencionIvaTasa ? (subtotal * num(f.retencionIvaTasa)) / 100 : 0;
    const retIsr = f.retencionIsrTasa ? (subtotal * num(f.retencionIsrTasa)) / 100 : 0;
    const total = subtotal + iva - retIva - retIsr;
    // Una factura CANCELADA no suma al total: el CFDI quedo sin efecto.
    if (f.estatus !== "CANCELADA") {
      totalSubtotal += subtotal;
      totalIva += iva;
      totalGeneral += total;
    }

    const fila = hojaFacturas.addRow({
      folio: f.numeroFactura,
      tipo: f.tipo,
      estatus: f.estatus,
      embarque: f.shipment.folio,
      cliente: f.shipment.consignee.razonSocial,
      rfc: f.shipment.consignee.rfc ?? "",
      regimenFiscal: f.regimenFiscalReceptor ?? "",
      usoCfdi: f.usoCfdi ?? "",
      cp: f.codigoPostalReceptor ?? "",
      formaPago: f.formaPago ?? "",
      metodoPago: f.metodoPago,
      condiciones: f.condicionesPago ?? "",
      moneda: f.moneda,
      tipoCambio: f.tipoCambio ? num(f.tipoCambio) : null,
      subtotal,
      iva,
      retIva: retIva || null,
      retIsr: retIsr || null,
      total,
      uuid: f.cfdiUuid ?? "",
      fechaEmision: f.creadoEn,
      fechaTimbrado: f.fechaTimbrado,
      motivoCancelacion: f.motivoCancelacion ?? "",
      fechaCancelacion: f.fechaCancelacion,
    });
    ["subtotal", "iva", "retIva", "retIsr", "total", "tipoCambio"].forEach((k) => {
      fila.getCell(k).numFmt = FORMATO_MONEDA;
    });
    ["fechaEmision", "fechaTimbrado", "fechaCancelacion"].forEach(
      (k) => (fila.getCell(k).numFmt = FORMATO_FECHA)
    );
  }
  filaTotal(hojaFacturas, {
    folio: `Total (${facturas.length} facturas)`,
    subtotal: totalSubtotal,
    iva: totalIva,
    total: totalGeneral,
  }).eachCell((cell) => {
    if (typeof cell.value === "number") cell.numFmt = FORMATO_MONEDA;
  });

  // ---- Hoja Conceptos --------------------------------------------------
  const hojaConceptos = workbook.addWorksheet("Conceptos");
  encabezado(hojaConceptos, [
    { header: "Factura", key: "factura", width: 18 },
    { header: "Cliente", key: "cliente", width: 28 },
    { header: "Clave prod/serv", key: "claveProdServ", width: 14 },
    { header: "Clave unidad", key: "claveUnidad", width: 12 },
    { header: "Unidad", key: "unidad", width: 12 },
    { header: "Descripcion", key: "descripcion", width: 40 },
    { header: "Cantidad", key: "cantidad", width: 10 },
    { header: "Valor unitario", key: "valorUnitario", width: 14 },
    { header: "Importe", key: "importe", width: 14 },
    { header: "Objeto impuesto", key: "objetoImpuesto", width: 12 },
    { header: "Tasa IVA %", key: "ivaTasa", width: 10 },
    { header: "Importe IVA", key: "ivaImporte", width: 12 },
  ]);
  let totalImporte = 0;
  for (const f of facturas) {
    for (const c of f.conceptos) {
      totalImporte += num(c.importe);
      const fila = hojaConceptos.addRow({
        factura: f.numeroFactura,
        cliente: f.shipment.consignee.razonSocial,
        claveProdServ: c.claveProdServ,
        claveUnidad: c.claveUnidad,
        unidad: c.unidad ?? "",
        descripcion: c.descripcion,
        cantidad: num(c.cantidad),
        valorUnitario: num(c.valorUnitario),
        importe: num(c.importe),
        objetoImpuesto: c.objetoImpuesto,
        ivaTasa: num(c.ivaTasa),
        ivaImporte: num(c.ivaImporte),
      });
      ["valorUnitario", "importe", "ivaImporte"].forEach((k) => (fila.getCell(k).numFmt = FORMATO_MONEDA));
    }
  }
  filaTotal(hojaConceptos, { factura: "Total", importe: totalImporte }).getCell("importe").numFmt =
    FORMATO_MONEDA;

  // ---- Hoja Complementos de pago ---------------------------------------
  const hojaComplementos = workbook.addWorksheet("Complementos de pago");
  encabezado(hojaComplementos, [
    { header: "Folio", key: "folio", width: 18 },
    { header: "Factura", key: "factura", width: 18 },
    { header: "Cliente", key: "cliente", width: 28 },
    { header: "Fecha de pago", key: "fechaPago", width: 14 },
    { header: "Monto", key: "monto", width: 14 },
    { header: "Moneda", key: "moneda", width: 8 },
    { header: "Tipo de cambio", key: "tipoCambio", width: 12 },
    { header: "Forma de pago", key: "formaPago", width: 12 },
    { header: "Num. operacion", key: "numOperacion", width: 16 },
    { header: "Saldo anterior", key: "saldoAnterior", width: 14 },
    { header: "Saldo insoluto", key: "saldoInsoluto", width: 14 },
    { header: "Estatus", key: "estatus", width: 18 },
    { header: "UUID fiscal", key: "uuid", width: 26 },
    { header: "Motivo cancelacion", key: "motivoCancelacion", width: 20 },
    { header: "Fecha cancelacion", key: "fechaCancelacion", width: 14 },
  ]);
  for (const c of complementos) {
    const fila = hojaComplementos.addRow({
      folio: c.folio,
      factura: c.factura.numeroFactura,
      cliente: c.factura.shipment.consignee.razonSocial,
      fechaPago: c.fechaPago,
      monto: num(c.monto),
      moneda: c.moneda,
      tipoCambio: c.tipoCambio ? num(c.tipoCambio) : null,
      formaPago: c.formaPago,
      numOperacion: c.numOperacion ?? "",
      saldoAnterior: num(c.saldoAnterior),
      saldoInsoluto: num(c.saldoInsoluto),
      estatus: c.estatus,
      uuid: c.cfdiUuid ?? "",
      motivoCancelacion: c.motivoCancelacion ?? "",
      fechaCancelacion: c.fechaCancelacion,
    });
    fila.getCell("fechaPago").numFmt = FORMATO_FECHA;
    fila.getCell("fechaCancelacion").numFmt = FORMATO_FECHA;
    ["monto", "tipoCambio", "saldoAnterior", "saldoInsoluto"].forEach(
      (k) => (fila.getCell(k).numFmt = FORMATO_MONEDA)
    );
  }

  // ---- Hoja Cuentas por cobrar ------------------------------------------
  const hojaCxc = workbook.addWorksheet("Cuentas por cobrar");
  encabezado(hojaCxc, [
    { header: "Cliente", key: "cliente", width: 28 },
    { header: "Factura", key: "factura", width: 18 },
    { header: "Embarque", key: "embarque", width: 14 },
    { header: "Monto", key: "monto", width: 14 },
    { header: "Cobrado", key: "cobrado", width: 14 },
    { header: "Saldo", key: "saldo", width: 14 },
    { header: "Moneda", key: "moneda", width: 8 },
    { header: "Emision", key: "emision", width: 14 },
    { header: "Vencimiento", key: "vencimiento", width: 14 },
    { header: "Cobro", key: "cobro", width: 14 },
    { header: "Estatus", key: "estatus", width: 12 },
  ]);
  for (const c of cxc) {
    const fila = hojaCxc.addRow({
      cliente: c.cliente.razonSocial,
      factura: c.factura.numeroFactura,
      embarque: c.factura.shipment.folio,
      monto: num(c.monto),
      cobrado: num(c.montoCobrado),
      saldo: num(c.monto) - num(c.montoCobrado),
      moneda: c.moneda,
      emision: c.fechaEmision,
      vencimiento: c.fechaVencimiento,
      cobro: c.fechaCobro,
      estatus: c.estatusCobro,
    });
    ["monto", "cobrado", "saldo"].forEach((k) => (fila.getCell(k).numFmt = FORMATO_MONEDA));
    ["emision", "vencimiento", "cobro"].forEach((k) => (fila.getCell(k).numFmt = FORMATO_FECHA));
  }

  const arrayBuffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(arrayBuffer);
}
