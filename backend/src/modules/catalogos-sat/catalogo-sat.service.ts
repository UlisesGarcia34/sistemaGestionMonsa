import { prisma } from "@/config/prisma";

// Modulo de solo lectura sobre los catalogos oficiales del SAT (CFDI 4.0),
// importados por prisma/importarCatalogosSat.ts (ver CLAUDE.md seccion 5.5).
// Los catalogos grandes (ClaveProdServ, ClaveUnidad) se buscan con LIKE y un
// limite; los pequenos se listan completos.

const LIMITE_BUSQUEDA = 20;

export async function buscarClaveProdServ(q?: string) {
  const termino = q?.trim();
  if (!termino) {
    return prisma.satClaveProdServ.findMany({ take: LIMITE_BUSQUEDA, orderBy: { clave: "asc" } });
  }
  return prisma.satClaveProdServ.findMany({
    where: {
      OR: [
        { clave: { startsWith: termino } },
        { descripcion: { contains: termino } },
        { palabrasSimilares: { contains: termino } },
      ],
    },
    take: LIMITE_BUSQUEDA,
    orderBy: { clave: "asc" },
  });
}

export async function buscarClaveUnidad(q?: string) {
  const termino = q?.trim();
  if (!termino) {
    return prisma.satClaveUnidad.findMany({ take: LIMITE_BUSQUEDA, orderBy: { clave: "asc" } });
  }
  return prisma.satClaveUnidad.findMany({
    where: {
      OR: [{ clave: { startsWith: termino } }, { nombre: { contains: termino } }],
    },
    take: LIMITE_BUSQUEDA,
    orderBy: { clave: "asc" },
  });
}

export async function listarRegimenFiscal() {
  return prisma.satRegimenFiscal.findMany({ orderBy: { clave: "asc" } });
}

export async function listarUsoCfdi() {
  return prisma.satUsoCfdi.findMany({ orderBy: { clave: "asc" } });
}

export async function listarFormaPago() {
  return prisma.satFormaPago.findMany({ orderBy: { clave: "asc" } });
}

export async function listarMoneda() {
  return prisma.satMoneda.findMany({ orderBy: { clave: "asc" } });
}

export async function listarObjetoImp() {
  return prisma.satObjetoImp.findMany({ orderBy: { clave: "asc" } });
}

export async function listarMotivoCancelacion() {
  return prisma.satMotivoCancelacion.findMany({ orderBy: { clave: "asc" } });
}
