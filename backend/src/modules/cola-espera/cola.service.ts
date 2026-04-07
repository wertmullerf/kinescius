import { prisma } from "../../db/prisma";
import {
  mailColaEsperaNotificacion,
} from "../../utils/mailer";

// Timers activos de expiración de cola: instanciaId → NodeJS.Timeout
const timersCola = new Map<number, NodeJS.Timeout>();

export const colaService = {
  /**
   * Agrega un cliente a la cola de espera de una instancia.
   * ABONADO: va delante de todos los NO_ABONADO.
   * NO_ABONADO: va al final.
   */
  async unirse(instanciaId: number, clienteId: number) {
    // Verificar que la instancia existe
    const instancia = await prisma.claseInstancia.findUnique({
      where: { id: instanciaId },
    });
    if (!instancia) throw new Error("Instancia no encontrada");

    // No puede estar ya en la cola
    const yaEnCola = await prisma.colaEspera.findUnique({
      where: { instanciaId_clienteId: { instanciaId, clienteId } },
    });
    if (yaEnCola) throw new Error("Ya estás en la cola de espera de esta clase");

    // No puede tener reserva activa en la misma instancia
    const reservaActiva = await prisma.reserva.findFirst({
      where: {
        instanciaId,
        clienteId,
        estado: { in: ["PENDIENTE_PAGO", "RESERVA_PAGA", "CONFIRMADA"] },
      },
    });
    if (reservaActiva) {
      throw new Error("Ya tenés una reserva activa en esta clase");
    }

    const cliente = await prisma.usuario.findUnique({
      where: { id: clienteId },
      select: { tipoCliente: true },
    });
    if (!cliente) throw new Error("Usuario no encontrado");

    // Determinar posición según prioridad
    const cola = await prisma.colaEspera.findMany({
      where: { instanciaId },
      orderBy: { posicion: "asc" },
    });

    let nuevaPosicion: number;

    if (cliente.tipoCliente === "ABONADO") {
      // Va antes del primer NO_ABONADO
      const primerNoAbonado = await prisma.colaEspera.findFirst({
        where: {
          instanciaId,
          cliente: { tipoCliente: "NO_ABONADO" },
        },
        orderBy: { posicion: "asc" },
      });

      if (primerNoAbonado) {
        nuevaPosicion = primerNoAbonado.posicion;
        // Desplazar hacia abajo a todos los NO_ABONADO desde esa posición
        await prisma.$transaction(
          cola
            .filter((c) => c.posicion >= nuevaPosicion)
            .map((c) =>
              prisma.colaEspera.update({
                where: { id: c.id },
                data: { posicion: c.posicion + 1 },
              })
            )
        );
      } else {
        nuevaPosicion = cola.length + 1;
      }
    } else {
      nuevaPosicion = cola.length + 1;
    }

    const entrada = await prisma.colaEspera.create({
      data: { instanciaId, clienteId, posicion: nuevaPosicion },
    });

    return { ...entrada, posicion: nuevaPosicion };
  },

  /** Elimina a un cliente de la cola y reordena posiciones. */
  async salir(instanciaId: number, clienteId: number) {
    const entrada = await prisma.colaEspera.findUnique({
      where: { instanciaId_clienteId: { instanciaId, clienteId } },
    });
    if (!entrada) throw new Error("No estás en la cola de espera de esta clase");

    const posicionEliminada = entrada.posicion;

    await prisma.$transaction([
      prisma.colaEspera.delete({ where: { id: entrada.id } }),
      // Reordenar los que siguen
      prisma.$executeRaw`
        UPDATE cola_espera
        SET posicion = posicion - 1
        WHERE "instanciaId" = ${instanciaId}
          AND posicion > ${posicionEliminada}
      `,
    ]);
  },

  /** Lista toda la cola de una instancia (solo ADMIN). */
  async listar(instanciaId: number) {
    return prisma.colaEspera.findMany({
      where: { instanciaId },
      include: {
        cliente: {
          select: { id: true, nombre: true, apellido: true, email: true, tipoCliente: true },
        },
      },
      orderBy: { posicion: "asc" },
    });
  },

  /**
   * Notifica al primer cliente de la cola cuando se libera un cupo.
   * Establece expiraEn = ahora + 5hs y programa expiración automática.
   */
  async notificarPrimero(instanciaId: number) {
    const primero = await prisma.colaEspera.findFirst({
      where: { instanciaId, posicion: 1 },
      include: {
        cliente: { select: { id: true, nombre: true, email: true } },
        instancia: { select: { fecha: true, zona: true } },
      },
    });
    if (!primero) return; // cola vacía

    const expiraEn = new Date(Date.now() + 5 * 60 * 60 * 1000); // +5hs

    await prisma.colaEspera.update({
      where: { id: primero.id },
      data: { expiraEn },
    });

    await mailColaEsperaNotificacion(
      { nombre: primero.cliente.nombre, email: primero.cliente.email },
      { fecha: primero.instancia.fecha, zona: primero.instancia.zona },
      expiraEn
    );

    // Cancelar timer previo si existe
    const timerExistente = timersCola.get(instanciaId);
    if (timerExistente) clearTimeout(timerExistente);

    // Programar expiración automática en 5hs
    const timer = setTimeout(async () => {
      timersCola.delete(instanciaId);
      try {
        // Si el cliente todavía está en la cola (no reservó), lo eliminamos
        const aun = await prisma.colaEspera.findUnique({
          where: { instanciaId_clienteId: { instanciaId, clienteId: primero.cliente.id } },
        });
        if (!aun) return; // ya reservó, nada que hacer

        await colaService.salir(instanciaId, primero.cliente.id);
        // Notificar al siguiente
        await colaService.notificarPrimero(instanciaId);
      } catch (err) {
        console.error("[colaService] Error en expiración de cola:", err);
      }
    }, 5 * 60 * 60 * 1000);

    timersCola.set(instanciaId, timer);
  },
};
