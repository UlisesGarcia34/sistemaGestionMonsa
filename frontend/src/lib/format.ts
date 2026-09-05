// Formato consistente de dinero y fechas en toda la UI.

export function dinero(monto: number | string | null | undefined, moneda = "USD") {
  const n = typeof monto === "string" ? Number(monto) : (monto ?? 0);
  return `${moneda} ${n.toLocaleString("es-MX", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

// Version compacta para los KPI: 1.2M / 84.5k. Un dashboard con cifras de
// seis digitos completos pierde legibilidad de un vistazo.
export function dineroCompacto(monto: number | string | null | undefined, moneda = "USD") {
  const n = Number(monto ?? 0);
  const abs = Math.abs(n);
  if (abs >= 1_000_000) return `${moneda} ${(n / 1_000_000).toFixed(1)}M`;
  if (abs >= 10_000) return `${moneda} ${(n / 1_000).toFixed(1)}k`;
  return dinero(n, moneda);
}

export function fecha(valor: string | Date | null | undefined) {
  if (!valor) return "—";
  const d = typeof valor === "string" ? new Date(valor) : valor;
  // Las fechas operativas (ETD/ETA/vencimientos) se guardan a medianoche UTC.
  // Se formatean en UTC para no correrlas un dia por la zona horaria local.
  return d.toLocaleDateString("es-MX", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
}

// Valor para un <input type="date">, que exige exactamente "YYYY-MM-DD".
// Se corta el ISO en UTC por el mismo motivo que fecha(): usar la fecha local
// desplazaria un dia las fechas guardadas a medianoche UTC.
export function fechaInput(valor: string | Date | null | undefined) {
  if (!valor) return "";
  const d = typeof valor === "string" ? new Date(valor) : valor;
  if (Number.isNaN(d.getTime())) return "";
  return d.toISOString().slice(0, 10);
}

// Valor para un <input type="number">: "" cuando no hay dato, para que el
// campo quede vacio en vez de mostrar un 0 que nadie capturo.
export function numeroInput(valor: number | string | null | undefined) {
  if (valor === null || valor === undefined || valor === "") return "";
  return String(valor);
}

export function texto(v: string | null | undefined) {
  return v && v.trim() ? v : "—";
}

// Etiqueta legible de un enum del backend (MAYUSCULAS_CON_GUION_BAJO).
export function etiqueta(v: string | null | undefined) {
  return v ? v.replaceAll("_", " ") : "—";
}
