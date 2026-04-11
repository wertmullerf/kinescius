import { Router } from "express";
import { authenticateToken, authorizeRoles } from "../../middlewares/auth.middleware";
import { validate } from "../../middlewares/validate.middleware";
import { reservaController } from "./reserva.controller";
import { crearReservaSchema, cambiarClaseSchema } from "./reserva.validation";

const router = Router();

// POST /reservas — crear reserva (CLIENTE)
router.post(
  "/",
  authenticateToken,
  authorizeRoles("CLIENTE"),
  validate(crearReservaSchema),
  reservaController.crear
);

// GET /reservas — listar reservas (ADMIN ve todas, CLIENTE ve las suyas)
router.get(
  "/",
  authenticateToken,
  authorizeRoles("ADMIN", "CLIENTE"),
  reservaController.listar
);

// GET /reservas/:id — ver detalle (ADMIN y dueño)
router.get(
  "/:id",
  authenticateToken,
  authorizeRoles("ADMIN", "CLIENTE"),
  reservaController.obtener
);

// GET /reservas/:id/init-point — obtener link de pago MP para una reserva PENDIENTE_PAGO (CLIENTE)
router.get(
  "/:id/init-point",
  authenticateToken,
  authorizeRoles("CLIENTE"),
  reservaController.obtenerInitPoint
);

// PATCH /reservas/:id/cambiar — cambiar a otra instancia del mismo día y zona (CLIENTE)
router.patch(
  "/:id/cambiar",
  authenticateToken,
  authorizeRoles("CLIENTE"),
  validate(cambiarClaseSchema),
  reservaController.cambiar
);

// DELETE /reservas/:id — cancelar reserva (ADMIN y dueño)
router.delete(
  "/:id",
  authenticateToken,
  authorizeRoles("ADMIN", "CLIENTE"),
  reservaController.cancelar
);

export default router;
