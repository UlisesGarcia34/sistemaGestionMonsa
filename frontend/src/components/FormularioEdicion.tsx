import { FormEvent, useState } from "react";
import { Button } from "@/components/Button";
import { Field, Select, TextArea, TextInput } from "@/components/Field";
import { Modal } from "@/components/Modal";

export type TipoCampo = "texto" | "numero" | "fecha" | "select" | "textarea" | "checkbox";

export interface CampoFormulario {
  nombre: string;
  label: string;
  tipo?: TipoCampo;
  opciones?: { valor: string; label: string }[];
  requerido?: boolean;
  // Ocupa la fila completa del formulario (rutas, comentarios, direcciones).
  ancho?: boolean;
  hint?: string;
  placeholder?: string;
  paso?: string;
}

export type ValoresFormulario = Record<string, string | boolean>;

interface FormularioEdicionProps {
  titulo: string;
  descripcion?: string;
  campos: CampoFormulario[];
  valores: ValoresFormulario;
  onClose: () => void;
  onGuardar: (payload: Record<string, unknown>) => void;
  guardando?: boolean;
  error?: string | null;
  maxWidth?: string;
  textoGuardar?: string;
}

// Convierte los valores del formulario (todo string, como los devuelve el DOM)
// al payload que espera el backend.
//
// El criterio de "" es el mismo que el de shared/limpiarEntrada.ts en el
// backend: un campo vaciado a proposito viaja como null para BORRAR el dato,
// no como cadena vacia. Numeros y fechas se mandan tipados para que Zod no
// tenga que adivinar.
export function construirPayload(
  campos: CampoFormulario[],
  valores: ValoresFormulario
): Record<string, unknown> {
  const payload: Record<string, unknown> = {};
  for (const campo of campos) {
    const bruto = valores[campo.nombre];

    if (campo.tipo === "checkbox") {
      payload[campo.nombre] = !!bruto;
      continue;
    }

    const texto = typeof bruto === "string" ? bruto.trim() : "";
    if (texto === "") {
      payload[campo.nombre] = null;
      continue;
    }

    if (campo.tipo === "numero") {
      const n = Number(texto);
      payload[campo.nombre] = Number.isFinite(n) ? n : null;
      continue;
    }

    payload[campo.nombre] = texto;
  }
  return payload;
}

// Formulario de edicion compartido por todos los modulos: mismos controles,
// mismo espaciado, mismo manejo de errores del backend. Cada pagina solo
// declara QUE campos son editables; el como se ve y se envia vive aqui.
export function FormularioEdicion({
  titulo,
  descripcion,
  campos,
  valores,
  onClose,
  onGuardar,
  guardando,
  error,
  maxWidth = "max-w-2xl",
  textoGuardar = "Guardar cambios",
}: FormularioEdicionProps) {
  const [estado, setEstado] = useState<ValoresFormulario>(valores);

  const actualizar = (nombre: string, valor: string | boolean) =>
    setEstado((previo) => ({ ...previo, [nombre]: valor }));

  function enviar(e: FormEvent) {
    e.preventDefault();
    onGuardar(construirPayload(campos, estado));
  }

  return (
    <Modal titulo={titulo} descripcion={descripcion} onClose={onClose} maxWidth={maxWidth}>
      <form onSubmit={enviar} className="space-y-4">
        {error && (
          <p className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs leading-relaxed text-rose-700 dark:border-rose-900 dark:bg-rose-900/20 dark:text-rose-300">
            {error}
          </p>
        )}

        <div className="grid grid-cols-1 gap-x-4 gap-y-3 sm:grid-cols-2">
          {campos.map((campo) => {
            const valor = estado[campo.nombre];

            if (campo.tipo === "checkbox") {
              return (
                <label
                  key={campo.nombre}
                  className={`flex items-center gap-2.5 rounded-lg border border-slate-200 px-3 py-2.5 text-sm text-slate-700 dark:border-slate-700 dark:text-slate-200 ${
                    campo.ancho ? "sm:col-span-2" : ""
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={!!valor}
                    onChange={(e) => actualizar(campo.nombre, e.target.checked)}
                    className="h-4 w-4 rounded border-slate-300 text-teal-600 focus:ring-teal-500/30 dark:border-slate-600 dark:bg-slate-800"
                  />
                  {campo.label}
                </label>
              );
            }

            return (
              <Field
                key={campo.nombre}
                label={campo.label}
                hint={campo.hint}
                requerido={campo.requerido}
                className={campo.ancho ? "sm:col-span-2" : ""}
              >
                {campo.tipo === "select" ? (
                  <Select
                    value={String(valor ?? "")}
                    required={campo.requerido}
                    onChange={(e) => actualizar(campo.nombre, e.target.value)}
                  >
                    {!campo.requerido && <option value="">— sin definir —</option>}
                    {campo.opciones?.map((o) => (
                      <option key={o.valor} value={o.valor}>
                        {o.label}
                      </option>
                    ))}
                  </Select>
                ) : campo.tipo === "textarea" ? (
                  <TextArea
                    value={String(valor ?? "")}
                    placeholder={campo.placeholder}
                    onChange={(e) => actualizar(campo.nombre, e.target.value)}
                  />
                ) : (
                  <TextInput
                    type={
                      campo.tipo === "numero" ? "number" : campo.tipo === "fecha" ? "date" : "text"
                    }
                    step={campo.tipo === "numero" ? (campo.paso ?? "any") : undefined}
                    value={String(valor ?? "")}
                    required={campo.requerido}
                    placeholder={campo.placeholder}
                    onChange={(e) => actualizar(campo.nombre, e.target.value)}
                  />
                )}
              </Field>
            );
          })}
        </div>

        <div className="flex justify-end gap-2 border-t border-slate-100 pt-3 dark:border-slate-800">
          <Button type="button" variante="ghost" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" disabled={guardando}>
            {guardando ? "Guardando..." : textoGuardar}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
