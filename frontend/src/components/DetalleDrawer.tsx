import { X } from "lucide-react";
import { ReactNode, useEffect } from "react";

export interface CampoDetalle {
  label: string;
  valor: ReactNode;
  // Un campo ancho ocupa la fila completa (direcciones, comentarios, rutas).
  ancho?: boolean;
}

export interface GrupoDetalle {
  titulo: string;
  campos: CampoDetalle[];
}

interface DetalleDrawerProps {
  titulo: string;
  subtitulo?: ReactNode;
  grupos: GrupoDetalle[];
  onClose: () => void;
  // Acciones del pie (editar, imprimir, enviar...). Opcional.
  acciones?: ReactNode;
}

// Panel lateral de solo lectura con TODOS los campos del registro, no solo los
// que caben en la tabla. Es la accion "Ver" compartida por todos los modulos.
export function DetalleDrawer({
  titulo,
  subtitulo,
  grupos,
  onClose,
  acciones,
}: DetalleDrawerProps) {
  // Escape cierra el panel: es una vista de consulta, salir tiene que ser
  // barato. Tambien se bloquea el scroll del fondo mientras esta abierto.
  useEffect(() => {
    const alPresionar = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", alPresionar);
    const overflowPrevio = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", alPresionar);
      document.body.style.overflow = overflowPrevio;
    };
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex justify-end" role="dialog" aria-modal="true">
      <div
        className="absolute inset-0 bg-navy-900/25 backdrop-blur-[1px]"
        onMouseDown={onClose}
        aria-hidden
      />

      <aside className="relative flex h-full w-full max-w-xl flex-col border-l border-slate-200 bg-white shadow-panel dark:border-slate-800 dark:bg-slate-900">
        <header className="flex items-start justify-between gap-4 border-b border-slate-100 px-5 py-4 dark:border-slate-800">
          <div className="min-w-0">
            <h2 className="truncate text-base font-semibold text-slate-900 dark:text-slate-100">{titulo}</h2>
            {subtitulo && <div className="mt-1 text-sm text-slate-500 dark:text-slate-400">{subtitulo}</div>}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar"
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-slate-200"
          >
            <X size={16} strokeWidth={2} aria-hidden />
          </button>
        </header>

        <div className="flex-1 space-y-6 overflow-y-auto px-5 py-5">
          {grupos.map((grupo) => (
            <section key={grupo.titulo}>
              <h3 className="mb-2.5 text-etiqueta font-semibold uppercase text-teal-700 dark:text-teal-400">
                {grupo.titulo}
              </h3>
              <dl className="grid grid-cols-2 gap-x-5 gap-y-3.5">
                {grupo.campos.map((campo) => (
                  <div key={campo.label} className={campo.ancho ? "col-span-2" : ""}>
                    <dt className="text-[11px] font-medium uppercase tracking-wide text-slate-400 dark:text-slate-500">
                      {campo.label}
                    </dt>
                    <dd className="mt-0.5 break-words text-sm text-slate-800 dark:text-slate-200">{campo.valor}</dd>
                  </div>
                ))}
              </dl>
            </section>
          ))}
        </div>

        {acciones && (
          <footer className="flex flex-wrap items-center justify-end gap-2 border-t border-slate-100 bg-slate-50/60 px-5 py-3 dark:border-slate-800 dark:bg-slate-800/40">
            {acciones}
          </footer>
        )}
      </aside>
    </div>
  );
}
