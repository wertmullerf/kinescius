import { Request, Response, NextFunction } from "express";
import { claseService } from "./clase.service";
import { ok, created } from "../../utils/response";
import type { ZonaClase } from "../../types/models";

export const claseController = {
  // ── Patrones recurrentes ────────────────────────────────────────

  async listarPatrones(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await claseService.listarPatrones(Number(req.params.agendaId));
      ok(res, data);
    } catch (err) {
      next(err);
    }
  },

  async crearPatron(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await claseService.crearPatron(Number(req.params.agendaId), req.body);
      created(res, data, "Patrón recurrente creado correctamente");
    } catch (err) {
      next(err);
    }
  },

  async editarPatron(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await claseService.editarPatron(
        Number(req.params.agendaId),
        Number(req.params.id),
        req.body
      );
      ok(res, data, "Patrón recurrente actualizado correctamente");
    } catch (err) {
      next(err);
    }
  },

  async eliminarPatron(req: Request, res: Response, next: NextFunction) {
    try {
      await claseService.eliminarPatron(
        Number(req.params.agendaId),
        Number(req.params.id)
      );
      ok(res, null, "Patrón recurrente eliminado correctamente");
    } catch (err) {
      next(err);
    }
  },

  // ── Instancias del mes ──────────────────────────────────────────

  async listarInstancias(req: Request, res: Response, next: NextFunction) {
    try {
      const { fecha, zona } = req.query as { fecha?: string; zona?: ZonaClase };
      const data = await claseService.listarInstancias(
        Number(req.params.agendaId),
        { fecha, zona }
      );
      ok(res, data);
    } catch (err) {
      next(err);
    }
  },

  async editarInstancia(req: Request, res: Response, next: NextFunction) {
    try {
      const { fecha, zona, profesorId, motivoExcepcion } = req.body;
      const data = await claseService.editarInstancia(Number(req.params.id), {
        ...(fecha           && { fecha: new Date(fecha) }),
        ...(zona            && { zona }),
        ...(profesorId      && { profesorId: Number(profesorId) }),
        motivoExcepcion,
      });
      ok(res, data, "Instancia actualizada como excepción");
    } catch (err) {
      next(err);
    }
  },

  async cancelarInstancia(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await claseService.cancelarInstancia(Number(req.params.id));
      ok(res, data, "Instancia cancelada correctamente");
    } catch (err) {
      next(err);
    }
  },

  // ── Instancias sueltas ──────────────────────────────────────────

  async crearSuelta(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await claseService.crearSuelta(req.body);
      created(res, data, "Clase suelta creada correctamente");
    } catch (err) {
      next(err);
    }
  },

  async eliminarSuelta(req: Request, res: Response, next: NextFunction) {
    try {
      await claseService.eliminarSuelta(Number(req.params.id));
      ok(res, null, "Clase suelta eliminada correctamente");
    } catch (err) {
      next(err);
    }
  },
};
