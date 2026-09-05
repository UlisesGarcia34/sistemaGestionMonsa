import { LucideIcon, TriangleAlert } from "lucide-react";
import { ReactNode } from "react";

// Acento de la tarjeta. Solo colores de la paleta de marca; rojo y ambar
// quedan reservados para el dato que de verdad exige atencion (perdida,
// vencido) y nunca se usan como decoracion.
type Acento = "navy" | "teal" | "amber" | "riesgo";

interface KpiCardProps {
  etiqueta: string;
  valor: ReactNode;
  detalle?: ReactNode;
  icono: LucideIcon;
  acento?: Acento;
  // Aviso corto y discreto (ej. "1 con perdida"). Se pinta como badge con
  // icono de alerta, no como texto plano perdido entre el resto.
  alerta?: string | null;
  // Variacion contra el periodo anterior. Signo -> color; sin dato, no se pinta.
  delta?: { valor: string; positivo: boolean } | null;
}

const acentos: Record<Acento, { tile: string; valor: string; borde: string }> = {
  navy: {
    tile: "bg-navy-50 text-navy-600 dark:bg-navy-900/40 dark:text-navy-300",
    valor: "text-navy-700 dark:text-navy-300",
    borde: "bg-navy-500",
  },
  teal: {
    tile: "bg-teal-50 text-teal-600 dark:bg-teal-900/40 dark:text-teal-300",
    valor: "text-teal-700 dark:text-teal-300",
    borde: "bg-teal-500",
  },
  amber: {
    tile: "bg-amber-50 text-amber-600 dark:bg-amber-900/30 dark:text-amber-300",
    valor: "text-amber-700 dark:text-amber-300",
    borde: "bg-amber-400",
  },
  riesgo: {
    tile: "bg-rose-50 text-rose-600 dark:bg-rose-900/30 dark:text-rose-300",
    valor: "text-rose-700 dark:text-rose-300",
    borde: "bg-rose-500",
  },
};

// Tarjeta de indicador: icono acentuado arriba a la derecha, etiqueta en
// versalitas, un solo numero dominante y una linea de contexto debajo.
// Profundidad: borde muy tenue + sombra de contacto, sin gradientes.
export function KpiCard({
  etiqueta,
  valor,
  detalle,
  icono: Icono,
  acento = "navy",
  alerta,
  delta,
}: KpiCardProps) {
  const a = acentos[acento];

  return (
    <div className="group relative overflow-hidden rounded-xl border border-slate-200/80 bg-white p-4 shadow-tarjeta transition-shadow hover:shadow-elevada dark:border-slate-800 dark:bg-slate-900">
      {/* Filete de acento: da jerarquia de color sin tenir toda la tarjeta.
          A 2px no se percibia en pantalla; 3px es el minimo que se lee. */}
      <span className={`absolute inset-x-0 top-0 h-[3px] ${a.borde}`} aria-hidden />

      <div className="flex items-start justify-between gap-3">
        <p className="text-etiqueta font-semibold uppercase text-slate-500 dark:text-slate-400">{etiqueta}</p>
        <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${a.tile}`}>
          <Icono size={16} strokeWidth={2} aria-hidden />
        </span>
      </div>

      <div className="mt-2.5 flex items-baseline gap-2">
        <p className={`tabular text-2xl font-semibold leading-none ${a.valor}`}>{valor}</p>
        {delta && (
          <span
            className={`tabular text-xs font-medium ${
              delta.positivo ? "text-teal-600 dark:text-teal-400" : "text-rose-600 dark:text-rose-400"
            }`}
          >
            {delta.valor}
          </span>
        )}
      </div>

      {detalle && <p className="mt-2 text-xs leading-relaxed text-slate-500 dark:text-slate-400">{detalle}</p>}

      {alerta && (
        <p className="mt-2.5 inline-flex items-center gap-1.5 rounded-md bg-rose-50 px-2 py-1 text-xs font-medium text-rose-700 dark:bg-rose-900/30 dark:text-rose-300">
          <TriangleAlert size={13} strokeWidth={2.2} aria-hidden />
          {alerta}
        </p>
      )}
    </div>
  );
}
