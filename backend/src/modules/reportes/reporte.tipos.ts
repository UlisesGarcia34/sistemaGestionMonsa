// Estructura intermedia de cualquier documento del sistema.
//
// El service arma este objeto una sola vez y lo consumen DOS renderizadores
// distintos: el generador de PDF del backend (reporte.pdf.ts) y la vista
// imprimible del frontend (pages/reportes/DocumentoImprimible.tsx). Asi el PDF
// que se descarga y lo que el navegador imprime muestran exactamente los
// mismos datos -- no hay dos plantillas que se puedan desincronizar.

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
  // Columnas que ocupa el campo en la retícula de 3 (1 por defecto).
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
  // Folio del documento en si (MGC26000001, COT26000001...).
  folio: string;
  fechaEmision: string;
  secciones: SeccionDoc[];
  notas?: string[];
  // Correo del cliente, para prellenar el modal de "Enviar por correo".
  destinatarioEmail?: string | null;
  nombreArchivo: string;
}

// Estado de un documento frente a la cascada. El frontend usa esto para
// mostrar el boton deshabilitado con el motivo, en vez de esconderlo
// (CLAUDE.md seccion 2: los gates se comunican, no se ocultan).
export interface DisponibilidadDocumento {
  tipo: TipoDocumento;
  titulo: string;
  // Entidad de la que cuelga el documento, para armar la URL en el frontend.
  entidad: "booking" | "shipment" | "factura" | "complemento-pago";
  entidadId: string;
  referencia: string; // folio visible (del booking o del embarque)
  cliente: string;
  disponible: boolean;
  // Que falta para que se pueda generar. null cuando ya esta disponible.
  motivoBloqueo: string | null;
}
