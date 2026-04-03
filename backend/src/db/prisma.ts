import { PrismaClient } from "@prisma/client";

// Singleton: una única instancia de Prisma para toda la app.
// En desarrollo, nodemon reinicia el proceso frecuentemente,
// por eso guardamos la instancia en `globalThis` para no abrir
// miles de conexiones durante el hot-reload.
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: ["error", "warn"],
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
