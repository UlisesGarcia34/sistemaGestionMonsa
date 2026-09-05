import { useEffect, useRef, useState } from "react";
import { api } from "@/lib/api";

// Buscador con autocompletado sobre un catalogo grande del SAT (ClaveProdServ
// ~52,500 filas, ClaveUnidad ~2,400) importado por
// backend/prisma/importarCatalogosSat.ts. No existe un <select> viable para
// ese volumen: se busca por texto contra GET /api/catalogos-sat/:endpoint?q=.
//
// Guarda solo la clave (`valor`); el texto visible ("clave — descripcion") es
// estado local que se resetea si el valor cambia desde afuera.
interface Resultado {
  clave: string;
  [key: string]: unknown;
}

interface Props {
  endpoint: "clave-prod-serv" | "clave-unidad";
  valor: string;
  etiquetaCampo: (r: Resultado) => string;
  onSeleccionar: (clave: string, etiqueta: string) => void;
  placeholder?: string;
}

export function ComboboxCatalogoSat({
  endpoint,
  valor,
  etiquetaCampo,
  onSeleccionar,
  placeholder,
}: Props) {
  const [texto, setTexto] = useState(valor);
  const [resultados, setResultados] = useState<Resultado[]>([]);
  const [abierto, setAbierto] = useState(false);
  const contenedorRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();

  // Si el valor cambia desde afuera (ej. se carga otra factura), refleja el
  // codigo crudo -- no se conoce su descripcion sin buscarla.
  useEffect(() => {
    setTexto(valor);
  }, [valor]);

  useEffect(() => {
    function alHacerClicFuera(e: MouseEvent) {
      if (contenedorRef.current && !contenedorRef.current.contains(e.target as Node)) {
        setAbierto(false);
      }
    }
    document.addEventListener("mousedown", alHacerClicFuera);
    return () => document.removeEventListener("mousedown", alHacerClicFuera);
  }, []);

  function buscar(q: string) {
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      const { data } = await api.get<Resultado[]>(`/catalogos-sat/${endpoint}`, {
        params: { q },
      });
      setResultados(data);
    }, 250);
  }

  return (
    <div ref={contenedorRef} className="relative">
      <input
        type="text"
        value={texto}
        placeholder={placeholder}
        onChange={(e) => {
          setTexto(e.target.value);
          setAbierto(true);
          buscar(e.target.value);
        }}
        onFocus={() => {
          setAbierto(true);
          buscar(texto);
        }}
        className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-[inset_0_1px_2px_rgba(11,61,92,0.04)] transition-colors placeholder:text-slate-400 focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-500/20 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:placeholder:text-slate-500"
      />
      {abierto && resultados.length > 0 && (
        <ul className="absolute z-20 mt-1 max-h-56 w-full min-w-[20rem] overflow-y-auto rounded-lg border border-slate-200 bg-white py-1 shadow-tarjeta dark:border-slate-700 dark:bg-slate-900">
          {resultados.map((r) => (
            <li key={r.clave}>
              <button
                type="button"
                onClick={() => {
                  const etiqueta = `${r.clave} — ${etiquetaCampo(r)}`;
                  setTexto(etiqueta);
                  setAbierto(false);
                  onSeleccionar(r.clave, etiqueta);
                }}
                className="block w-full truncate px-3 py-1.5 text-left text-xs text-slate-700 hover:bg-teal-50 hover:text-teal-700 dark:text-slate-300 dark:hover:bg-teal-900/40 dark:hover:text-teal-300"
                title={`${r.clave} — ${etiquetaCampo(r)}`}
              >
                <span className="font-medium">{r.clave}</span> — {etiquetaCampo(r)}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
