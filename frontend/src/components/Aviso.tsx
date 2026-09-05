import { CircleAlert, Info, LucideIcon, TriangleAlert } from "lucide-react";
import { ReactNode } from "react";

type TonoAviso = "info" | "bloqueo" | "error";

const tonos: Record<TonoAviso, { caja: string; icono: LucideIcon; color: string }> = {
  info: {
    caja: "border-teal-200 bg-teal-50 text-teal-800 dark:border-teal-900 dark:bg-teal-900/20 dark:text-teal-300",
    icono: Info,
    color: "text-teal-600 dark:text-teal-400",
  },
  // "bloqueo" es el aviso de un gate de la cascada: no es un error, es el
  // sistema explicando que falta para avanzar.
  bloqueo: {
    caja: "border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-900 dark:bg-amber-900/20 dark:text-amber-300",
    icono: TriangleAlert,
    color: "text-amber-500 dark:text-amber-400",
  },
  error: {
    caja: "border-rose-200 bg-rose-50 text-rose-800 dark:border-rose-900 dark:bg-rose-900/20 dark:text-rose-300",
    icono: CircleAlert,
    color: "text-rose-500 dark:text-rose-400",
  },
};

// Caja de aviso compartida. Antes cada pagina repetia su propio <p> con
// clases sueltas; esto unifica el tono y el espaciado en todo el sistema.
export function Aviso({
  tono = "info",
  children,
  className = "",
}: {
  tono?: TonoAviso;
  children: ReactNode;
  className?: string;
}) {
  const t = tonos[tono];
  return (
    <div
      className={`no-imprimir flex items-start gap-2.5 rounded-lg border px-3.5 py-2.5 text-xs leading-relaxed ${t.caja} ${className}`}
      role={tono === "error" ? "alert" : undefined}
    >
      <t.icono size={15} strokeWidth={2} className={`mt-px shrink-0 ${t.color}`} aria-hidden />
      <div className="min-w-0">{children}</div>
    </div>
  );
}
