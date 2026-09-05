import { prisma } from "@/config/prisma";
import { ReglaDeNegocioError } from "@/shared/middleware/errorHandler";
import { EMISOR_CFDI } from "@/shared/datosFiscalesEmisor";
import {
  CampoDoc,
  DisponibilidadDocumento,
  DocumentoRenderizable,
  SeccionDoc,
} from "./reporte.tipos";

// ---------------------------------------------------------------------------
// Modulo de reportes y documentos.
//
// Regla del modulo (extension natural de la cascada, CLAUDE.md seccion 2): un
// documento solo se puede generar cuando el dato que representa ya existe.
// Cada generador empieza por su propio gate y lanza ReglaDeNegocioError con el
// motivo exacto; el frontend usa ese mismo motivo como tooltip del boton
// deshabilitado, para que el bloqueo se explique y no se esconda.
// ---------------------------------------------------------------------------

const NO_CAPTURADO = "—";

function texto(v: unknown): string {
  if (v === null || v === undefined) return NO_CAPTURADO;
  const s = String(v).trim();
  return s === "" ? NO_CAPTURADO : s;
}

function fecha(v: Date | null | undefined): string {
  if (!v) return NO_CAPTURADO;
  return v.toLocaleDateString("es-MX", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
}

function dinero(monto: unknown, moneda: string): string {
  const n = Number(monto ?? 0);
  return `${moneda} ${n.toLocaleString("es-MX", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function campo(label: string, valor: unknown, ancho: CampoDoc["ancho"] = 1): CampoDoc {
  return { label, valor: texto(valor), ancho };
}

// ---------------------------------------------------------------------------
// Confirmacion de booking
// ---------------------------------------------------------------------------

// GATE: solo un booking CONFIRMADO tiene algo que confirmar. Un booking
// SOLICITADO todavia no tiene espacio reservado con el carrier; emitir el
// documento ahi seria prometerle al cliente algo que no existe.
export async function confirmacionBooking(bookingId: string): Promise<DocumentoRenderizable> {
  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    include: {
      proveedor: true,
      cotizacion: { include: { cliente: true } },
      shipment: true,
    },
  });
  if (!booking) {
    throw new ReglaDeNegocioError("Booking no encontrado", 404);
  }
  if (booking.status !== "CONFIRMADO") {
    throw new ReglaDeNegocioError(
      `No se puede emitir la confirmacion: el booking esta en status ${booking.status} y debe estar CONFIRMADO.`
    );
  }

  const { cotizacion, proveedor } = booking;
  const cliente = cotizacion.cliente;

  const secciones: SeccionDoc[] = [
    {
      titulo: "Datos del booking",
      campos: [
        campo("Referencia del carrier (SO)", booking.referencia),
        campo("Fecha de confirmacion", fecha(booking.confirmadoEn)),
        campo("Cotizacion de origen", cotizacion.folio),
        campo("Proveedor / carrier", proveedor.nombre, 2),
        campo("Tipo de proveedor", proveedor.tipo.replaceAll("_", " ")),
      ],
    },
    {
      titulo: "Cliente",
      campos: [
        campo("Razon social", cliente.razonSocial, 2),
        campo("RFC", cliente.rfc),
        campo("Contacto", cliente.contactoNombre),
        campo("Correo", cliente.contactoEmail),
        campo("Telefono", cliente.contactoTel),
      ],
    },
    {
      titulo: "Servicio contratado",
      campos: [
        campo("Modalidad", cotizacion.modalidad),
        campo("Incoterm", cotizacion.incoterm),
        campo("Ruta", `${cotizacion.origen} → ${cotizacion.destino}`, 1),
        campo("Monto de venta", dinero(cotizacion.montoVenta, cotizacion.moneda)),
        campo("Vigencia de la tarifa", fecha(cotizacion.validaHasta)),
        campo(
          "Folio de embarque",
          booking.shipment?.folio ?? "por asignar al abrir el embarque"
        ),
      ],
    },
  ];

  return {
    tipo: "CONFIRMACION_BOOKING",
    titulo: "Confirmacion de booking",
    subtitulo: `${proveedor.nombre} · ${cotizacion.origen} → ${cotizacion.destino}`,
    folio: booking.referencia?.trim() || cotizacion.folio,
    fechaEmision: fecha(new Date()),
    secciones,
    notas: [
      "Este documento confirma la reserva de espacio con el carrier indicado. No es una factura ni un documento de transporte.",
      "Cualquier cambio de itinerario por parte de la linea sera notificado por customer service.",
    ],
    destinatarioEmail: cliente.contactoEmail,
    nombreArchivo: `confirmacion-booking-${(booking.referencia || cotizacion.folio).replace(/[^\w-]/g, "_")}.pdf`,
  };
}

// ---------------------------------------------------------------------------
// Carta de instrucciones (una version por modalidad)
// ---------------------------------------------------------------------------

// Las secciones especificas de cada modalidad estan modeladas a partir de la
// practica estandar de un freight forwarder mexicano y de los campos que el
// Excel MONSA26 ya capturaba por columna. La presentacion ejecutiva del
// proyecto (sistema-freight-forwarder.pptx) no esta versionada en este repo,
// asi que si el detalle oficial difiere en algun campo, el ajuste se hace aqui
// -- es el unico lugar donde se define el contenido de cada variante.
function seccionesPorModalidad(
  modalidad: string,
  s: {
    vessel: string | null;
    voyage: string | null;
    puertoOrigen: string | null;
    paisOrigen: string | null;
    puertoDestino: string | null;
    destinoFinal: string | null;
    etd: Date | null;
    eta: Date | null;
    grossWeight: unknown;
    cbm: unknown;
    totalItems: number | null;
    contenedores: { numero: string | null; tipo: string | null; sello: string | null }[];
    proveedor: string;
  }
): SeccionDoc[] {
  const pesoYBultos = [
    campo("Peso bruto (kg)", s.grossWeight),
    campo("Volumen (CBM)", s.cbm),
    campo("Total de bultos / piezas", s.totalItems),
  ];

  if (modalidad === "FCL") {
    return [
      {
        titulo: "Ruta maritima (FCL)",
        campos: [
          campo("Naviera", s.proveedor, 2),
          campo("Buque / viaje", [s.vessel, s.voyage].filter(Boolean).join(" / ")),
          campo("Puerto de embarque (POL)", s.puertoOrigen),
          campo("Pais de origen", s.paisOrigen),
          campo("Puerto de descarga (POD)", s.puertoDestino),
          campo("Destino final", s.destinoFinal, 2),
          campo("ETD", fecha(s.etd)),
          campo("ETA", fecha(s.eta)),
        ],
      },
      {
        titulo: "Equipo y carga",
        campos: [
          ...(s.contenedores.length
            ? s.contenedores.map((c, i) =>
                campo(
                  `Contenedor ${i + 1}`,
                  [c.numero, c.tipo, c.sello ? `sello ${c.sello}` : null]
                    .filter(Boolean)
                    .join(" · ")
                )
              )
            : [campo("Contenedores", null, 3)]),
          ...pesoYBultos,
        ],
      },
    ];
  }

  if (modalidad === "LCL") {
    return [
      {
        titulo: "Ruta maritima (LCL / carga consolidada)",
        campos: [
          campo("Coloader / consolidador", s.proveedor, 2),
          campo("Buque / viaje", [s.vessel, s.voyage].filter(Boolean).join(" / ")),
          campo("Puerto de embarque (POL)", s.puertoOrigen),
          campo("Pais de origen", s.paisOrigen),
          campo("Puerto de descarga (POD)", s.puertoDestino),
          campo("CFS / destino final", s.destinoFinal, 2),
          campo("ETD", fecha(s.etd)),
          campo("ETA", fecha(s.eta)),
        ],
      },
      {
        titulo: "Carga suelta",
        campos: [
          ...pesoYBultos,
          campo(
            "Nota de consolidacion",
            "Carga suelta: entregar en CFS de origen con marcas y numeros visibles.",
            3
          ),
        ],
      },
    ];
  }

  if (modalidad === "AEREO") {
    return [
      {
        titulo: "Ruta aerea",
        campos: [
          campo("Aerolinea / coloader aereo", s.proveedor, 2),
          campo("Vuelo", s.voyage),
          campo("Aeropuerto de origen", s.puertoOrigen),
          campo("Pais de origen", s.paisOrigen),
          campo("Aeropuerto de destino", s.puertoDestino),
          campo("Destino final", s.destinoFinal, 2),
          campo("Salida estimada (ETD)", fecha(s.etd)),
          campo("Llegada estimada (ETA)", fecha(s.eta)),
        ],
      },
      {
        titulo: "Carga aerea",
        campos: [
          ...pesoYBultos,
          campo(
            "Nota de peso",
            "El cargo se calcula sobre el mayor entre peso bruto y peso volumetrico.",
            3
          ),
        ],
      },
    ];
  }

  // TERRESTRE / FTL / LTL comparten la misma carta: el dato relevante es la
  // unidad y el par origen-destino por carretera, no puerto ni buque.
  return [
    {
      titulo: `Ruta terrestre (${modalidad})`,
      campos: [
        campo("Transportista", s.proveedor, 2),
        campo("Unidad / caja", s.vessel),
        campo("Origen de carga", s.puertoOrigen ?? s.paisOrigen, 2),
        campo("Destino de entrega", s.puertoDestino ?? s.destinoFinal, 2),
        campo("Fecha de carga", fecha(s.etd)),
        campo("Fecha estimada de entrega", fecha(s.eta)),
      ],
    },
    {
      titulo: "Carga",
      campos: [
        ...pesoYBultos,
        campo(
          "Nota de traslado",
          "Requiere carta porte y complemento de mercancias vigente para el traslado.",
          3
        ),
      ],
    },
  ];
}

// GATE: la carta de instrucciones se emite contra un embarque real. Como el
// Shipment solo nace de un booking CONFIRMADO (gate 5 de la cascada), que el
// embarque exista ya es la garantia de que hay booking en firme detras.
export async function cartaInstrucciones(shipmentId: string): Promise<DocumentoRenderizable> {
  const shipment = await prisma.shipment.findUnique({
    where: { id: shipmentId },
    include: {
      consignee: true,
      customerService: { select: { nombre: true, email: true } },
      documento: true,
      contenedores: true,
      booking: { include: { proveedor: true, cotizacion: true } },
    },
  });
  if (!shipment) {
    throw new ReglaDeNegocioError("Embarque no encontrado", 404);
  }
  if (shipment.status === "CANCELADO") {
    throw new ReglaDeNegocioError(
      "No se puede emitir la carta de instrucciones de un embarque CANCELADO."
    );
  }

  const secciones: SeccionDoc[] = [
    {
      titulo: "Datos generales",
      campos: [
        campo("Folio de embarque", shipment.folio),
        campo("Tipo de operacion", shipment.tipoOperacion),
        campo("Modalidad", shipment.modalidad),
        campo("Incoterm", shipment.incoterm ?? shipment.booking.cotizacion.incoterm),
        campo("PO / referencia del cliente", shipment.poCliente, 2),
        campo("Estatus del material", shipment.estatusMaterial),
        campo("Customer service", shipment.customerService?.nombre, 2),
      ],
    },
    {
      titulo: "Partes",
      campos: [
        campo("Shipper", shipment.shipperNombre, 3),
        campo("Consignee", shipment.consignee.razonSocial, 2),
        campo("RFC del consignee", shipment.consignee.rfc),
        campo("Contacto", shipment.consignee.contactoNombre),
        campo("Correo", shipment.consignee.contactoEmail),
        campo("Telefono", shipment.consignee.contactoTel),
      ],
    },
    ...seccionesPorModalidad(shipment.modalidad, {
      vessel: shipment.vessel,
      voyage: shipment.voyage,
      puertoOrigen: shipment.puertoOrigen,
      paisOrigen: shipment.paisOrigen,
      puertoDestino: shipment.puertoDestino,
      destinoFinal: shipment.destinoFinal,
      etd: shipment.etd,
      eta: shipment.eta,
      grossWeight: shipment.grossWeight,
      cbm: shipment.cbm,
      totalItems: shipment.totalItems,
      contenedores: shipment.contenedores,
      proveedor: shipment.booking.proveedor.nombre,
    }),
    {
      titulo: "Documentacion",
      campos: [
        campo("MBL", shipment.documento?.mbl),
        campo("HBL", shipment.documento?.hbl),
        campo("Manifiesto", shipment.documento?.manifiesto),
        campo("Emision MBL", shipment.documento?.estatusEmisionMbl),
        campo("Emision HBL", shipment.documento?.estatusEmisionHbl),
        campo("Booking del carrier", shipment.booking.referencia),
      ],
    },
  ];

  return {
    tipo: "CARTA_INSTRUCCIONES",
    titulo: `Carta de instrucciones · ${shipment.modalidad}`,
    subtitulo: `${shipment.consignee.razonSocial} · ${texto(shipment.puertoOrigen)} → ${texto(
      shipment.puertoDestino ?? shipment.destinoFinal
    )}`,
    folio: shipment.folio,
    fechaEmision: fecha(new Date()),
    secciones,
    notas: [
      "Documento de instrucciones operativas. Cualquier cambio debe confirmarse por escrito con customer service antes del cierre documental.",
      `Contacto de la cuenta: ${texto(shipment.customerService?.email)}`,
    ],
    destinatarioEmail: shipment.consignee.contactoEmail,
    nombreArchivo: `carta-instrucciones-${shipment.folio}.pdf`,
  };
}

// ---------------------------------------------------------------------------
// HBL / MBL — vista de solo lectura de lo capturado en Documento
// ---------------------------------------------------------------------------

// GATE: no se imprime un conocimiento de embarque cuyo numero todavia no se
// captura. Es un documento de transporte: sin numero no identifica nada.
export async function conocimientoEmbarque(
  shipmentId: string,
  tipo: "HBL" | "MBL"
): Promise<DocumentoRenderizable> {
  const shipment = await prisma.shipment.findUnique({
    where: { id: shipmentId },
    include: {
      consignee: true,
      documento: true,
      contenedores: true,
      booking: { include: { proveedor: true, cotizacion: true } },
    },
  });
  if (!shipment) {
    throw new ReglaDeNegocioError("Embarque no encontrado", 404);
  }

  const numero = tipo === "HBL" ? shipment.documento?.hbl : shipment.documento?.mbl;
  if (!numero?.trim()) {
    throw new ReglaDeNegocioError(
      `No se puede imprimir el ${tipo}: el numero de ${tipo} no esta capturado en la documentacion del embarque ${shipment.folio}.`
    );
  }

  const emision =
    tipo === "HBL" ? shipment.documento?.estatusEmisionHbl : shipment.documento?.estatusEmisionMbl;
  const emisor =
    tipo === "HBL"
      ? "MONSA GLOBAL CARGO (como agente de carga)"
      : shipment.booking.proveedor.nombre;

  const secciones: SeccionDoc[] = [
    {
      titulo: `Identificacion del ${tipo}`,
      campos: [
        campo(`Numero de ${tipo}`, numero, 2),
        campo("Tipo de emision", emision),
        campo("Emitido por", emisor, 2),
        campo("Embarque", shipment.folio),
        campo("Manifiesto", shipment.documento?.manifiesto),
        campo("Booking del carrier", shipment.booking.referencia),
      ],
    },
    {
      titulo: "Partes",
      campos: [
        campo("Shipper", shipment.shipperNombre, 3),
        campo("Consignee", shipment.consignee.razonSocial, 2),
        campo("RFC del consignee", shipment.consignee.rfc),
        campo("Notify", shipment.consignee.contactoNombre, 2),
        campo("Correo notify", shipment.consignee.contactoEmail),
      ],
    },
    {
      titulo: "Transporte",
      campos: [
        campo("Buque / vuelo", [shipment.vessel, shipment.voyage].filter(Boolean).join(" / "), 2),
        campo("Modalidad", shipment.modalidad),
        campo("Puerto de embarque", shipment.puertoOrigen),
        campo("Puerto de descarga", shipment.puertoDestino),
        campo("Destino final", shipment.destinoFinal),
        campo("ETD", fecha(shipment.etd)),
        campo("ETA", fecha(shipment.eta)),
        campo("Incoterm", shipment.incoterm ?? shipment.booking.cotizacion.incoterm),
      ],
    },
    {
      titulo: "Descripcion de la carga",
      campos: [
        campo("Peso bruto (kg)", shipment.grossWeight),
        campo("Volumen (CBM)", shipment.cbm),
        campo("Total de bultos", shipment.totalItems),
        ...(shipment.contenedores.length
          ? shipment.contenedores.map((c, i) =>
              campo(
                `Contenedor ${i + 1}`,
                [c.numero, c.tipo, c.sello ? `sello ${c.sello}` : null].filter(Boolean).join(" · ")
              )
            )
          : []),
      ],
    },
  ];

  return {
    tipo,
    titulo: tipo === "HBL" ? "House Bill of Lading (HBL)" : "Master Bill of Lading (MBL)",
    subtitulo: `${numero} · ${shipment.consignee.razonSocial}`,
    folio: shipment.folio,
    fechaEmision: fecha(new Date()),
    secciones,
    notas: [
      "Reproduccion de los datos capturados en el sistema para consulta e impresion interna. No sustituye al documento original emitido por la linea.",
    ],
    destinatarioEmail: shipment.consignee.contactoEmail,
    nombreArchivo: `${tipo.toLowerCase()}-${shipment.folio}.pdf`,
  };
}

// ---------------------------------------------------------------------------
// Factura (CFDI) y Complemento de pago
//
// Reusan la misma estructura DocumentoRenderizable que el resto del modulo:
// no hace falta maquetacion nueva en el PDF ni en la vista imprimible, ambos
// ya son genericos sobre secciones de campos etiqueta/valor.
// ---------------------------------------------------------------------------

// GATE: solo se imprime un CFDI ya timbrado. Mientras sigue BORRADOR o
// PENDIENTE_TIMBRADO es una captura en revision, no un documento fiscal real.
export async function facturaCfdi(facturaId: string): Promise<DocumentoRenderizable> {
  const factura = await prisma.factura.findUnique({
    where: { id: facturaId },
    include: { shipment: { include: { consignee: true } }, conceptos: true },
  });
  if (!factura) {
    throw new ReglaDeNegocioError("Factura no encontrada", 404);
  }
  if (factura.tipo === "FINAL" && factura.estatus !== "TIMBRADA" && factura.estatus !== "CANCELADA") {
    throw new ReglaDeNegocioError(
      `No se puede emitir el CFDI: la factura esta en estatus ${factura.estatus} y debe estar TIMBRADA.`
    );
  }

  const cliente = factura.shipment.consignee;
  const ivaTotal = factura.conceptos.reduce((acc, c) => acc + Number(c.ivaImporte), 0);
  const retencionIva = factura.retencionIvaTasa
    ? (Number(factura.montoSinIva) * Number(factura.retencionIvaTasa)) / 100
    : 0;
  const retencionIsr = factura.retencionIsrTasa
    ? (Number(factura.montoSinIva) * Number(factura.retencionIsrTasa)) / 100
    : 0;
  const total = Number(factura.montoSinIva) + ivaTotal - retencionIva - retencionIsr;

  const secciones: SeccionDoc[] = [
    {
      titulo: "Emisor",
      campos: [
        campo("RFC", EMISOR_CFDI.rfc),
        campo("Razon social", EMISOR_CFDI.razonSocial, 2),
        campo("Regimen fiscal", EMISOR_CFDI.regimenFiscal),
      ],
    },
    {
      titulo: "Receptor",
      campos: [
        campo("RFC", cliente.rfc),
        campo("Razon social", cliente.razonSocial, 2),
        campo("Regimen fiscal", factura.regimenFiscalReceptor),
        campo("Uso CFDI", factura.usoCfdi),
        campo("Codigo postal", factura.codigoPostalReceptor),
      ],
    },
    {
      titulo: "Comprobante",
      campos: [
        campo("Folio", factura.numeroFactura),
        campo("Tipo", factura.tipo),
        campo("Estatus", factura.estatus),
        campo("Fecha de emision", fecha(factura.creadoEn)),
        campo("Fecha de timbrado", fecha(factura.fechaTimbrado)),
        campo("UUID fiscal", factura.cfdiUuid, 2),
        campo("Moneda", factura.moneda),
        campo("Tipo de cambio", factura.tipoCambio ? String(factura.tipoCambio) : null),
        campo("Forma de pago", factura.formaPago),
        campo("Metodo de pago", factura.metodoPago),
        campo("Condiciones de pago", factura.condicionesPago, 2),
        campo("Embarque", factura.shipment.folio),
        ...(factura.estatus === "CANCELADA"
          ? [
              campo("Motivo de cancelacion", factura.motivoCancelacion),
              campo("Fecha de cancelacion", fecha(factura.fechaCancelacion)),
              campo("UUID que sustituye", factura.folioSustitucionUuid, 2),
            ]
          : []),
      ],
    },
    {
      titulo: "Conceptos",
      campos: factura.conceptos.map((c, i) =>
        campo(
          `Concepto ${i + 1}`,
          `${c.claveProdServ}/${c.claveUnidad} · ${Number(c.cantidad)} ${c.unidad ?? ""} — ${c.descripcion} · ${dinero(c.valorUnitario, factura.moneda)} c/u = ${dinero(c.importe, factura.moneda)} (IVA ${dinero(c.ivaImporte, factura.moneda)})`,
          3
        )
      ),
    },
    {
      titulo: "Totales",
      campos: [
        campo("Subtotal", dinero(factura.montoSinIva, factura.moneda)),
        campo("IVA", dinero(ivaTotal, factura.moneda)),
        ...(retencionIva ? [campo("Retencion IVA", dinero(retencionIva, factura.moneda))] : []),
        ...(retencionIsr ? [campo("Retencion ISR", dinero(retencionIsr, factura.moneda))] : []),
        campo("Total", dinero(total, factura.moneda)),
      ],
    },
  ];

  return {
    tipo: "FACTURA",
    titulo:
      factura.estatus === "CANCELADA"
        ? "Factura (CFDI) — CANCELADA"
        : factura.tipo === "PROFORMA"
          ? "Factura proforma"
          : "Factura (CFDI)",
    subtitulo: `${cliente.razonSocial} · Embarque ${factura.shipment.folio}`,
    folio: factura.numeroFactura,
    fechaEmision: fecha(new Date()),
    secciones,
    notas: [
      factura.estatus === "CANCELADA"
        ? "Este CFDI esta CANCELADO. Se conserva unicamente como referencia historica."
        : factura.tipo === "PROFORMA"
          ? "Documento de referencia para el cliente. No es un CFDI, no timbra ante el PAC."
          : "Reproduccion de los datos capturados en el sistema. El timbrado ante el PAC esta simulado.",
    ],
    destinatarioEmail: cliente.contactoEmail,
    nombreArchivo: `factura-${factura.numeroFactura}.pdf`,
  };
}

// GATE: el complemento solo existe ya timbrado o en camino a estarlo; nace
// automaticamente al registrar un cobro (cxc.service.registrarCobro), nunca
// antes de que exista ese cobro.
export async function complementoPagoDoc(id: string): Promise<DocumentoRenderizable> {
  const complemento = await prisma.complementoPago.findUnique({
    where: { id },
    include: { factura: { include: { shipment: { include: { consignee: true } } } } },
  });
  if (!complemento) {
    throw new ReglaDeNegocioError("Complemento de pago no encontrado", 404);
  }

  const { factura } = complemento;
  const cliente = factura.shipment.consignee;

  const secciones: SeccionDoc[] = [
    {
      titulo: "Emisor",
      campos: [campo("RFC", EMISOR_CFDI.rfc), campo("Razon social", EMISOR_CFDI.razonSocial, 2)],
    },
    {
      titulo: "Receptor",
      campos: [campo("RFC", cliente.rfc), campo("Razon social", cliente.razonSocial, 2)],
    },
    {
      titulo: "Pago",
      campos: [
        campo("Folio", complemento.folio),
        campo("Estatus", complemento.estatus),
        campo("Fecha de pago", fecha(complemento.fechaPago)),
        campo("UUID fiscal", complemento.cfdiUuid, 2),
        campo("Forma de pago", complemento.formaPago),
        campo("Num. de operacion", complemento.numOperacion),
        campo("Monto pagado", dinero(complemento.monto, complemento.moneda)),
        campo("Tipo de cambio", complemento.tipoCambio ? String(complemento.tipoCambio) : null),
        campo("Saldo anterior", dinero(complemento.saldoAnterior, complemento.moneda)),
        campo("Saldo insoluto", dinero(complemento.saldoInsoluto, complemento.moneda)),
        ...(complemento.estatus === "CANCELADA"
          ? [
              campo("Motivo de cancelacion", complemento.motivoCancelacion),
              campo("Fecha de cancelacion", fecha(complemento.fechaCancelacion)),
            ]
          : []),
      ],
    },
    {
      titulo: "Factura relacionada",
      campos: [
        campo("Folio de la factura", factura.numeroFactura),
        campo("UUID de la factura", factura.cfdiUuid, 2),
        campo("Embarque", factura.shipment.folio),
      ],
    },
  ];

  return {
    tipo: "COMPLEMENTO_PAGO",
    titulo: "Complemento de pago (REP)",
    subtitulo: `${cliente.razonSocial} · Factura ${factura.numeroFactura}`,
    folio: complemento.folio,
    fechaEmision: fecha(new Date()),
    secciones,
    notas: ["Reproduccion de los datos capturados en el sistema. El timbrado ante el PAC esta simulado."],
    destinatarioEmail: cliente.contactoEmail,
    nombreArchivo: `complemento-pago-${complemento.folio}.pdf`,
  };
}

// ---------------------------------------------------------------------------
// Catalogo de documentos con su disponibilidad segun la cascada
// ---------------------------------------------------------------------------

// Alimenta la pagina de Reportes: lista TODO lo generable del sistema, marcando
// lo que aun no se puede emitir y por que. Nunca oculta una fila: el bloqueo se
// explica, igual que en el resto de la UI.
export async function catalogoDocumentos(): Promise<DisponibilidadDocumento[]> {
  const [bookings, shipments, facturas, complementos] = await Promise.all([
    prisma.booking.findMany({
      include: { cotizacion: { include: { cliente: true } }, proveedor: true },
      orderBy: { creadoEn: "desc" },
    }),
    prisma.shipment.findMany({
      include: { consignee: true, documento: true },
      orderBy: { creadoEn: "desc" },
    }),
    prisma.factura.findMany({
      include: { shipment: { include: { consignee: true } } },
      orderBy: { creadoEn: "desc" },
    }),
    prisma.complementoPago.findMany({
      include: { factura: { include: { shipment: { include: { consignee: true } } } } },
      orderBy: { creadoEn: "desc" },
    }),
  ]);

  const filas: DisponibilidadDocumento[] = [];

  for (const b of bookings) {
    filas.push({
      tipo: "CONFIRMACION_BOOKING",
      titulo: "Confirmacion de booking",
      entidad: "booking",
      entidadId: b.id,
      referencia: b.referencia?.trim() || b.cotizacion.folio,
      cliente: b.cotizacion.cliente.razonSocial,
      disponible: b.status === "CONFIRMADO",
      motivoBloqueo:
        b.status === "CONFIRMADO"
          ? null
          : `El booking esta en status ${b.status}. Confirmalo para poder emitir la confirmacion.`,
    });
  }

  for (const s of shipments) {
    filas.push({
      tipo: "CARTA_INSTRUCCIONES",
      titulo: `Carta de instrucciones (${s.modalidad})`,
      entidad: "shipment",
      entidadId: s.id,
      referencia: s.folio,
      cliente: s.consignee.razonSocial,
      disponible: s.status !== "CANCELADO",
      motivoBloqueo:
        s.status === "CANCELADO" ? "El embarque esta CANCELADO." : null,
    });
    filas.push({
      tipo: "HBL",
      titulo: "House Bill of Lading (HBL)",
      entidad: "shipment",
      entidadId: s.id,
      referencia: s.folio,
      cliente: s.consignee.razonSocial,
      disponible: !!s.documento?.hbl?.trim(),
      motivoBloqueo: s.documento?.hbl?.trim()
        ? null
        : "Falta capturar el numero de HBL en la documentacion del embarque.",
    });
    filas.push({
      tipo: "MBL",
      titulo: "Master Bill of Lading (MBL)",
      entidad: "shipment",
      entidadId: s.id,
      referencia: s.folio,
      cliente: s.consignee.razonSocial,
      disponible: !!s.documento?.mbl?.trim(),
      motivoBloqueo: s.documento?.mbl?.trim()
        ? null
        : "Falta capturar el numero de MBL en la documentacion del embarque.",
    });
  }

  for (const f of facturas) {
    const disponible = f.tipo === "PROFORMA" || f.estatus === "TIMBRADA";
    filas.push({
      tipo: "FACTURA",
      titulo: f.tipo === "PROFORMA" ? "Factura proforma" : "Factura (CFDI)",
      entidad: "factura",
      entidadId: f.id,
      referencia: f.numeroFactura,
      cliente: f.shipment.consignee.razonSocial,
      disponible,
      motivoBloqueo: disponible
        ? null
        : `La factura esta en estatus ${f.estatus}. Debe estar TIMBRADA para emitir el CFDI.`,
    });
  }

  for (const c of complementos) {
    filas.push({
      tipo: "COMPLEMENTO_PAGO",
      titulo: "Complemento de pago (REP)",
      entidad: "complemento-pago",
      entidadId: c.id,
      referencia: c.folio,
      cliente: c.factura.shipment.consignee.razonSocial,
      disponible: true,
      motivoBloqueo: null,
    });
  }

  return filas;
}
