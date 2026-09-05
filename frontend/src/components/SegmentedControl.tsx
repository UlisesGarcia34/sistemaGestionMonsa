import { LucideIcon } from "lucide-react";

interface Opcion<T extends string> {
  valor: T;
  label: string;
  contador?: number;
  icono?: LucideIcon;
}

interface SegmentedControlProps<T extends string> {
  opciones: Opcion<T>[];
  valor: T;
  onChange: (valor: T) => void;
}

// Toggle / segmented control para alternar datasets dentro de una misma vista
// (ej. Clientes / Proveedores en Contactos).
export function SegmentedControl<T extends string>({
  opciones,
  valor,
  onChange,
}: SegmentedControlProps<T>) {
  return (
    <div className="inline-flex rounded-xl border border-slate-200 bg-slate-100/70 p-1 shadow-tarjeta">
      {opciones.map((o) => {
        const activo = o.valor === valor;
        return (
          <button
            key={o.valor}
            type="button"
            onClick={() => onChange(o.valor)}
            aria-pressed={activo}
            className={`flex items-center gap-1.5 rounded-lg px-3.5 py-1.5 text-sm font-medium transition-all ${
              activo
                ? "bg-white text-navy-700 shadow-tarjeta"
                : "text-slate-500 hover:text-slate-700"
            }`}
          >
            {o.icono && <o.icono size={14} strokeWidth={2} aria-hidden />}
            {o.label}
            {o.contador != null && (
              <span
                className={`tabular ml-1 rounded-full px-1.5 py-0.5 text-[11px] font-semibold ${
                  activo ? "bg-navy-50 text-navy-700" : "bg-slate-200 text-slate-500"
                }`}
              >
                {o.contador}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
