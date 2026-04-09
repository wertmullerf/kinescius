import { prisma } from "../db/prisma";

// Actualiza el tipoCliente según clases disponibles:
//   0 clases  → NO_ABONADO
//   1+ clases → ABONADO
//
// Solo escribe si el tipo realmente cambia.
export async function actualizarTipoCliente(
  usuarioId: number,
  clasesDisponibles: number
): Promise<void> {
  const nuevoTipo = clasesDisponibles > 0 ? "ABONADO" : "NO_ABONADO";

  const usuario = await prisma.usuario.findUnique({
    where:  { id: usuarioId },
    select: { tipoCliente: true },
  });

  if (!usuario) throw new Error(`Usuario ${usuarioId} no encontrado`);
  if (usuario.tipoCliente === nuevoTipo) return;

  await prisma.usuario.update({
    where: { id: usuarioId },
    data:  { tipoCliente: nuevoTipo },
  });
}
