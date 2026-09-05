import { ChevronRight, Eye, LucideIcon, Pencil } from "lucide-react";
import { Fragment, ReactNode, useState } from "react";
import { Tooltip } from "@/components/Tooltip";

interface Columna<T> {
  header: string;
  render: (row: T) => ReactNode;
  alinear?: "izq" | "der";
  className?: string;
}

// Accion adicional de fila (imprimir, timbrar, registrar cobro...). Se dibuja
// junto a Ver / Editar con el mismo lenguaje de icono + tooltip.
export interface AccionFila<T> {
  clave: string;
  label: string;
  icono: LucideIcon;
  onClick: (row: T) => void;
  // Devuelve el motivo por el que la accion no esta disponible en esta fila,
  // o null si si lo esta. El motivo se muestra como tooltip sobre el boton
  // deshabilitado: los gates de la cascada se explican, no se ocultan.
  deshabilitada?: (row: T) => string | null;
  // Para acciones que sencillamente no aplican al registro (no un bloqueo).
  oculta?: (row: T) => boolean;
  tono?: "normal" | "acento" | "peligro";
}

interface DataTableProps<T> {
  columnas: Columna<T>[];
  filas?: T[];
  cargando?: boolean;
  vacioMensaje?: string;
  keyExtractor: (row: T) => string;
  // Si se pasa, cada fila se puede expandir a una vista de detalle en linea
  // en vez de comprimir 10 columnas.
  renderDetalle?: (row: T) => ReactNode;
  // Columna de acciones compartida. Ver abre el panel de detalle completo;
  // Editar abre el formulario de los campos editables del registro.
  onVer?: (row: T) => void;
  onEditar?: (row: T) => void;
  edicionBloqueada?: (row: T) => string | null;
  accionesExtra?: AccionFila<T>[];
}

const tonosAccion = {
  normal: "text-slate-500 hover:bg-slate-100 hover:text-navy-700 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-teal-300",
  acento: "text-teal-600 hover:bg-teal-50 hover:text-teal-700 dark:text-teal-400 dark:hover:bg-teal-900/40 dark:hover:text-teal-300",
  peligro: "text-rose-500 hover:bg-rose-50 hover:text-rose-700 dark:text-rose-400 dark:hover:bg-rose-900/30 dark:hover:text-rose-300",
} as const;

function BotonAccion({
  label,
  icono: Icono,
  onClick,
  motivo,
  tono = "normal",
}: {
  label: string;
  icono: LucideIcon;
  onClick: () => void;
  motivo?: string | null;
  tono?: keyof typeof tonosAccion;
}) {
  const bloqueado = !!motivo;
  return (
    <Tooltip texto={bloqueado ? motivo : label} posicion="arriba">
      <button
        type="button"
        onClick={onClick}
        disabled={bloqueado}
        aria-label={label}
        className={`flex h-7 w-7 items-center justify-center rounded-md transition-colors disabled:cursor-not-allowed disabled:text-slate-300 disabled:hover:bg-transparent ${tonosAccion[tono]}`}
      >
        <Icono size={15} strokeWidth={1.9} aria-hidden />
      </button>
    </Tooltip>
  );
}

export function DataTable<T>({
  columnas,
  filas,
  cargando,
  vacioMensaje = "Sin registros todavia",
  keyExtractor,
  renderDetalle,
  onVer,
  onEditar,
  edicionBloqueada,
  accionesExtra = [],
}: DataTableProps<T>) {
  const [abierta, setAbierta] = useState<string | null>(null);
  const hayAcciones = !!onVer || !!onEditar || accionesExtra.length > 0;
  const totalCols = columnas.length + (renderDetalle ? 1 : 0) + (hayAcciones ? 1 : 0);

  return (
    <div className="overflow-hidden rounded-xl border border-slate-200/80 bg-white shadow-tarjeta dark:border-slate-800 dark:bg-slate-900">
      <div className="overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50/70 dark:border-slate-800 dark:bg-slate-800/40">
              {renderDetalle && <th className="w-8" />}
              {columnas.map((col) => (
                <th
                  key={col.header}
                  className={`whitespace-nowrap px-4 py-2.5 text-etiqueta font-semibold uppercase text-slate-500 dark:text-slate-400 ${
                    col.alinear === "der" ? "text-right" : "text-left"
                  }`}
                >
                  {col.header}
                </th>
              ))}
              {hayAcciones && (
                <th className="whitespace-nowrap px-4 py-2.5 text-right text-etiqueta font-semibold uppercase text-slate-500 dark:text-slate-400">
                  Acciones
                </th>
              )}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
            {cargando && (
              <tr>
                <td colSpan={totalCols} className="px-4 py-10 text-center text-sm text-slate-400 dark:text-slate-500">
                  Cargando...
                </td>
              </tr>
            )}
            {!cargando && (!filas || filas.length === 0) && (
              <tr>
                <td colSpan={totalCols} className="px-4 py-10 text-center text-sm text-slate-400 dark:text-slate-500">
                  {vacioMensaje}
                </td>
              </tr>
            )}
            {filas?.map((row) => {
              const k = keyExtractor(row);
              const expandida = abierta === k;
              return (
                <Fragment key={k}>
                  <tr className="transition-colors hover:bg-slate-50/70 dark:hover:bg-slate-800/60">
                    {renderDetalle && (
                      <td className="pl-3 pr-1">
                        <button
                          type="button"
                          onClick={() => setAbierta(expandida ? null : k)}
                          className="flex h-6 w-6 items-center justify-center rounded text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-700 dark:hover:text-slate-300"
                          aria-label={expandida ? "Colapsar" : "Expandir"}
                          aria-expanded={expandida}
                        >
                          <ChevronRight
                            size={14}
                            className={`transition-transform ${expandida ? "rotate-90" : ""}`}
                            aria-hidden
                          />
                        </button>
                      </td>
                    )}
                    {columnas.map((col) => (
                      <td
                        key={col.header}
                        className={`px-4 py-2.5 text-slate-700 dark:text-slate-300 ${
                          // Los importes y fechas nunca se parten en dos
                          // lineas: una columna numerica que envuelve deja de
                          // ser comparable de un vistazo.
                          col.alinear === "der" ? "tabular whitespace-nowrap text-right" : ""
                        } ${col.className ?? ""}`}
                      >
                        {col.render(row)}
                      </td>
                    ))}
                    {hayAcciones && (
                      <td className="px-3 py-2">
                        <div className="flex items-center justify-end gap-0.5">
                          {accionesExtra
                            .filter((a) => !a.oculta?.(row))
                            .map((a) => (
                              <BotonAccion
                                key={a.clave}
                                label={a.label}
                                icono={a.icono}
                                tono={a.tono ?? "normal"}
                                motivo={a.deshabilitada?.(row) ?? null}
                                onClick={() => a.onClick(row)}
                              />
                            ))}
                          {onVer && (
                            <BotonAccion
                              label="Ver detalle"
                              icono={Eye}
                              onClick={() => onVer(row)}
                            />
                          )}
                          {onEditar && (
                            <BotonAccion
                              label="Editar"
                              icono={Pencil}
                              motivo={edicionBloqueada?.(row) ?? null}
                              onClick={() => onEditar(row)}
                            />
                          )}
                        </div>
                      </td>
                    )}
                  </tr>
                  {renderDetalle && expandida && (
                    <tr className="bg-slate-50/60 dark:bg-slate-800/40">
                      <td colSpan={totalCols} className="px-6 py-4">
                        {renderDetalle(row)}
                      </td>
                    </tr>
                  )}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
