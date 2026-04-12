import { prisma } from "../../db/prisma";
import { subirImagenCloudinary } from "../../utils/cloudinary";

interface ProfesorInput {
  nombre: string;
  apellido: string;
  dni: string;
}

export const profesorService = {
  async listar() {
    return prisma.profesor.findMany({
      orderBy: [{ apellido: "asc" }, { nombre: "asc" }],
    });
  },

  async obtener(id: number) {
    const profesor = await prisma.profesor.findUnique({ where: { id } });
    if (!profesor) throw new Error("Profesor no encontrado");
    return profesor;
  },

  async crear(data: ProfesorInput) {
    const dniExiste = await prisma.profesor.findUnique({ where: { dni: data.dni } });
    if (dniExiste) throw new Error("Ya existe un profesor con ese DNI");

    const nombreExiste = await prisma.profesor.findFirst({
      where: { nombre: data.nombre, apellido: data.apellido },
    });
    if (nombreExiste) throw new Error("Ya existe un profesor con ese nombre y apellido");

    return prisma.profesor.create({ data });
  },

  async editar(id: number, data: Partial<ProfesorInput>) {
    await this.obtener(id); // lanza si no existe

    if (data.dni !== undefined) {
      const dniExiste = await prisma.profesor.findFirst({
        where: { dni: data.dni, NOT: { id } },
      });
      if (dniExiste) throw new Error("Ya existe un profesor con ese DNI");
    }

    if (data.nombre !== undefined || data.apellido !== undefined) {
      // Necesitamos el registro actual para completar el nombre+apellido al chequear
      const actual = await prisma.profesor.findUnique({ where: { id } });
      const nombre   = data.nombre   ?? actual!.nombre;
      const apellido = data.apellido ?? actual!.apellido;
      const nombreExiste = await prisma.profesor.findFirst({
        where: { nombre, apellido, NOT: { id } },
      });
      if (nombreExiste) throw new Error("Ya existe un profesor con ese nombre y apellido");
    }

    return prisma.profesor.update({ where: { id }, data });
  },

  async subirImagen(id: number, buffer: Buffer) {
    await this.obtener(id); // lanza si no existe
    const url = await subirImagenCloudinary(buffer, `profesor_${id}`);
    return prisma.profesor.update({
      where: { id },
      data:  { imagenUrl: url },
    });
  },

  async eliminar(id: number) {
    await this.obtener(id);

    const tieneRecurrentes = await prisma.claseRecurrente.count({ where: { profesorId: id } });
    if (tieneRecurrentes > 0) {
      throw new Error(
        `No se puede eliminar el profesor porque tiene ${tieneRecurrentes} clase(s) recurrente(s) asignada(s)`
      );
    }

    const tieneInstancias = await prisma.claseInstancia.count({ where: { profesorId: id } });
    if (tieneInstancias > 0) {
      throw new Error(
        `No se puede eliminar el profesor porque tiene ${tieneInstancias} instancia(s) de clase asignada(s)`
      );
    }

    return prisma.profesor.delete({ where: { id } });
  },
};
