import { LucideIcon } from "lucide-react";
import { ReactNode } from "react";

interface CardProps {
  titulo?: string;
  descripcion?: string;
  icono?: LucideIcon;
  acciones?: ReactNode;
  children: ReactNode;
  className?: string;
  bodyClassName?: string;
}

// Superficie estandar: borde tenue, sombra de contacto, radio consistente.
// El icono del encabezado ayuda a escanear una pantalla con varias tarjetas.
export function Card({
  titulo,
  descripcion,
  icono: Icono,
  acciones,
  children,
  className = "",
  bodyClassName = "",
}: CardProps) {
  return (
    <section
      className={`overflow-hidden rounded-xl border border-slate-200/80 bg-white shadow-tarjeta ${className}`}
    >
      {(titulo || acciones) && (
        <header className="flex items-center justify-between gap-3 border-b border-slate-100 px-4 py-3">
          <div className="flex min-w-0 items-center gap-2.5">
            {Icono && (
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-navy-50 text-navy-600">
                <Icono size={15} strokeWidth={2} aria-hidden />
              </span>
            )}
            <div className="min-w-0">
              {titulo && (
                <h2 className="truncate text-sm font-semibold text-slate-800">{titulo}</h2>
              )}
              {descripcion && (
                <p className="mt-0.5 truncate text-xs text-slate-500">{descripcion}</p>
              )}
            </div>
          </div>
          {acciones && <div className="shrink-0">{acciones}</div>}
        </header>
      )}
      <div className={bodyClassName || "p-4"}>{children}</div>
    </section>
  );
}
