import { Router } from "express";
import { authenticateToken, authorizeRoles } from "../../middlewares/auth.middleware";
import { colaController } from "./cola.controller";

const router = Router();

// POST /cola-espera/:instanciaId — unirse a la cola (CLIENTE)
router.post(
  "/:instanciaId",
  authenticateToken,
  authorizeRoles("CLIENTE"),
  colaController.unirse
);

// DELETE /cola-espera/:instanciaId — salir de la cola (CLIENTE y ADMIN)
router.delete(
  "/:instanciaId",
  authenticateToken,
  authorizeRoles("ADMIN", "CLIENTE"),
  colaController.salir
);

// GET /cola-espera/mias — mis entradas en cola (CLIENTE)
// Debe ir ANTES de /:instanciaId para que "mias" no sea interpretado como param
router.get(
  "/mias",
  authenticateToken,
  authorizeRoles("CLIENTE"),
  colaController.misEntradas
);

// GET /cola-espera/:instanciaId — ver cola (ADMIN)
router.get(
  "/:instanciaId",
  authenticateToken,
  authorizeRoles("ADMIN"),
  colaController.listar
);

export default router;
