import { Router } from "express";
import { configuracionController } from "./configuracion.controller";
import { authenticateToken, authorizeRoles } from "../../middlewares/auth.middleware";

const router = Router();

// Cualquier usuario autenticado puede leer la config (el cliente la necesita para mostrar el precio)
router.get(
  "/",
  authenticateToken,
  configuracionController.obtenerTodas
);

// Solo ADMIN puede modificar
router.patch(
  "/",
  authenticateToken, authorizeRoles("ADMIN"),
  configuracionController.actualizar
);

export default router;
