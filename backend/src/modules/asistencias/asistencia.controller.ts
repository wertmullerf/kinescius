import { Request, Response, NextFunction } from "express";
import { asistenciaService } from "./asistencia.service";
import { ok } from "../../utils/response";

export const asistenciaController = {

  // GET /api/asistencias?q=  — listado global (ADMIN)
  async listarTodas(req: Request, res: Response, next: NextFunction) {
    try {
      const q    = typeof req.query.q === "string" ? req.query.q : undefined;
      const data = await asistenciaService.listarTodas(q);
      ok(res, data);
    } catch (err) {
      next(err);
    }
  },

  // GET /api/asistencias/qr/:codigoQr
  // Profesor escanea el QR de la clase → obtiene lista de alumnos a marcar
  async obtenerPorQr(req: Request, res: Response, next: NextFunction) {
    try {
      const instancia = await asistenciaService.obtenerPorQr(req.params.codigoQr);
      ok(res, instancia);
    } catch (err) {
      next(err);
    }
  },

  // PATCH /api/asistencias/:reservaId
  // Body: { presente: boolean }
  // Marca la asistencia de un alumno y cierra la reserva como COMPLETADA
  async marcar(req: Request, res: Response, next: NextFunction) {
    try {
      const reservaId   = Number(req.params.reservaId);
      const { presente } = req.body as { presente: boolean };
      const asistencia  = await asistenciaService.marcar(reservaId, presente, req.user!.id);
      ok(res, asistencia);
    } catch (err) {
      next(err);
    }
  },

  // GET /api/asistencias/clase/:instanciaId
  // Vista completa de asistencia de una clase (ADMIN)
  async listarPorClase(req: Request, res: Response, next: NextFunction) {
    try {
      const instancia = await asistenciaService.listarPorClase(Number(req.params.instanciaId));
      ok(res, instancia);
    } catch (err) {
      next(err);
    }
  },

  // GET /api/asistencias/mis-clases
  // Clases del profesor autenticado (últimos 2 días + próximos 60) con lista de alumnos
  async misClases(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await asistenciaService.misClases();
      ok(res, data);
    } catch (err) {
      next(err);
    }
  },

  // POST /api/asistencias/dar-presente
  // El cliente escanea el QR de la clase y se marca presente a sí mismo
  async darPresente(req: Request, res: Response, next: NextFunction) {
    try {
      const { codigoQr } = req.body as { codigoQr: string };
      const asistencia = await asistenciaService.darPresente(codigoQr, req.user!.id);
      ok(res, asistencia, "¡Presente registrado correctamente!");
    } catch (err) {
      next(err);
    }
  },

  // GET /api/asistencias/cliente/:clienteId
  // Historial de asistencias de un cliente (ADMIN)
  async historialCliente(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await asistenciaService.historialCliente(Number(req.params.clienteId));
      ok(res, data);
    } catch (err) {
      next(err);
    }
  },
};
