import { Request, Response, NextFunction } from "express";
import { agendaService } from "./agenda.service";
import { ok, created } from "../../utils/response";

export const agendaController = {
  async listar(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await agendaService.listar();
      ok(res, data);
    } catch (err) {
      next(err);
    }
  },

  async obtener(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await agendaService.obtener(Number(req.params.id));
      ok(res, data);
    } catch (err) {
      next(err);
    }
  },

  async crear(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await agendaService.crear(req.body);
      created(res, data, "Agenda creada correctamente");
    } catch (err) {
      next(err);
    }
  },

  async eliminar(req: Request, res: Response, next: NextFunction) {
    try {
      await agendaService.eliminar(Number(req.params.id));
      ok(res, null, "Agenda eliminada correctamente");
    } catch (err) {
      next(err);
    }
  },
};
