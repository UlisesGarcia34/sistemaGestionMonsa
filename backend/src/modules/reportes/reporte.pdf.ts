import fs from "node:fs";
import path from "node:path";
import { PDFDocument, PDFFont, PDFImage, PDFPage, StandardFonts, rgb } from "pdf-lib";
import { DocumentoRenderizable, SeccionDoc } from "./reporte.tipos";

// ---------------------------------------------------------------------------
// Generacion de PDF.
//
// LIBRERIA ELEGIDA: pdf-lib.
//
// Se evaluo contra puppeteer. Puppeteer permitiria reutilizar HTML/CSS, pero
// descarga un Chromium completo (~150-300 MB) y exige un proceso headless vivo
// en el servidor -- desproporcionado para este proyecto, que corre en la
// maquina del equipo con MySQL local y sin Docker (CLAUDE.md seccion 7), y en
// Windows es justo donde ese binario mas problemas de permisos da.
//
// pdf-lib es JS puro, sin binarios ni dependencias nativas, y estos documentos
// son formularios estructurados (bandas con celdas etiqueta/valor), no
// maquetacion libre: no necesitan un motor de CSS.
//
// ESTILO: reporte empresarial clasico, del tipo que emite JasperReports.
// Todo vive dentro de celdas con borde fino, los encabezados de banda van con
// relleno gris, la tipografia es Helvetica en cuerpos chicos y el unico color
// del documento es el del logotipo. Sin bandas de color, sin esquinas
// redondeadas, sin sombras: un documento que se ve impreso, no una pantalla.
// ---------------------------------------------------------------------------

// Escala de grises del reporte. El unico color lo pone el logotipo.
const TINTA = rgb(0.1, 0.1, 0.1);
const ETIQUETA = rgb(0.32, 0.32, 0.32);
const BORDE = rgb(0.35, 0.35, 0.35);
const BORDE_FINO = rgb(0.55, 0.55, 0.55);
const RELLENO_BANDA = rgb(0.867, 0.867, 0.867);
const RELLENO_SUAVE = rgb(0.957, 0.957, 0.957);
const BLANCO = rgb(1, 1, 1);

const ANCHO = 595.28; // A4 vertical
const ALTO = 841.89;
const MARGEN = 36;
const ANCHO_UTIL = ANCHO - MARGEN * 2;

const COLUMNAS = 3;
const ANCHO_COL = ANCHO_UTIL / COLUMNAS;

const ALTO_CABECERA = 62;
const ALTO_PIE = 26;
const CELDA_LOGO = 138;
const CELDA_META = 122;

const GROSOR = 0.7;
const PAD = 4;

// El logo se lee del disco una sola vez por proceso: el archivo no cambia en
// caliente y releerlo en cada PDF seria E/S pura por documento.
//
// La ruta se resuelve desde __dirname y no desde process.cwd() para que
// funcione igual con tsx (src/modules/reportes) y con el build (dist/modules/
// reportes): ambos estan a tres niveles de la raiz del backend.
const RUTA_LOGO = path.resolve(__dirname, "../../../assets/logoMonsa.png");

let logoCache: Buffer | null | undefined;

function leerLogo(): Buffer | null {
  if (logoCache !== undefined) return logoCache;
  try {
    logoCache = fs.readFileSync(RUTA_LOGO);
  } catch {
    // Un documento sin logotipo sigue siendo valido y util: se avisa una vez
    // y se sigue. Nunca se cae la generacion del PDF por un archivo de imagen.
    console.warn(
      `[reportes] No se encontro el logotipo en ${RUTA_LOGO}. Los PDF se generan sin el.`
    );
    logoCache = null;
  }
  return logoCache;
}

// Las fuentes estandar de PDF codifican en WinAnsi: cualquier caracter fuera de
// Latin-1 (flechas, guiones largos, el separador "·") revienta drawText. Se
// normalizan a equivalentes ASCII en vez de embeber una fuente Unicode
// completa, que multiplicaria el peso del PDF por un par de simbolos.
function aWinAnsi(valor: string): string {
  return valor
    .replace(/[→⟶]/g, "->")
    .replace(/[←]/g, "<-")
    .replace(/[–—―]/g, "-")
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/[•·]/g, "-")
    .replace(/…/g, "...")
    .replace(/ /g, " ")
    // eslint-disable-next-line no-control-regex
    .replace(/[^\x00-\xFF]/g, "");
}

function partirEnLineas(texto: string, font: PDFFont, tam: number, ancho: number): string[] {
  const palabras = aWinAnsi(texto).split(/\s+/).filter(Boolean);
  if (!palabras.length) return [""];
  const lineas: string[] = [];
  let actual = "";
  for (const palabra of palabras) {
    const tentativa = actual ? `${actual} ${palabra}` : palabra;
    if (font.widthOfTextAtSize(tentativa, tam) <= ancho) {
      actual = tentativa;
      continue;
    }
    if (actual) lineas.push(actual);
    // Palabra sola mas ancha que la celda (folios largos, numeros de MBL):
    // se corta por caracteres para que no se salga del borde.
    if (font.widthOfTextAtSize(palabra, tam) > ancho) {
      let trozo = "";
      for (const ch of palabra) {
        if (font.widthOfTextAtSize(trozo + ch, tam) > ancho) {
          lineas.push(trozo);
          trozo = ch;
        } else {
          trozo += ch;
        }
      }
      actual = trozo;
    } else {
      actual = palabra;
    }
  }
  if (actual) lineas.push(actual);
  return lineas;
}

interface Fuentes {
  regular: PDFFont;
  bold: PDFFont;
}

function marco(page: PDFPage, x: number, y: number, w: number, h: number, relleno?: ReturnType<typeof rgb>) {
  page.drawRectangle({
    x,
    y,
    width: w,
    height: h,
    color: relleno ?? BLANCO,
    borderColor: BORDE,
    borderWidth: GROSOR,
  });
}

// Cursor de escritura sobre el documento. Cada pagina nueva repite la banda de
// cabecera con el logotipo, como hace un reporte de Jasper: quien recibe la
// hoja 2 impresa suelta sigue sabiendo de que documento es.
class Lienzo {
  private pagina: PDFPage;
  y: number;

  constructor(
    private doc: PDFDocument,
    private fuentes: Fuentes,
    private documento: DocumentoRenderizable,
    private logo: PDFImage | null
  ) {
    this.pagina = this.abrirPagina();
    this.y = ALTO - MARGEN - ALTO_CABECERA - 10;
  }

  get actual() {
    return this.pagina;
  }

  private abrirPagina(): PDFPage {
    const page = this.doc.addPage([ANCHO, ALTO]);
    this.dibujarCabecera(page);
    return page;
  }

  // Banda de cabecera: tres celdas contiguas -- logotipo, titulo y tabla de
  // parametros del reporte (folio / fecha). Es la estructura tipica de la
  // "page header band" de un reporte empresarial.
  private dibujarCabecera(page: PDFPage) {
    const { regular, bold } = this.fuentes;
    const yBanda = ALTO - MARGEN - ALTO_CABECERA;

    marco(page, MARGEN, yBanda, ANCHO_UTIL, ALTO_CABECERA);

    // --- Celda 1: logotipo, escalado para caber con margen interior.
    const xTitulo = MARGEN + CELDA_LOGO;
    page.drawLine({
      start: { x: xTitulo, y: yBanda },
      end: { x: xTitulo, y: yBanda + ALTO_CABECERA },
      thickness: GROSOR,
      color: BORDE,
    });

    if (this.logo) {
      const maxAncho = CELDA_LOGO - 16;
      const maxAlto = ALTO_CABECERA - 14;
      const escala = Math.min(maxAncho / this.logo.width, maxAlto / this.logo.height);
      const w = this.logo.width * escala;
      const h = this.logo.height * escala;
      page.drawImage(this.logo, {
        x: MARGEN + (CELDA_LOGO - w) / 2,
        y: yBanda + (ALTO_CABECERA - h) / 2,
        width: w,
        height: h,
      });
    } else {
      page.drawText("MGC", {
        x: MARGEN + 12,
        y: yBanda + ALTO_CABECERA / 2 - 4,
        size: 16,
        font: bold,
        color: TINTA,
      });
    }

    // --- Celda 3: tabla de parametros (folio y fecha), a la derecha.
    const xMeta = ANCHO - MARGEN - CELDA_META;
    page.drawLine({
      start: { x: xMeta, y: yBanda },
      end: { x: xMeta, y: yBanda + ALTO_CABECERA },
      thickness: GROSOR,
      color: BORDE,
    });

    const filas: [string, string][] = [
      ["FOLIO", this.documento.folio],
      ["FECHA DE EMISION", this.documento.fechaEmision],
    ];
    const altoFilaMeta = ALTO_CABECERA / filas.length;
    filas.forEach(([etiqueta, valor], i) => {
      const yFila = yBanda + ALTO_CABECERA - (i + 1) * altoFilaMeta;
      if (i > 0) {
        page.drawLine({
          start: { x: xMeta, y: yFila + altoFilaMeta },
          end: { x: ANCHO - MARGEN, y: yFila + altoFilaMeta },
          thickness: GROSOR,
          color: BORDE_FINO,
        });
      }
      page.drawText(aWinAnsi(etiqueta), {
        x: xMeta + 6,
        y: yFila + altoFilaMeta - 11,
        size: 5.5,
        font: bold,
        color: ETIQUETA,
      });
      const lineas = partirEnLineas(valor, bold, 8, CELDA_META - 12).slice(0, 2);
      lineas.forEach((linea, j) => {
        page.drawText(linea, {
          x: xMeta + 6,
          y: yFila + altoFilaMeta - 21 - j * 9,
          size: 8,
          font: bold,
          color: TINTA,
        });
      });
    });

    // --- Celda 2: razon social y titulo del reporte.
    const anchoTitulo = xMeta - xTitulo;
    page.drawText("MONSA GLOBAL CARGO", {
      x: xTitulo + 10,
      y: yBanda + ALTO_CABECERA - 16,
      size: 8,
      font: bold,
      color: TINTA,
    });
    page.drawText("Sistema de gestion operativa", {
      x: xTitulo + 10,
      y: yBanda + ALTO_CABECERA - 26,
      size: 6.5,
      font: regular,
      color: ETIQUETA,
    });

    const titulo = aWinAnsi(this.documento.titulo.toUpperCase());
    const lineasTitulo = partirEnLineas(titulo, bold, 11.5, anchoTitulo - 20).slice(0, 2);
    lineasTitulo.forEach((linea, i) => {
      page.drawText(linea, {
        x: xTitulo + 10,
        y: yBanda + 14 - i * 12 + (lineasTitulo.length === 1 ? 0 : 6),
        size: 11.5,
        font: bold,
        color: TINTA,
      });
    });
  }

  asegurarEspacio(alto: number) {
    if (this.y - alto >= MARGEN + ALTO_PIE + 8) return;
    this.pagina = this.abrirPagina();
    this.y = ALTO - MARGEN - ALTO_CABECERA - 10;
  }
}

// Banda de subtitulo: una franja gris con el contexto del documento
// (cliente y ruta), justo debajo de la cabecera.
function subtitulo(lienzo: Lienzo, fuentes: Fuentes, texto: string) {
  const lineas = partirEnLineas(texto, fuentes.regular, 8.5, ANCHO_UTIL - 12);
  const alto = 6 + lineas.length * 11;
  lienzo.asegurarEspacio(alto + 6);
  marco(lienzo.actual, MARGEN, lienzo.y - alto, ANCHO_UTIL, alto, RELLENO_SUAVE);
  lineas.forEach((linea, i) => {
    lienzo.actual.drawText(linea, {
      x: MARGEN + 6,
      y: lienzo.y - 12 - i * 11,
      size: 8.5,
      font: fuentes.regular,
      color: TINTA,
    });
  });
  lienzo.y -= alto + 8;
}

// Cada seccion es una banda: titulo con relleno gris + celdas de detalle con
// borde completo, repartidas en una reticula de 3 columnas.
function dibujarSeccion(lienzo: Lienzo, fuentes: Fuentes, seccion: SeccionDoc) {
  lienzo.asegurarEspacio(58);

  const ALTO_TITULO = 15;
  marco(lienzo.actual, MARGEN, lienzo.y - ALTO_TITULO, ANCHO_UTIL, ALTO_TITULO, RELLENO_BANDA);
  lienzo.actual.drawText(aWinAnsi(seccion.titulo.toUpperCase()), {
    x: MARGEN + 6,
    y: lienzo.y - 10.5,
    size: 7.5,
    font: fuentes.bold,
    color: TINTA,
  });
  lienzo.y -= ALTO_TITULO;

  // Los campos se agrupan en filas de 3 columnas respetando el ancho que cada
  // uno declara; toda la fila comparte el alto del campo mas alto para que la
  // reticula no quede escalonada.
  type Preparado = { x: number; ancho: number; cols: number; label: string; lineas: string[] };
  let fila: Preparado[] = [];
  let columna = 0;

  const cerrarFila = () => {
    if (!fila.length) return;
    const maxLineas = Math.max(...fila.map((c) => c.lineas.length));
    const altoFila = PAD + 8 + maxLineas * 10 + PAD;
    lienzo.asegurarEspacio(altoFila);
    const yTope = lienzo.y;

    // Si la fila no llena las 3 columnas se dibuja una celda vacia con el resto
    // del ancho: sin ella la reticula quedaria abierta por la derecha y la
    // banda dejaria de leerse como una tabla.
    const usadas = fila.reduce((acc, c) => acc + c.cols, 0);
    if (usadas < COLUMNAS) {
      const x = MARGEN + usadas * ANCHO_COL;
      marco(lienzo.actual, x, yTope - altoFila, ANCHO_COL * (COLUMNAS - usadas), altoFila);
    }

    for (const celda of fila) {
      marco(lienzo.actual, celda.x, yTope - altoFila, celda.ancho, altoFila);
      lienzo.actual.drawText(aWinAnsi(celda.label.toUpperCase()), {
        x: celda.x + 5,
        y: yTope - PAD - 6,
        size: 5.5,
        font: fuentes.bold,
        color: ETIQUETA,
      });
      celda.lineas.forEach((linea, i) => {
        lienzo.actual.drawText(linea, {
          x: celda.x + 5,
          y: yTope - PAD - 8 - 8 - i * 10,
          size: 8.5,
          font: fuentes.regular,
          color: TINTA,
        });
      });
    }

    lienzo.y = yTope - altoFila;
    fila = [];
    columna = 0;
  };

  for (const c of seccion.campos) {
    const cols = Math.min(c.ancho ?? 1, COLUMNAS);
    if (columna + cols > COLUMNAS) cerrarFila();
    const x = MARGEN + columna * ANCHO_COL;
    const ancho = ANCHO_COL * cols;
    fila.push({
      x,
      ancho,
      cols,
      label: c.label,
      lineas: partirEnLineas(c.valor, fuentes.regular, 8.5, ancho - 10),
    });
    columna += cols;
  }
  cerrarFila();

  lienzo.y -= 8;
}

function notas(lienzo: Lienzo, fuentes: Fuentes, textos: string[]) {
  if (!textos.length) return;

  const ALTO_TITULO = 15;
  lienzo.asegurarEspacio(ALTO_TITULO + 24);
  marco(lienzo.actual, MARGEN, lienzo.y - ALTO_TITULO, ANCHO_UTIL, ALTO_TITULO, RELLENO_BANDA);
  lienzo.actual.drawText("NOTAS", {
    x: MARGEN + 6,
    y: lienzo.y - 10.5,
    size: 7.5,
    font: fuentes.bold,
    color: TINTA,
  });
  lienzo.y -= ALTO_TITULO;

  const lineas = textos.flatMap((t) =>
    partirEnLineas(`- ${t}`, fuentes.regular, 7.5, ANCHO_UTIL - 14)
  );
  const alto = PAD + lineas.length * 9.5 + PAD;
  lienzo.asegurarEspacio(alto);
  const yTope = lienzo.y;
  marco(lienzo.actual, MARGEN, yTope - alto, ANCHO_UTIL, alto);
  lineas.forEach((linea, i) => {
    lienzo.actual.drawText(linea, {
      x: MARGEN + 6,
      y: yTope - PAD - 7 - i * 9.5,
      size: 7.5,
      font: fuentes.regular,
      color: ETIQUETA,
    });
  });
  lienzo.y = yTope - alto - 8;
}

// Banda de pie repetida en todas las paginas, con la numeracion "N de M" que
// solo se puede escribir cuando ya se sabe cuantas paginas hay.
function pieDePagina(doc: PDFDocument, fuentes: Fuentes, documento: DocumentoRenderizable) {
  const paginas = doc.getPages();
  const generado = new Date().toLocaleString("es-MX", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

  paginas.forEach((page, i) => {
    marco(page, MARGEN, MARGEN, ANCHO_UTIL, ALTO_PIE, RELLENO_SUAVE);

    page.drawText(aWinAnsi(`Generado por el sistema MGC - ${generado}`), {
      x: MARGEN + 6,
      y: MARGEN + 10,
      size: 6.5,
      font: fuentes.regular,
      color: ETIQUETA,
    });

    const centro = aWinAnsi(documento.folio);
    page.drawText(centro, {
      x: MARGEN + (ANCHO_UTIL - fuentes.bold.widthOfTextAtSize(centro, 6.5)) / 2,
      y: MARGEN + 10,
      size: 6.5,
      font: fuentes.bold,
      color: ETIQUETA,
    });

    const num = aWinAnsi(`Pagina ${i + 1} de ${paginas.length}`);
    page.drawText(num, {
      x: ANCHO - MARGEN - 6 - fuentes.regular.widthOfTextAtSize(num, 6.5),
      y: MARGEN + 10,
      size: 6.5,
      font: fuentes.regular,
      color: ETIQUETA,
    });
  });
}

export async function renderizarPdf(documento: DocumentoRenderizable): Promise<Buffer> {
  const doc = await PDFDocument.create();
  doc.setTitle(`${documento.titulo} ${documento.folio}`);
  doc.setProducer("Sistema de gestion MGC");
  doc.setCreator("Monsa Global Cargo");

  const fuentes: Fuentes = {
    regular: await doc.embedFont(StandardFonts.Helvetica),
    bold: await doc.embedFont(StandardFonts.HelveticaBold),
  };

  const bytesLogo = leerLogo();
  const logo = bytesLogo ? await doc.embedPng(bytesLogo) : null;

  const lienzo = new Lienzo(doc, fuentes, documento, logo);
  if (documento.subtitulo) subtitulo(lienzo, fuentes, documento.subtitulo);
  for (const seccion of documento.secciones) {
    dibujarSeccion(lienzo, fuentes, seccion);
  }
  notas(lienzo, fuentes, documento.notas ?? []);
  pieDePagina(doc, fuentes, documento);

  return Buffer.from(await doc.save());
}
