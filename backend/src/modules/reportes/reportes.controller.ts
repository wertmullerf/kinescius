import { Request, Response, NextFunction } from "express";
import { reportesService } from "./reportes.service";
import { ok } from "../../utils/response";

export const reportesController = {

  // GET /api/reportes/dashboard — solo ADMIN
  async getDashboard(req: Request, res: Response, next: NextFunction) {
    try {
      const stats = await reportesService.getDashboard();
      ok(res, stats);
    } catch (err) {
      next(err);
    }
  },
};
