import type { Request, Response } from "express";
import { configuracionService } from "./configuracion.service";

export const configuracionController = {

  async obtenerTodas(req: Request, res: Response) {
    try {
      const config = await configuracionService.obtenerTodas();
      res.json({ success: true, data: config });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Error interno";
      res.status(500).json({ success: false, error: message });
    }
  },

  async actualizar(req: Request, res: Response) {
    try {
      const cambios = req.body as Record<string, string>;
      if (!cambios || typeof cambios !== "object" || Array.isArray(cambios)) {
        res.status(400).json({ success: false, error: "Body debe ser un objeto clave-valor" });
        return;
      }
      const config = await configuracionService.actualizarVarias(cambios);
      res.json({ success: true, data: config });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Error interno";
      res.status(400).json({ success: false, error: message });
    }
  },
};
