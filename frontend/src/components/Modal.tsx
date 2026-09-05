import { X } from "lucide-react";
import { ReactNode, useEffect } from "react";

interface ModalProps {
  titulo: string;
  descripcion?: string;
  onClose: () => void;
  children: ReactNode;
  maxWidth?: string;
}

// Modal estandar: fondo oscurecido discreto, tarjeta blanca con borde tenue.
// Sin gradientes. La accion primaria del formulario va dentro del children.
export function Modal({
  titulo,
  descripcion,
  onClose,
  children,
  maxWidth = "max-w-md",
}: ModalProps) {
  useEffect(() => {
    const alPresionar = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", alPresionar);
    return () => document.removeEventListener("keydown", alPresionar);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-navy-900/30 p-4 backdrop-blur-[1px] sm:items-center"
      onMouseDown={onClose}
      role="dialog"
      aria-modal="true"
    >
      <div
        className={`w-full ${maxWidth} rounded-xl border border-slate-200 bg-white shadow-panel`}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4 border-b border-slate-100 px-5 py-4">
          <div className="min-w-0">
            <h2 className="text-base font-semibold text-slate-900">{titulo}</h2>
            {descripcion && (
              <p className="mt-1 text-xs leading-relaxed text-slate-500">{descripcion}</p>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar"
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700"
          >
            <X size={15} strokeWidth={2} aria-hidden />
          </button>
        </div>
        <div className="px-5 py-4">{children}</div>
      </div>
    </div>
  );
}
