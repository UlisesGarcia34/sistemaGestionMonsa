import { LucideIcon } from "lucide-react";
import { ReactNode } from "react";

interface PageHeaderProps {
  titulo: string;
  descripcion?: string;
  icono?: LucideIcon;
  accion?: ReactNode;
  // Etiqueta corta a la derecha del titulo (ej. "Paso 3 de 5").
  distintivo?: string;
}

// Encabezado estandar de cada pagina: icono + titulo, subtitulo descriptivo y
// (opcional) una sola accion primaria a la derecha.
export function PageHeader({
  titulo,
  descripcion,
  icono: Icono,
  accion,
  distintivo,
}: PageHeaderProps) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-4">
      <div className="flex min-w-0 items-start gap-3">
        {Icono && (
          <span className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-navy text-white shadow-tarjeta">
            <Icono size={19} strokeWidth={1.9} aria-hidden />
          </span>
        )}
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-xl font-semibold tracking-tight text-slate-900 dark:text-slate-100">{titulo}</h1>
            {distintivo && (
              <span className="rounded-full bg-teal-50 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-teal-700 dark:bg-teal-900/40 dark:text-teal-300">
                {distintivo}
              </span>
            )}
          </div>
          {descripcion && (
            <p className="mt-1 max-w-3xl text-sm leading-relaxed text-slate-500 dark:text-slate-400">{descripcion}</p>
          )}
        </div>
      </div>
      {accion && <div className="shrink-0">{accion}</div>}
    </div>
  );
}
