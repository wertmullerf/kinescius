import { Request, Response, NextFunction } from "express";
import { pagoService } from "./pago.service";
import { ok, created, forbidden } from "../../utils/response";
import { prisma } from "../../db/prisma";
import type { MetodoPago } from "../../types/models";

export const pagoController = {
  // POST /pagos/abono — abono presencial (ADMIN)
  async cargarAbono(req: Request, res: Response, next: NextFunction) {
    try {
      const { clienteId, cantidadClases, monto, metodo, referencia } = req.body;
      const resultado = await pagoService.cargarAbonoPresencial(
        Number(clienteId),
        Number(cantidadClases),
        Number(monto),
        metodo as MetodoPago,
        req.user!.id,
        referencia
      );
      created(res, resultado, "Abono cargado correctamente");
    } catch (err) {
      next(err);
    }
  },

  // POST /pagos/abono/mp — iniciar abono por MP (CLIENTE)
  async iniciarAbonoMp(req: Request, res: Response, next: NextFunction) {
    try {
      const { cantidadClases, monto } = req.body;
      const resultado = await pagoService.iniciarAbonoMp(
        req.user!.id,
        Number(cantidadClases),
        Number(monto)
      );
      created(res, resultado, "Preferencia de pago generada");
    } catch (err) {
      next(err);
    }
  },

  // POST /pagos/complemento/:reservaId — registrar complemento (ADMIN)
  async registrarComplemento(req: Request, res: Response, next: NextFunction) {
    try {
      const reservaId = Number(req.params.reservaId);
      const { metodo, referencia } = req.body;
      const pago = await pagoService.registrarComplemento(
        reservaId,
        metodo as MetodoPago,
        req.user!.id,
        referencia
      );
      created(res, pago, "Complemento registrado correctamente");
    } catch (err) {
      next(err);
    }
  },

  // GET /pagos/reserva/:reservaId — ver pagos de una reserva
  async listarPorReserva(req: Request, res: Response, next: NextFunction) {
    try {
      const reservaId = Number(req.params.reservaId);

      // CLIENTE solo puede ver pagos de sus propias reservas
      if (req.user!.rol === "CLIENTE") {
        const reserva = await prisma.reserva.findUnique({ where: { id: reservaId } });
        if (!reserva || reserva.clienteId !== req.user!.id) {
          forbidden(res);
          return;
        }
      }

      const pagos = await pagoService.listarPorReserva(reservaId);
      ok(res, pagos);
    } catch (err) {
      next(err);
    }
  },

  // POST /pagos/webhook — webhook de MP (público)
  async webhook(req: Request, res: Response, next: NextFunction) {
    try {
      const signature = req.headers["x-signature"] as string ?? "";
      const resultado = await pagoService.procesarWebhook(req.body, signature);
      ok(res, resultado);
    } catch (err) {
      next(err);
    }
  },
};
