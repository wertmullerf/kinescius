import cron from "node-cron";
import { prisma } from "../db/prisma";
import { colaService } from "../modules/cola-espera/cola.service";

/**
 * Cron job que corre cada 30 minutos.
 *
 * Hace dos tareas:
 *  1. Cancela reservas en PENDIENTE_PAGO con más de 5hs sin pagar.
 *  2. Elimina de la cola a los clientes que no confirmaron a tiempo (expiraEn vencido).
 *
 * Reemplaza completamente los setTimeout en memoria que se perdían al reiniciar el servidor.
 */
cron.schedule("*/30 * * * *", async () => {
  const ahora = new Date();
  console.log(`[cron] ▶ Iniciando limpieza — ${ahora.toISOString()}`);

  let reservasCanceladas = 0;
  let colaExpiradas      = 0;

  // ── Tarea 1: Cancelar reservas PENDIENTE_PAGO con más de 5hs ──────────────
  // Una reserva lleva más de 5hs sin pagar si fue creada hace más de 5hs.
  const limiteReservas = new Date(ahora.getTime() - 5 * 60 * 60 * 1000);

  const reservasExpiradas = await prisma.reserva.findMany({
    where: {
      estado:    "PENDIENTE_PAGO",
      createdAt: { lt: limiteReservas },
    },
    select: { id: true, instanciaId: true },
  });

  for (const reserva of reservasExpiradas) {
    try {
      await prisma.reserva.update({
        where: { id: reserva.id },
        data:  { estado: "CANCELADA" },
      });
      console.log(`[cron] Reserva ${reserva.id} cancelada por expiración`);

      // Notificar al siguiente en la cola para que tenga la chance de reservar
      await colaService.notificarPrimero(reserva.instanciaId);

      reservasCanceladas++;
    } catch (err) {
      console.error(`[cron] Error cancelando reserva ${reserva.id}:`, err);
    }
  }

  // ── Tarea 2: Limpiar entradas de cola con expiraEn vencido ───────────────
  // Un cliente de la cola recibió la notificación pero no reservó a tiempo.
  const colaVencida = await prisma.colaEspera.findMany({
    where: {
      expiraEn: { not: null, lt: ahora },
    },
    select: { instanciaId: true, clienteId: true },
  });

  for (const entrada of colaVencida) {
    try {
      await colaService.salir(entrada.instanciaId, entrada.clienteId);
      console.log(`[cron] Cliente ${entrada.clienteId} removido de cola instancia ${entrada.instanciaId} por expiración`);

      // Notificar al siguiente en la fila
      await colaService.notificarPrimero(entrada.instanciaId);

      colaExpiradas++;
    } catch (err) {
      console.error(`[cron] Error removiendo cliente ${entrada.clienteId} de cola ${entrada.instanciaId}:`, err);
    }
  }

  console.log(`[cron] ✓ Finalizado: ${reservasCanceladas} reservas canceladas, ${colaExpiradas} entradas de cola expiradas`);
});
