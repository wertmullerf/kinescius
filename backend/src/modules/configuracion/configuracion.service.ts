import { prisma } from "../../db/prisma";

const DEFAULT_CONFIG: Record<string, string> = {
  minutosClase: "60",
  precioClase:  "2000",
};

export const configuracionService = {

  async obtenerTodas() {
    const rows = await prisma.configuracion.findMany();
    // Merge defaults so clients always get all keys
    const result: Record<string, string> = { ...DEFAULT_CONFIG };
    for (const row of rows) {
      result[row.clave] = row.valor;
    }
    return result;
  },

  async obtener(clave: string): Promise<string> {
    const row = await prisma.configuracion.findUnique({ where: { clave } });
    return row?.valor ?? DEFAULT_CONFIG[clave] ?? "";
  },

  async actualizar(clave: string, valor: string) {
    const claveValida = clave in DEFAULT_CONFIG;
    if (!claveValida) throw new Error(`Clave de configuración no válida: ${clave}`);

    return prisma.configuracion.upsert({
      where:  { clave },
      update: { valor },
      create: { clave, valor },
    });
  },

  async actualizarVarias(cambios: Record<string, string>) {
    const claves = Object.keys(cambios);
    for (const clave of claves) {
      if (!(clave in DEFAULT_CONFIG)) throw new Error(`Clave de configuración no válida: ${clave}`);
    }

    await Promise.all(
      claves.map(clave =>
        prisma.configuracion.upsert({
          where:  { clave },
          update: { valor: cambios[clave] },
          create: { clave, valor: cambios[clave] },
        })
      )
    );

    return this.obtenerTodas();
  },
};
