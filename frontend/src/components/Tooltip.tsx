import { ReactNode } from "react";

interface TooltipProps {
  texto?: string | null;
  children: ReactNode;
  posicion?: "arriba" | "abajo" | "izquierda";
  className?: string;
}

// Tooltip en CSS puro. Existe sobre todo para los botones deshabilitados por
// la cascada: el gate se explica, no se esconde (CLAUDE.md seccion 2). Un
// boton con disabled no dispara eventos de raton, asi que el hover se escucha
// en este contenedor y no en el boton.
export function Tooltip({ texto, children, posicion = "arriba", className = "" }: TooltipProps) {
  if (!texto) return <>{children}</>;

  const ubicacion = {
    arriba: "bottom-full left-1/2 -translate-x-1/2 mb-2",
    abajo: "top-full left-1/2 -translate-x-1/2 mt-2",
    izquierda: "right-full top-1/2 -translate-y-1/2 mr-2",
  }[posicion];

  return (
    <span className={`group/tip relative inline-flex ${className}`}>
      {children}
      <span
        role="tooltip"
        className={`pointer-events-none absolute z-50 hidden w-max max-w-xs rounded-lg bg-navy-800 px-2.5 py-1.5 text-xs font-normal leading-snug text-white shadow-panel group-hover/tip:block group-focus-within/tip:block ${ubicacion}`}
      >
        {texto}
      </span>
    </span>
  );
}
