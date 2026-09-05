// Espejo del contrato de modules/reportes del backend.
//
// El backend arma UNA sola estructura por documento y de ahi salen las dos
// representaciones: el PDF (pdf-lib, en el servidor) y la vista imprimible del
// navegador (@media print, aqui). Por eso este archivo solo declara tipos y
// arma URLs: el contenido nunca se reconstruye del lado del cliente.

export type TipoDocumento =
  | "CONFIRMACION_BOOKING"
  | "CARTA_INSTRUCCIONES"
  | "HBL"
  | "MBL"
  | "FACTURA"
  | "COMPLEMENTO_PAGO";

export interface CampoDoc {
  label: string;
  valor: string;
  ancho?: 1 | 2 | 3;
}

export interface SeccionDoc {
  titulo: string;
  campos: CampoDoc[];
}

export interface DocumentoRenderizable {
  tipo: TipoDocumento;
  titulo: string;
  subtitulo?: string;
  folio: string;
  fechaEmision: string;
  secciones: SeccionDoc[];
  notas?: string[];
  destinatarioEmail?: string | null;
  nombreArchivo: string;
}

export type EntidadDocumento = "booking" | "shipment" | "factura" | "complemento-pago";

export interface DisponibilidadDocumento {
  tipo: TipoDocumento;
  titulo: string;
  entidad: EntidadDocumento;
  entidadId: string;
  referencia: string;
  cliente: string;
  disponible: boolean;
  motivoBloqueo: string | null;
}

// Ruta de la API que devuelve el JSON del documento.
export function rutaApiDocumento(entidad: EntidadDocumento, id: string, tipo: TipoDocumento) {
  if (tipo === "CONFIRMACION_BOOKING") return `/reportes/booking/${id}/confirmacion`;
  if (tipo === "CARTA_INSTRUCCIONES") return `/reportes/shipment/${id}/carta-instrucciones`;
  if (tipo === "FACTURA") return `/reportes/factura/${id}/cfdi`;
  if (tipo === "COMPLEMENTO_PAGO") return `/reportes/complemento-pago/${id}/documento`;
  return `/reportes/shipment/${id}/conocimiento/${tipo.toLowerCase()}`;
}

// Ruta interna de la vista imprimible (sin sidebar, lista para Ctrl+P).
export function rutaVistaDocumento(entidad: EntidadDocumento, id: string, tipo: TipoDocumento) {
  return `/documentos/${entidad}/${id}/${tipo.toLowerCase()}`;
}

// El PDF cuelga de un segmento /pdf, no de una extension (ver comentario en
// backend/src/modules/reportes/reporte.routes.ts).
export function rutaPdfDocumento(entidad: EntidadDocumento, id: string, tipo: TipoDocumento) {
  return `${rutaApiDocumento(entidad, id, tipo)}/pdf`;
}

// Slug de la URL -> tipo del backend. La vista imprimible recibe el tipo en
// minusculas para que la URL sea legible.
export function tipoDesdeSlug(slug: string | undefined): TipoDocumento | null {
  switch (slug?.toLowerCase()) {
    case "confirmacion_booking":
    case "confirmacion":
      return "CONFIRMACION_BOOKING";
    case "carta_instrucciones":
    case "carta-instrucciones":
      return "CARTA_INSTRUCCIONES";
    case "hbl":
      return "HBL";
    case "mbl":
      return "MBL";
    case "factura":
      return "FACTURA";
    case "complemento_pago":
    case "complemento-pago":
      return "COMPLEMENTO_PAGO";
    default:
      return null;
  }
}
