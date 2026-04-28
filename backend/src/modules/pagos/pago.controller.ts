import { Request, Response, NextFunction } from "express";
import { pagoService } from "./pago.service";
import { ok, created, forbidden } from "../../utils/response";
import { prisma } from "../../db/prisma";
import type { MetodoPago } from "../../types/models";

export const pagoController = {

  // POST /api/pagos/abono
  async cargarAbono(req: Request, res: Response, next: NextFunction) {
    try {
      const { clienteId, cantidadClases, precioPorClase, metodo, referencia } = req.body;
      const cliente = await prisma.usuario.findUnique({ where: { id: Number(clienteId) } });
      const descuento = cliente?.sancionado ? 0 : 0.20;
      const monto = Math.round(Number(cantidadClases) * Number(precioPorClase) * (1 - descuento));
      const resultado = await pagoService.cargarAbonoPresencial(
        Number(clienteId),
        Number(cantidadClases),
        monto,
        metodo as MetodoPago,
        req.user!.id,
        referencia
      );
      created(res, resultado, "Abono cargado correctamente");
    } catch (err) {
      next(err);
    }
  },

  // POST /api/pagos/abono/mp
  async iniciarAbonoMp(req: Request, res: Response, next: NextFunction) {
    try {
      const { cantidadClases, precioPorClase } = req.body;
      const cliente = await prisma.usuario.findUnique({ where: { id: req.user!.id } });
      const descuento = cliente?.sancionado ? 0 : 0.20;
      const monto = Math.round(Number(cantidadClases) * Number(precioPorClase) * (1 - descuento));
      const resultado = await pagoService.iniciarAbonoMp(
        req.user!.id,
        Number(cantidadClases),
        monto
      );
      created(res, resultado, "Preferencia de pago generada");
    } catch (err) {
      next(err);
    }
  },

  // POST /api/pagos/complemento/:reservaId
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

  // GET /api/pagos/abonos  — todos los abonos (ADMIN, filtro opcional ?q=)
  async listarAbonos(req: Request, res: Response, next: NextFunction) {
    try {
      const q    = typeof req.query.q === "string" ? req.query.q : undefined;
      const data = await pagoService.listarAbonos(q);
      ok(res, data);
    } catch (err) {
      next(err);
    }
  },

  // GET /api/pagos/historial  — todos los pagos de reservas (ADMIN, filtro opcional ?q=)
  async listarPagosReserva(req: Request, res: Response, next: NextFunction) {
    try {
      const q    = typeof req.query.q === "string" ? req.query.q : undefined;
      const data = await pagoService.listarPagosReserva(q);
      ok(res, data);
    } catch (err) {
      next(err);
    }
  },

  // GET /api/pagos/abonos/:clienteId  — historial de abonos de un cliente (ADMIN)
  async listarAbonosPorCliente(req: Request, res: Response, next: NextFunction) {
    try {
      const clienteId = Number(req.params.clienteId);
      const abonos    = await pagoService.listarAbonosPorCliente(clienteId);
      ok(res, abonos);
    } catch (err) {
      next(err);
    }
  },

  // GET /api/pagos/reserva/:reservaId
  async listarPorReserva(req: Request, res: Response, next: NextFunction) {
    try {
      const reservaId = Number(req.params.reservaId);

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

  // POST /api/pagos/webhook
  // MP envía JSON body: { type: "payment", action: "payment.created", data: { id: "..." } }
  async webhookPost(req: Request, res: Response, next: NextFunction) {
    try {
      const resultado = await pagoService.procesarWebhookPost(
        req.body as Record<string, string | object>
      );
      ok(res, resultado);
    } catch (err) {
      next(err);
    }
  },

  // GET /api/pagos/webhook
  // MP envía query params: ?topic=payment&id=PAYMENT_ID  (formato IPN)
  async webhookGet(req: Request, res: Response, next: NextFunction) {
    try {
      const topic     = typeof req.query["topic"] === "string" ? req.query["topic"] : "";
      const paymentId = typeof req.query["id"]    === "string" ? req.query["id"]    : "";
      const resultado = await pagoService.procesarWebhookIpn(topic, paymentId);
      ok(res, resultado);
    } catch (err) {
      next(err);
    }
  },
};
