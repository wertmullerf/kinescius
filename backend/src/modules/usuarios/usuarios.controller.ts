import { Request, Response, NextFunction } from "express";
import { usuariosService } from "./usuarios.service";
import { ok } from "../../utils/response";

export const usuariosController = {

  // GET /api/usuarios?busqueda=&tipoCliente=&sancionado=
  async listar(req: Request, res: Response, next: NextFunction) {
    try {
      const { busqueda, tipoCliente, sancionado } = req.query;
      const clientes = await usuariosService.listar({
        busqueda:    typeof busqueda === "string" ? busqueda : undefined,
        tipoCliente: tipoCliente === "ABONADO" || tipoCliente === "NO_ABONADO"
                       ? tipoCliente : undefined,
        sancionado:  sancionado === "true" ? true : sancionado === "false" ? false : undefined,
      });
      ok(res, clientes);
    } catch (err) {
      next(err);
    }
  },

  // GET /api/usuarios/:id
  async obtener(req: Request, res: Response, next: NextFunction) {
    try {
      const cliente = await usuariosService.obtener(Number(req.params.id));
      ok(res, cliente);
    } catch (err) {
      next(err);
    }
  },

  // PUT /api/usuarios/:id
  async editar(req: Request, res: Response, next: NextFunction) {
    try {
      const { nombre, apellido, dni, email, password, sancionado } = req.body;
      const cliente = await usuariosService.editar(Number(req.params.id), {
        nombre, apellido, dni, email, password, sancionado,
      });
      ok(res, cliente);
    } catch (err) {
      next(err);
    }
  },

  // DELETE /api/usuarios/:id
  async eliminar(req: Request, res: Response, next: NextFunction) {
    try {
      await usuariosService.eliminar(Number(req.params.id));
      ok(res, null, "Cliente eliminado correctamente");
    } catch (err) {
      next(err);
    }
  },

  // GET /api/usuarios/mi-saldo
  async miSaldo(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await usuariosService.miSaldo(req.user!.id);
      ok(res, result);
    } catch (err) {
      next(err);
    }
  },

  // POST /api/usuarios/reclamar-saldo
  async reclamarSaldo(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await usuariosService.reclamarSaldo(req.user!.id);
      ok(res, result, `Se procesó la devolución de $${result.monto}`);
    } catch (err) {
      next(err);
    }
  },
};
