// Badge de status: fondo suave + texto oscuro del mismo tono + un punto que
// permite distinguir el estado de un vistazo sin leer la etiqueta completa.
// Nunca texto negro sobre fondo de color.

type Tono = "gris" | "navy" | "teal" | "ambar" | "positivo" | "rojo" | "violeta";

const clasesTono: Record<Tono, { chip: string; punto: string }> = {
  gris: { chip: "bg-slate-100 text-slate-600", punto: "bg-slate-400" },
  navy: { chip: "bg-navy-50 text-navy-700", punto: "bg-navy-500" },
  teal: { chip: "bg-teal-50 text-teal-700", punto: "bg-teal-500" },
  ambar: { chip: "bg-amber-50 text-amber-700", punto: "bg-amber-400" },
  // "positivo" usa el teal de la marca, no un verde generico: el unico verde
  // del sistema es el de un cierre exitoso (emerald), reservado para eso.
  positivo: { chip: "bg-emerald-50 text-emerald-700", punto: "bg-emerald-500" },
  rojo: { chip: "bg-rose-50 text-rose-700", punto: "bg-rose-500" },
  violeta: { chip: "bg-violet-50 text-violet-700", punto: "bg-violet-500" },
};

// Mapa unico de status de dominio -> tono. Cubre cliente, proveedor, cotizacion,
// booking, shipment, PAC y cobranza.
const tonoPorStatus: Record<string, Tono> = {
  // Cliente
  PROSPECTO: "gris",
  EN_VALIDACION_KYC: "ambar",
  ACTIVO: "positivo",
  SUSPENDIDO: "rojo",
  // Proveedor
  EN_HOMOLOGACION: "ambar",
  // Cotizacion
  BORRADOR: "gris",
  ENVIADA: "navy",
  ACEPTADA: "positivo",
  RECHAZADA: "rojo",
  EXPIRADA: "gris",
  // Booking
  SOLICITADO: "ambar",
  CONFIRMADO: "teal",
  CANCELADO: "rojo",
  // Shipment
  NUEVO_EMBARQUE: "navy",
  BOOKING_CONFIRMED: "teal",
  PARA_CERRAR: "ambar",
  PARA_FACTURAR: "violeta",
  FACTURADO: "positivo",
  TERMINADO: "positivo",
  // PAC
  PENDIENTE: "ambar",
  TIMBRADO: "positivo",
  // Cobranza / pagos
  PARCIAL: "navy",
  COBRADA: "positivo",
  PAGADA: "positivo",
  VENCIDA: "rojo",
};

interface StatusBadgeProps {
  status: string;
  tono?: Tono;
}

export function StatusBadge({ status, tono }: StatusBadgeProps) {
  const clave = status?.toUpperCase?.() ?? "";
  const t = clasesTono[tono ?? tonoPorStatus[clave] ?? "gris"];
  return (
    <span
      className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-md px-2 py-0.5 text-xs font-medium ${t.chip}`}
    >
      <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${t.punto}`} aria-hidden />
      {String(status).replaceAll("_", " ")}
    </span>
  );
}
