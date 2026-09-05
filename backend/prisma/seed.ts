import { PrismaClient, Prisma } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

// Contrasenas de los usuarios semilla. Son de desarrollo local a proposito y
// estan documentadas en CLAUDE.md seccion 11: sirven para entrar al sistema
// recien clonado. Antes de exponer el sistema a una red real hay que cambiarlas
// (PATCH /api/auth/password) o resembrar con otras.
//   admin@monsaglobalcargo.com -> PASSWORD_ADMIN
//   el resto                   -> PASSWORD_DESARROLLO
const PASSWORD_DESARROLLO = "password123";
const PASSWORD_ADMIN = "admin123";

// ---------------------------------------------------------------------------
// Datos semilla del sistema de gestion de Monsa Global Cargo (MGC).
//
// Dos bloques:
//  1. Catalogos maestros tomados de la hoja LISTAS del Excel
//     REP_EMBARQUES_MGC26_DASHBOARD.xlsx (navieras, coloaders, usuarios base).
//  2. 5 embarques REALES tomados de la hoja MONSA26 del mismo Excel, con toda
//     su cadena de entidades (Cliente -> Cotizacion -> Booking -> Shipment ->
//     Documento/Contenedor -> Factura -> CuentaPorPagar / CuentaPorCobrar) para
//     poder navegar el flujo completo de la cascada con datos de verdad.
//
// Donde el Excel no capturaba un dato requerido por el flujo (ej. montoCompra
// exacto de un embarque), la asuncion queda documentada con un comentario
// "ASUNCION:" en la linea correspondiente -- nunca se deja en null un campo
// que el flujo necesita.
// ---------------------------------------------------------------------------

async function upsertClienteActivo(
  razonSocial: string,
  opts: { alias?: string; diasCredito: number; limiteCredito: number }
) {
  const existente = await prisma.cliente.findFirst({ where: { razonSocial } });
  if (existente) return existente;
  // ASUNCION: el Excel no traía RFC ni linea de credito por cliente; se activan
  // con datos KYC representativos para poder cotizar en firme (gate 1).
  return prisma.cliente.create({
    data: {
      razonSocial,
      alias: opts.alias,
      estatus: "ACTIVO",
      diasCredito: opts.diasCredito,
      limiteCredito: new Prisma.Decimal(opts.limiteCredito),
    },
  });
}

async function upsertProveedorActivo(
  nombre: string,
  tipo: Prisma.ProveedorCreateInput["tipo"],
  tarifa: { origen: string; destino: string; modalidad: Prisma.TarifaCreateInput["modalidad"] }
) {
  let proveedor = await prisma.proveedor.findFirst({ where: { nombre } });
  if (!proveedor) {
    proveedor = await prisma.proveedor.create({
      data: { nombre, tipo, estatus: "ACTIVO" },
    });
  } else if (proveedor.estatus !== "ACTIVO") {
    proveedor = await prisma.proveedor.update({
      where: { id: proveedor.id },
      data: { estatus: "ACTIVO" },
    });
  }
  const tieneTarifa = await prisma.tarifa.findFirst({ where: { proveedorId: proveedor.id } });
  if (!tieneTarifa) {
    // ASUNCION: tarifa de compra representativa; el Excel no llevaba buy rates
    // por proveedor en una tabla estructurada.
    await prisma.tarifa.create({
      data: {
        proveedorId: proveedor.id,
        origen: tarifa.origen,
        destino: tarifa.destino,
        modalidad: tarifa.modalidad,
        tipo: "CONTRATO",
        montoCompra: new Prisma.Decimal(1000),
        moneda: "USD",
        vigenteDesde: new Date("2026-01-01"),
      },
    });
  }
  return proveedor;
}

interface EmbarqueReal {
  folioTail: string; // 6 digitos, respeta la numeracion original del Excel
  consignee: string;
  shipper: string;
  tipoOperacion: Prisma.ShipmentCreateInput["tipoOperacion"];
  modalidad: Prisma.ShipmentCreateInput["modalidad"];
  incoterm: string;
  statusShipment: Prisma.ShipmentCreateInput["status"];
  estatusMaterial: string;
  montoVenta: number;
  montoCompra: number;
  proveedor: { nombre: string; tipo: Prisma.ProveedorCreateInput["tipo"] };
  origen: string;
  destino: string;
  paisOrigen?: string;
  vessel?: string;
  voyage?: string;
  etd: string;
  eta: string;
  grossWeight?: number;
  cbm?: number;
  totalItems?: number;
  poCliente?: string;
  mbl?: string;
  contenedorTipo?: string;
  // Numero interno de factura Monsa en el Excel (columna "No FACTURA").
  numeroFacturaMonsa?: number;
  nota?: string;
}

// Los 5 folios reales, tal cual vienen de la hoja MONSA26.
const EMBARQUES: EmbarqueReal[] = [
  {
    folioTail: "000001",
    consignee: "TRUPER",
    shipper: "PRESSTRADE SERVICES GMBH",
    tipoOperacion: "IMPORTACION",
    modalidad: "LCL",
    incoterm: "FOB",
    statusShipment: "BOOKING_CONFIRMED",
    estatusMaterial: "EN PUERTO",
    montoVenta: 5000, // ASUNCION: venta sin IVA no capturada en la fila; estimado razonable
    montoCompra: 4300, // ASUNCION: compra no capturada; ~14% margen tipico LCL Europa
    proveedor: { nombre: "ECULINE", tipo: "COLOADER" },
    origen: "Hamburgo",
    destino: "Veracruz",
    paisOrigen: "Alemania",
    vessel: "GSL TEGEA",
    etd: "2026-06-12",
    eta: "2026-06-30",
    mbl: "HAM/VER/16237",
  },
  {
    folioTail: "000002",
    consignee: "ATYV DESARROLLOS Y MANUFACTURAS S.A. DE C.V.",
    shipper: "HAINING AUTOMANN PARTS CO., LTD",
    tipoOperacion: "IMPORTACION",
    modalidad: "LCL",
    incoterm: "FOB",
    statusShipment: "BOOKING_CONFIRMED",
    estatusMaterial: "EN TRANSITO",
    montoVenta: 4200, // ASUNCION: venta sin IVA no capturada en la fila
    montoCompra: 3700, // ASUNCION: compra no capturada
    proveedor: { nombre: "AMASS", tipo: "COLOADER" }, // Hapag-Lloyd como naviera; AMASS como agente/coloader que emite el MBL
    origen: "Ningbo",
    destino: "Manzanillo",
    paisOrigen: "China",
    vessel: "HMM BLESSING",
    voyage: "0039E",
    etd: "2026-06-05",
    eta: "2026-07-10",
    grossWeight: 7598,
    cbm: 14.88,
    totalItems: 13,
    mbl: "AMIGL260237853A",
    nota: "Tipo de carga PACKAGES en el Excel; sin contenedor por ser LCL.",
  },
  {
    folioTail: "000006",
    consignee: "TRUPER",
    shipper: "N/D (acarreo local)",
    tipoOperacion: "TERRESTRE",
    modalidad: "LTL",
    incoterm: "N/A",
    statusShipment: "PARA_CERRAR",
    estatusMaterial: "TERRESTRE",
    montoVenta: 9000,
    montoCompra: 8914.77, // venta 9000 - profit real 85.23
    proveedor: { nombre: "MGC TRANSPORTE TERRESTRE", tipo: "TRANSPORTISTA" },
    origen: "AICM",
    destino: "Jilotepec",
    etd: "2026-05-26",
    eta: "2026-05-26",
    poCliente: "FLETE TERRESTRE AICM-JILOTEPEC/006-31046945//724-79066164",
    numeroFacturaMonsa: 2,
  },
  {
    folioTail: "000007",
    consignee: "DREAMS ART",
    shipper: "N/D (movimiento terrestre nacional)",
    tipoOperacion: "TERRESTRE",
    modalidad: "FTL",
    incoterm: "N/A",
    statusShipment: "PARA_CERRAR",
    estatusMaterial: "TERRESTRE",
    montoVenta: 2000,
    montoCompra: 1886.36, // venta 2000 - profit real 113.64
    proveedor: { nombre: "MGC TRANSPORTE TERRESTRE", tipo: "TRANSPORTISTA" },
    origen: "Lazaro Cardenas",
    destino: "Estado de Mexico",
    etd: "2026-05-27",
    eta: "2026-05-28",
    grossWeight: 18619,
    contenedorTipo: "40HC",
    numeroFacturaMonsa: 3,
  },
  {
    folioTail: "000009",
    consignee: "TRUPER",
    shipper: "N/D (acarreo local)",
    tipoOperacion: "TERRESTRE",
    modalidad: "LTL",
    incoterm: "N/A",
    statusShipment: "PARA_CERRAR",
    estatusMaterial: "TERRESTRE",
    montoVenta: 3500,
    montoCompra: 3516.83, // venta 3500 - profit real (-16.83) => embarque con PERDIDA real
    proveedor: { nombre: "MGC TRANSPORTE TERRESTRE", tipo: "TRANSPORTISTA" },
    origen: "AICM",
    destino: "Bodega Arrieta (resguardo)",
    etd: "2026-06-05",
    eta: "2026-06-05",
    poCliente: "FLETE TERRESTRE AIFA-RESGUARDO LOCAL/9003135621",
    numeroFacturaMonsa: 5,
  },
];

async function sembrarCatalogos() {
  console.log("Sembrando usuarios base...");
  // El hash se calcula una sola vez y se reutiliza: bcrypt con 10 rondas es
  // deliberadamente lento, y hacerlo por usuario alargaria el seed sin motivo.
  const passwordHash = await bcrypt.hash(PASSWORD_DESARROLLO, 10);
  const passwordHashAdmin = await bcrypt.hash(PASSWORD_ADMIN, 10);

  // update lleva passwordHash para que una base sembrada ANTES del modulo de
  // auth (usuarios sin credenciales) quede utilizable con solo volver a correr
  // el seed, sin tener que resetear la base.
  const karen = await prisma.usuario.upsert({
    where: { email: "karen@monsaglobalcargo.com" },
    update: { passwordHash },
    create: {
      nombre: "Karen",
      email: "karen@monsaglobalcargo.com",
      rol: "VENTAS",
      passwordHash,
    },
  });
  const araceli = await prisma.usuario.upsert({
    where: { email: "araceli@monsaglobalcargo.com" },
    update: { passwordHash },
    create: {
      nombre: "Araceli",
      email: "araceli@monsaglobalcargo.com",
      rol: "CUSTOMER_SERVICE",
      passwordHash,
    },
  });
  // Usuario ADMIN para poder entrar al sistema sin depender de un rol
  // operativo concreto mientras la matriz de permisos por rol no exista.
  await prisma.usuario.upsert({
    where: { email: "admin@monsaglobalcargo.com" },
    update: { passwordHash: passwordHashAdmin },
    create: {
      nombre: "Administrador MGC",
      email: "admin@monsaglobalcargo.com",
      rol: "ADMIN",
      passwordHash: passwordHashAdmin,
    },
  });

  console.log("Sembrando navieras / coloaders de la hoja LISTAS...");
  const navieras = [
    "HAPAG-LLOYD",
    "MSC MEDITERRANEAN SHIPPING COMPANY",
    "COSCO SHIPPING CO. LTD",
    "WAN HAI LINE",
  ];
  for (const nombre of navieras) {
    const existe = await prisma.proveedor.findFirst({ where: { nombre } });
    if (!existe) {
      await prisma.proveedor.create({
        data: { nombre, tipo: "NAVIERA", estatus: "EN_HOMOLOGACION" },
      });
    }
  }
  const coloaders = ["AMASS", "ECULINE", "FAMOUS PACIFIC SHIPPING MEXICO"];
  for (const nombre of coloaders) {
    const existe = await prisma.proveedor.findFirst({ where: { nombre } });
    if (!existe) {
      await prisma.proveedor.create({
        data: { nombre, tipo: "COLOADER", estatus: "EN_HOMOLOGACION" },
      });
    }
  }

  return { karen, araceli };
}

async function sembrarEmbarquesReales(karenId: string, araceliId: string) {
  const yaSembrado = await prisma.shipment.findFirst();
  if (yaSembrado) {
    console.log("Embarques reales ya sembrados; se omite el bloque 2.");
    return;
  }

  console.log("Sembrando 5 embarques reales de la hoja MONSA26...");
  for (const e of EMBARQUES) {
    const cliente = await upsertClienteActivo(e.consignee, {
      diasCredito: 30,
      limiteCredito: 500000,
    });
    const proveedor = await upsertProveedorActivo(e.proveedor.nombre, e.proveedor.tipo, {
      origen: e.origen,
      destino: e.destino,
      modalidad: e.modalidad,
    });

    const cotizacion = await prisma.cotizacion.create({
      data: {
        folio: `COT26${e.folioTail}`,
        clienteId: cliente.id,
        vendedorId: karenId,
        incoterm: e.incoterm,
        modalidad: e.modalidad,
        origen: e.origen,
        destino: e.destino,
        montoVenta: new Prisma.Decimal(e.montoVenta),
        montoCompra: new Prisma.Decimal(e.montoCompra),
        moneda: "USD",
        status: "ACEPTADA",
      },
    });

    // Routing Order en RECIBIDO: la cadena real ya paso el gate 3. Los campos
    // finos no venian en el Excel (ASUNCION).
    await prisma.routingOrder.create({
      data: {
        cotizacionId: cotizacion.id,
        status: "RECIBIDO",
        fechaRecibido: new Date(e.etd),
        shipperNombre: e.shipper,
        pol: e.origen,
        pod: e.destino,
        destinoFinal: e.destino,
        agenteId: proveedor.id,
      },
    });

    const booking = await prisma.booking.create({
      data: {
        cotizacionId: cotizacion.id,
        proveedorId: proveedor.id,
        referencia: e.mbl ?? null,
        status: "CONFIRMADO",
        confirmadoEn: new Date(e.etd),
      },
    });

    const shipment = await prisma.shipment.create({
      data: {
        folio: `MGC26${e.folioTail}`,
        bookingId: booking.id,
        tipoOperacion: e.tipoOperacion,
        modalidad: e.modalidad,
        status: e.statusShipment,
        estatusMaterial: e.estatusMaterial,
        consigneeId: cliente.id,
        shipperNombre: e.shipper,
        customerServiceId: araceliId,
        incoterm: e.incoterm,
        poCliente: e.poCliente ?? null,
        vessel: e.vessel ?? null,
        voyage: e.voyage ?? null,
        puertoOrigen: e.origen,
        paisOrigen: e.paisOrigen ?? null,
        puertoDestino: e.tipoOperacion === "IMPORTACION" ? e.destino : null,
        destinoFinal: e.destino,
        etd: new Date(e.etd),
        eta: new Date(e.eta),
        grossWeight: e.grossWeight != null ? new Prisma.Decimal(e.grossWeight) : null,
        cbm: e.cbm != null ? new Prisma.Decimal(e.cbm) : null,
        totalItems: e.totalItems ?? null,
        // ASUNCION: valorizacion = los montos de la cotizacion (el Excel no
        // capturaba costo/venta reales aparte). Deja el gate 6 satisfecho para
        // los folios que ya tienen factura.
        valorizacionVenta: new Prisma.Decimal(e.montoVenta),
        valorizacionCompra: new Prisma.Decimal(e.montoCompra),
        valorizacionConfirmada: true,
        valorizacionConfirmadaEn: new Date(e.eta),
        expedienteFisico: e.numeroFacturaMonsa != null,
      },
    });

    if (e.mbl) {
      await prisma.documento.create({
        data: { shipmentId: shipment.id, mbl: e.mbl },
      });
    }
    if (e.contenedorTipo) {
      await prisma.contenedor.create({
        data: { shipmentId: shipment.id, tipo: e.contenedorTipo },
      });
    }

    // CuentaPorPagar al proveedor de flete. En el Excel ("CONTROL DE PAGOS")
    // algunos ya estaban pagados y otros no; se refleja esa mezcla.
    const pagoConfirmado = e.folioTail === "000006" || e.folioTail === "000007";
    await prisma.cuentaPorPagar.create({
      data: {
        proveedorId: proveedor.id,
        shipmentId: shipment.id,
        numeroFactura: e.mbl ?? null,
        monto: new Prisma.Decimal(e.montoCompra),
        moneda: "USD",
        fechaSolicitud: new Date(e.etd),
        fechaLimitePago: new Date(new Date(e.eta).getTime() + 15 * 86400000),
        fechaPagoConfirmado: pagoConfirmado
          ? new Date(new Date(e.eta).getTime() + 10 * 86400000)
          : null,
      },
    });

    // Factura + CuentaPorCobrar para los folios que en el Excel ya tenian
    // "No FACTURA" Monsa. Nota: el gate del service exige PARA_FACTURAR; el
    // seed refleja el estado real del Excel (PARA_CERRAR con factura ya
    // emitida) escribiendo directo, sin pasar por crearFactura()/marcarTimbrada().
    // ASUNCION: representan CFDIs ya emitidos segun el historico -> TIMBRADA
    // directo, metodoPago PUE (sin dato real en el Excel, no genera
    // complementos de pago retroactivos), con un concepto unico reconstruido
    // del monto total.
    if (e.numeroFacturaMonsa != null) {
      const factura = await prisma.factura.create({
        data: {
          shipmentId: shipment.id,
          tipo: "FINAL",
          numeroFactura: `MGC-FACT-${String(e.numeroFacturaMonsa).padStart(6, "0")}`,
          montoSinIva: new Prisma.Decimal(e.montoVenta),
          moneda: "USD",
          estatus: "TIMBRADA",
          cfdiUuid: `SIMULADO-SEED-${e.folioTail}`,
          fechaTimbrado: new Date(e.eta),
          metodoPago: "PUE",
          formaPago: "99",
          conceptos: {
            create: {
              claveProdServ: "78101803",
              claveUnidad: "E48",
              unidad: "Servicio",
              cantidad: 1,
              descripcion: `Servicio de freight forwarding - Embarque MGC26${e.folioTail}`,
              valorUnitario: new Prisma.Decimal(e.montoVenta),
              importe: new Prisma.Decimal(e.montoVenta),
              objetoImpuesto: "02",
              ivaTasa: 16,
              ivaImporte: new Prisma.Decimal(e.montoVenta * 0.16),
            },
          },
        },
      });

      const fechaEmision = new Date(e.eta);
      const fechaVencimiento = new Date(fechaEmision.getTime() + 30 * 86400000);
      await prisma.cuentaPorCobrar.create({
        data: {
          facturaId: factura.id,
          clienteId: cliente.id,
          monto: new Prisma.Decimal(e.montoVenta),
          moneda: "USD",
          fechaEmision,
          fechaVencimiento,
          estatusCobro: "PENDIENTE",
        },
      });
    }
  }
}

async function main() {
  const { karen, araceli } = await sembrarCatalogos();
  await sembrarEmbarquesReales(karen.id, araceli.id);
  console.log("Seed completado.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
