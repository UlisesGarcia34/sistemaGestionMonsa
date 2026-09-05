import { Prisma } from '@prisma/client';
import { prisma } from '@/config/prisma';
import { ReglaDeNegocioError } from './middleware/errorHandler';

export async function transaccion<T>(trabajo: (tx: Prisma.TransactionClient) => Promise<T>): Promise<T> {
  for (let intento = 0; intento < 5; intento++) {
    try {
      return await prisma.$transaction(trabajo, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, maxWait: 10000, timeout: 15000 });
    } catch (e) {
      if (!(e instanceof Prisma.PrismaClientKnownRequestError) || !['P2034', 'P2002'].includes(e.code)) throw e;
      if (intento === 4) throw new ReglaDeNegocioError('Conflicto al guardar. Actualiza el registro e intenta nuevamente.');
    }
  }
  throw new Error('Transaccion sin resultado');
}
