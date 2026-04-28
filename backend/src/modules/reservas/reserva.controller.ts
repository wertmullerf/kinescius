import { Request, Response, NextFunction } from "express";
import { reservaService } from "./reserva.service";
import { ok, created, forbidden, notFound } from "../../utils/response";

export const reservaController = {
  async crear(req: Request, res: Response, next: NextFunction) {
    try {
      const clienteId   = req.user!.id;
      const instanciaId = Number(req.body.instanciaId);
      const tarjeta     = req.body.tarjeta ?? undefined;
      const resultado   = await reservaService.crear(clienteId, instanciaId, tarjeta);

      if (resultado.sinCupo) {
        const posicion = "posicionCola" in resultado ? resultado.posicionCola : undefined;
        ok(res, { posicionCola: posicion }, "No hay cupo disponible. Fuiste agregado a la cola de espera.");
        return;
      }

      // Re-fetch con includes para que el frontend reciba la reserva completa (con instancia, profesor, etc.)
      const r = resultado as { reserva: { id: number }; sinCupo: false; initPoint?: string };
      const reservaCompleta = await reservaService.obtener(r.reserva.id);
      const data = { ...reservaCompleta, ...(r.initPoint ? { initPoint: r.initPoint } : {}) };
      created(res, data, "Reserva creada correctamente");
    } catch (err) {
      next(err);
    }
  },

  async listar(req: Request, res: Response, next: NextFunction) {
    try {
      const clienteId = req.user!.rol === "ADMIN"
        ? (req.query.clienteId ? Number(req.query.clienteId) : undefined)
        : req.user!.id;
      const instanciaId = req.query.instanciaId ? Number(req.query.instanciaId) : undefined;
      const reservas    = await reservaService.listar(clienteId, instanciaId);
      ok(res, reservas);
    } catch (err) {
      next(err);
    }
  },

  async obtener(req: Request, res: Response, next: NextFunction) {
    try {
      const id      = Number(req.params.id);
      const reserva = await reservaService.obtener(id);

      // CLIENTE solo puede ver sus propias reservas
      if (req.user!.rol === "CLIENTE" && reserva.clienteId !== req.user!.id) {
        notFound(res);
        return;
      }
      ok(res, reserva);
    } catch (err) {
      next(err);
    }
  },

  async cambiar(req: Request, res: Response, next: NextFunction) {
    try {
      const reservaId       = Number(req.params.id);
      const clienteId       = req.user!.id;
      const nuevaInstanciaId = Number(req.body.nuevaInstanciaId);
      const reserva = await reservaService.cambiar(reservaId, clienteId, nuevaInstanciaId);
      ok(res, reserva, "Clase cambiada correctamente");
    } catch (err) {
      next(err);
    }
  },

  async obtenerInitPoint(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await reservaService.obtenerInitPoint(
        Number(req.params.id),
        req.user!.id
      );
      ok(res, data);
    } catch (err) {
      next(err);
    }
  },

  async cancelar(req: Request, res: Response, next: NextFunction) {
    try {
      const id      = Number(req.params.id);
      const usuario = req.user!;

      // CLIENTE solo puede cancelar sus propias reservas
      if (usuario.rol === "CLIENTE") {
        const reserva = await reservaService.obtener(id);
        if (reserva.clienteId !== usuario.id) {
          forbidden(res);
          return;
        }
      }

      await reservaService.cancelar(id, usuario.id);
      ok(res, null, "Reserva cancelada correctamente");
    } catch (err) {
      next(err);
    }
  },
};
