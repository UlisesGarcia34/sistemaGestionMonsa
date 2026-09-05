import logoMonsa from "@/assets/LogoMonsa.png";
import { CampoDoc, DocumentoRenderizable } from "@/lib/documentos";

// Render en pantalla del documento, con el mismo contenido que el PDF (ambos
// consumen la estructura que arma el backend).
//
// ESTILO: reporte empresarial clasico, del tipo que emite JasperReports --
// bandas con borde fino, encabezados de seccion con relleno gris, celdas
// etiqueta/valor en reticula y un pie con folio y numeracion. Sin bandas de
// color, sin esquinas redondeadas, sin sombras: el unico color del documento
// es el del logotipo. Deliberadamente igual al PDF de reporte.pdf.ts.
//
// La clase .hoja-documento es la que index.css usa en @media print para sacar
// el documento del layout de la app y ocupar la hoja completa.

const BORDE = "border-neutral-400";
const COLUMNAS = 3;

// Reparte los campos en filas de 3 columnas y cierra la ultima fila con un
// relleno del ancho sobrante. Es EXACTAMENTE el mismo empaquetado que hace
// reporte.pdf.ts: si aqui se dejara a la reticula de CSS acomodar sola los
// campos anchos, la pantalla y el PDF mostrarian el mismo dato en filas
// distintas, y la reticula quedaria abierta por la derecha.
function agruparEnFilas(campos: CampoDoc[]) {
  const filas: { campos: CampoDoc[]; relleno: number }[] = [];
  let actual: CampoDoc[] = [];
  let usadas = 0;

  const cerrar = () => {
    if (!actual.length) return;
    filas.push({ campos: actual, relleno: COLUMNAS - usadas });
    actual = [];
    usadas = 0;
  };

  for (const campo of campos) {
    const cols = Math.min(campo.ancho ?? 1, COLUMNAS);
    if (usadas + cols > COLUMNAS) cerrar();
    actual.push(campo);
    usadas += cols;
  }
  cerrar();
  return filas;
}

function anchoCelda(cols: number) {
  return { flexBasis: `${(cols / COLUMNAS) * 100}%` };
}

function fechaGeneracion() {
  return new Date().toLocaleString("es-MX", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function DocumentoImprimible({ documento }: { documento: DocumentoRenderizable }) {
  return (
    <article
      className={`hoja-documento mx-auto w-full max-w-3xl border ${BORDE} bg-white font-sans text-neutral-900 print:border-0`}
    >
      {/* Banda de cabecera: logotipo | razon social y titulo | parametros. */}
      <header className={`titulo-doc flex items-stretch border-b ${BORDE}`}>
        <div className={`flex w-40 shrink-0 items-center justify-center border-r ${BORDE} p-2.5`}>
          <img
            src={logoMonsa}
            alt="Monsa Global Cargo"
            className="max-h-14 w-full object-contain"
          />
        </div>

        <div className="flex min-w-0 flex-1 flex-col justify-between px-3 py-2.5">
          <div>
            <p className="text-[11px] font-bold uppercase leading-none tracking-wide">
              Monsa Global Cargo
            </p>
            <p className="mt-1 text-[9px] leading-none text-neutral-500">
              Sistema de gestion operativa
            </p>
          </div>
          <h1 className="mt-2 text-sm font-bold uppercase leading-tight">{documento.titulo}</h1>
        </div>

        <dl className={`w-44 shrink-0 border-l ${BORDE} text-[10px]`}>
          <div className={`border-b ${BORDE} px-2.5 py-1.5`}>
            <dt className="text-[8px] font-bold uppercase tracking-wide text-neutral-500">
              Folio
            </dt>
            <dd className="mt-0.5 break-words font-bold leading-tight">{documento.folio}</dd>
          </div>
          <div className="px-2.5 py-1.5">
            <dt className="text-[8px] font-bold uppercase tracking-wide text-neutral-500">
              Fecha de emision
            </dt>
            <dd className="mt-0.5 font-bold leading-tight">{documento.fechaEmision}</dd>
          </div>
        </dl>
      </header>

      {documento.subtitulo && (
        <p className={`border-b ${BORDE} bg-neutral-50 px-3 py-2 text-[11px] leading-snug`}>
          {documento.subtitulo}
        </p>
      )}

      {documento.secciones.map((seccion) => (
        <section key={seccion.titulo} className="bloque-doc">
          <h2
            className={`border-b ${BORDE} bg-neutral-200 px-3 py-1.5 text-[10px] font-bold uppercase tracking-wide`}
          >
            {seccion.titulo}
          </h2>
          {/* Reticula de 3 columnas con bordes compartidos: cada dato vive en
              su celda, como la banda de detalle de un reporte impreso. */}
          <dl className={`border-b ${BORDE}`}>
            {agruparEnFilas(seccion.campos).map((fila, f) => (
              <div
                key={`${seccion.titulo}-fila-${f}`}
                className={`flex flex-col border-b ${BORDE} last:border-b-0 sm:flex-row`}
              >
                {fila.campos.map((campo, i) => (
                  <div
                    key={`${seccion.titulo}-${campo.label}-${i}`}
                    style={anchoCelda(Math.min(campo.ancho ?? 1, COLUMNAS))}
                    className={`min-w-0 grow border-b ${BORDE} px-2.5 py-1.5 last:border-r-0 sm:border-b-0 sm:border-r`}
                  >
                    <dt className="text-[8px] font-bold uppercase tracking-wide text-neutral-500">
                      {campo.label}
                    </dt>
                    <dd className="mt-0.5 break-words text-[11px] leading-snug">{campo.valor}</dd>
                  </div>
                ))}
                {fila.relleno > 0 && (
                  <div
                    style={anchoCelda(fila.relleno)}
                    className="hidden sm:block"
                    aria-hidden
                  />
                )}
              </div>
            ))}
          </dl>
        </section>
      ))}

      {!!documento.notas?.length && (
        <section className="bloque-doc">
          <h2
            className={`border-b ${BORDE} bg-neutral-200 px-3 py-1.5 text-[10px] font-bold uppercase tracking-wide`}
          >
            Notas
          </h2>
          <ul className={`border-b ${BORDE} px-3 py-2`}>
            {documento.notas.map((nota, i) => (
              <li key={i} className="flex gap-1.5 text-[10px] leading-snug text-neutral-600">
                <span aria-hidden>-</span>
                <span>{nota}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* El pie NO lleva numeracion de pagina: al imprimir desde el navegador
          la pagina la parte Chrome, y no hay forma estandar de leer el numero
          desde el documento (los contadores de @page no estan implementados).
          La numeracion "N de M" si aparece en el PDF, donde si es exacta. */}
      <footer className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 bg-neutral-50 px-3 py-1.5 text-[9px] text-neutral-500">
        <span>Generado por el sistema MGC - {fechaGeneracion()}</span>
        <span className="font-bold">{documento.folio}</span>
      </footer>
    </article>
  );
}
