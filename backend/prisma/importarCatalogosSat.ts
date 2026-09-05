// Importa los catalogos oficiales del SAT (CFDI 4.0) a las tablas Sat*.
//
// NO forma parte de `npm run seed`: son ~55,000 filas de datos de referencia
// que no cambian en el dia a dia de desarrollo, y descargarlas en cada
// resembrado seria lento y dependeria de internet en un flujo que hoy es
// 100% local (CLAUDE.md seccion 7). Se corre una sola vez (o cuando se quiera
// refrescar el catalogo) con:
//
//   npm run seed:sat
//
// FUENTE: mirror comunitario que sincroniza en tiempo real desde el SAT
// (github.com/bambucode/catalogos_JSON_CFDI, rama cfdi-4.0). Es el mismo tipo
// de fuente que usan librerias PHP/Python conocidas del ecosistema CFDI
// mexicano (phpcfdi/resources-sat-catalogs sigue el mismo enfoque). Requiere
// internet; se puede re-correr para refrescar (borra e inserta de nuevo cada
// tabla, no acumula duplicados).
//
// c_MotivoCancelacion NO esta publicado en ese mirror: son 4 claves fijas del
// manual de cancelacion de CFDI del SAT, sin cambios desde 2018, se siembran
// a mano abajo (SIEMBRA_MOTIVO_CANCELACION).
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const RAMA = "https://raw.githubusercontent.com/bambucode/catalogos_JSON_CFDI/cfdi-4.0";

async function descargarJson<T>(archivo: string): Promise<T> {
  const respuesta = await fetch(`${RAMA}/${archivo}.json`);
  if (!respuesta.ok) {
    throw new Error(`No se pudo descargar ${archivo}.json: HTTP ${respuesta.status}`);
  }
  return (await respuesta.json()) as T;
}

// Inserta en lotes: MySQL tiene un limite practico de parametros por query y
// 52,000 filas de un solo createMany se sienten mejor partidas.
async function insertarPorLotes<T>(
  nombre: string,
  filas: T[],
  insertar: (lote: T[]) => Promise<unknown>,
  tamanoLote = 2000
) {
  for (let i = 0; i < filas.length; i += tamanoLote) {
    await insertar(filas.slice(i, i + tamanoLote));
  }
  console.log(`  ${nombre}: ${filas.length} filas`);
}

const SIEMBRA_MOTIVO_CANCELACION = [
  {
    clave: "01",
    descripcion: "Comprobante emitido con errores con relacion",
    requiereFolioSustitucion: true,
  },
  {
    clave: "02",
    descripcion: "Comprobante emitido con errores sin relacion",
    requiereFolioSustitucion: false,
  },
  {
    clave: "03",
    descripcion: "No se llevo a cabo la operacion",
    requiereFolioSustitucion: false,
  },
  {
    clave: "04",
    descripcion: "Operacion nominativa relacionada en una factura global",
    requiereFolioSustitucion: false,
  },
];

async function main() {
  console.log("Descargando e importando catalogos SAT (CFDI 4.0)...");

  interface FilaProdServ {
    id: string;
    descripcion: string;
    palabrasSimilares?: string;
  }
  const claveProdServ = await descargarJson<FilaProdServ[]>("c_ClaveProdServ");
  await prisma.satClaveProdServ.deleteMany();
  await insertarPorLotes("SatClaveProdServ", claveProdServ, (lote) =>
    prisma.satClaveProdServ.createMany({
      data: lote.map((f) => ({
        clave: f.id,
        descripcion: f.descripcion,
        palabrasSimilares: f.palabrasSimilares || null,
      })),
      skipDuplicates: true,
    })
  );

  interface FilaUnidad {
    id: string;
    nombre: string;
    simbolo?: string;
  }
  const claveUnidad = await descargarJson<FilaUnidad[]>("c_ClaveUnidad");
  await prisma.satClaveUnidad.deleteMany();
  await insertarPorLotes("SatClaveUnidad", claveUnidad, (lote) =>
    prisma.satClaveUnidad.createMany({
      data: lote.map((f) => ({ clave: f.id, nombre: f.nombre, simbolo: f.simbolo || null })),
      skipDuplicates: true,
    })
  );

  interface FilaFisicaMoral {
    id: string;
    descripcion: string;
    fisica?: string;
    moral?: string;
    aplicaParaTipoPersonaFisica?: string;
    aplicaParaTipoPersonaMoral?: string;
  }
  const esSi = (v?: string) => v?.trim().toLowerCase() === "sí" || v?.trim().toLowerCase() === "si";

  const regimenFiscal = await descargarJson<FilaFisicaMoral[]>("c_RegimenFiscal");
  await prisma.satRegimenFiscal.deleteMany();
  await prisma.satRegimenFiscal.createMany({
    data: regimenFiscal.map((f) => ({
      clave: f.id,
      descripcion: f.descripcion,
      aplicaFisica: esSi(f.fisica),
      aplicaMoral: esSi(f.moral),
    })),
    skipDuplicates: true,
  });
  console.log(`  SatRegimenFiscal: ${regimenFiscal.length} filas`);

  const usoCfdi = await descargarJson<FilaFisicaMoral[]>("c_UsoCFDI");
  await prisma.satUsoCfdi.deleteMany();
  await prisma.satUsoCfdi.createMany({
    data: usoCfdi.map((f) => ({
      clave: f.id,
      descripcion: f.descripcion,
      aplicaFisica: esSi(f.aplicaParaTipoPersonaFisica),
      aplicaMoral: esSi(f.aplicaParaTipoPersonaMoral),
    })),
    skipDuplicates: true,
  });
  console.log(`  SatUsoCfdi: ${usoCfdi.length} filas`);

  interface FilaSimple {
    id: string;
    descripcion: string;
    decimales?: string;
  }
  const formaPago = await descargarJson<FilaSimple[]>("c_FormaPago");
  await prisma.satFormaPago.deleteMany();
  await prisma.satFormaPago.createMany({
    data: formaPago.map((f) => ({ clave: f.id, descripcion: f.descripcion })),
    skipDuplicates: true,
  });
  console.log(`  SatFormaPago: ${formaPago.length} filas`);

  const moneda = await descargarJson<FilaSimple[]>("c_Moneda");
  await prisma.satMoneda.deleteMany();
  await prisma.satMoneda.createMany({
    data: moneda.map((f) => ({
      clave: f.id,
      descripcion: f.descripcion,
      decimales: Number(f.decimales ?? 2),
    })),
    skipDuplicates: true,
  });
  console.log(`  SatMoneda: ${moneda.length} filas`);

  const objetoImp = await descargarJson<FilaSimple[]>("c_ObjetoImp");
  await prisma.satObjetoImp.deleteMany();
  await prisma.satObjetoImp.createMany({
    data: objetoImp.map((f) => ({ clave: f.id, descripcion: f.descripcion })),
    skipDuplicates: true,
  });
  console.log(`  SatObjetoImp: ${objetoImp.length} filas`);

  await prisma.satMotivoCancelacion.deleteMany();
  await prisma.satMotivoCancelacion.createMany({
    data: SIEMBRA_MOTIVO_CANCELACION,
    skipDuplicates: true,
  });
  console.log(`  SatMotivoCancelacion: ${SIEMBRA_MOTIVO_CANCELACION.length} filas (siembra manual)`);

  console.log("Catalogos SAT importados.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
