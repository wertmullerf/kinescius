import { Router } from "express";
import { profesorController } from "./profesor.controller";
import { authenticateToken, authorizeRoles } from "../../middlewares/auth.middleware";
import { validate } from "../../middlewares/validate.middleware";
import { crearProfesorSchema, editarProfesorSchema } from "./profesor.validation";

const router = Router();

router.get(
  "/",
  authenticateToken, authorizeRoles("ADMIN", "PROFESOR"),
  profesorController.listar
);

router.get(
  "/:id",
  authenticateToken, authorizeRoles("ADMIN", "PROFESOR"),
  profesorController.obtener
);

router.post(
  "/",
  authenticateToken, authorizeRoles("ADMIN"),
  validate(crearProfesorSchema),
  profesorController.crear
);

router.put(
  "/:id",
  authenticateToken, authorizeRoles("ADMIN"),
  validate(editarProfesorSchema),
  profesorController.editar
);

router.delete(
  "/:id",
  authenticateToken, authorizeRoles("ADMIN"),
  profesorController.eliminar
);

export default router;
