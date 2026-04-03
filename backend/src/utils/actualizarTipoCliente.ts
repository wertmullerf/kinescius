import { prisma } from "../db/prisma";

// Actualiza el tipoCliente de un usuario según su saldo de clases disponibles.
// Reglas:
//   0 clases        → NO_ABONADO
//   1 o 2 clases    → sin cambio (mantiene el estado actual)
//   3 o más clases  → ABONADO
//
// Solo ejecuta el UPDATE si el tipo realmente cambia, para evitar escrituras innecesarias.
// Se llama desde los módulos de pagos/reservas cuando el saldo del usuario cambia.
export async function actualizarTipoCliente(
  usuarioId: number,
  clasesDisponibles: number
): Promise<void> {
  // Con 1 o 2 clases el estado no cambia
  if (clasesDisponibles === 1 || clasesDisponibles === 2) return;

  const nuevoTipo = clasesDisponibles === 0 ? "NO_ABONADO" : "ABONADO";

  const usuario = await prisma.usuario.findUnique({
    where: { id: usuarioId },
    select: { tipoCliente: true },
  });

  if (!usuario) throw new Error(`Usuario ${usuarioId} no encontrado`);

  // Solo escribimos si el tipo efectivamente cambia
  if (usuario.tipoCliente === nuevoTipo) return;

  await prisma.usuario.update({
    where: { id: usuarioId },
    data: { tipoCliente: nuevoTipo },
  });
}
