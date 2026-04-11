import { Router } from "express";
import { agendaController } from "./agenda.controller";
import { authenticateToken, authorizeRoles } from "../../middlewares/auth.middleware";
import { validate } from "../../middlewares/validate.middleware";
import { crearAgendaSchema } from "./agenda.validation";

const router = Router();

router.get(
  "/",
  authenticateToken, authorizeRoles("ADMIN", "PROFESOR", "CLIENTE"),
  agendaController.listar
);

router.get(
  "/:id",
  authenticateToken, authorizeRoles("ADMIN", "PROFESOR", "CLIENTE"),
  agendaController.obtener
);

router.post(
  "/",
  authenticateToken, authorizeRoles("ADMIN"),
  validate(crearAgendaSchema),
  agendaController.crear
);

router.delete(
  "/:id",
  authenticateToken, authorizeRoles("ADMIN"),
  agendaController.eliminar
);

export default router;
