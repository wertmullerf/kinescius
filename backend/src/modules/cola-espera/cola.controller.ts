import { Request, Response, NextFunction } from "express";
import { colaService } from "./cola.service";
import { ok, created } from "../../utils/response";

export const colaController = {
  async unirse(req: Request, res: Response, next: NextFunction) {
    try {
      const instanciaId = Number(req.params.instanciaId);
      const clienteId   = req.user!.id;
      const entrada = await colaService.unirse(instanciaId, clienteId);
      created(res, entrada, `Agregado a la cola en posición ${entrada.posicion}`);
    } catch (err) {
      next(err);
    }
  },

  async salir(req: Request, res: Response, next: NextFunction) {
    try {
      const instanciaId = Number(req.params.instanciaId);
      // ADMIN puede eliminar a cualquiera; CLIENTE solo a sí mismo
      const clienteId =
        req.user!.rol === "ADMIN" && req.body.clienteId
          ? Number(req.body.clienteId)
          : req.user!.id;
      await colaService.salir(instanciaId, clienteId);
      ok(res, null, "Eliminado de la cola de espera");
    } catch (err) {
      next(err);
    }
  },

  async listar(req: Request, res: Response, next: NextFunction) {
    try {
      const instanciaId = Number(req.params.instanciaId);
      const cola = await colaService.listar(instanciaId);
      ok(res, cola);
    } catch (err) {
      next(err);
    }
  },
};
