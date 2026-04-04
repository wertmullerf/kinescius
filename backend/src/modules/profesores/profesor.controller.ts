import { Request, Response, NextFunction } from "express";
import { profesorService } from "./profesor.service";
import { ok, created } from "../../utils/response";

export const profesorController = {
  async listar(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await profesorService.listar();
      ok(res, data);
    } catch (err) {
      next(err);
    }
  },

  async obtener(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await profesorService.obtener(Number(req.params.id));
      ok(res, data);
    } catch (err) {
      next(err);
    }
  },

  async crear(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await profesorService.crear(req.body);
      created(res, data, "Profesor creado correctamente");
    } catch (err) {
      next(err);
    }
  },

  async editar(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await profesorService.editar(Number(req.params.id), req.body);
      ok(res, data, "Profesor actualizado correctamente");
    } catch (err) {
      next(err);
    }
  },

  async eliminar(req: Request, res: Response, next: NextFunction) {
    try {
      await profesorService.eliminar(Number(req.params.id));
      ok(res, null, "Profesor eliminado correctamente");
    } catch (err) {
      next(err);
    }
  },
};
