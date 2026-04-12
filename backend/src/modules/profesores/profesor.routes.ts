import { Router } from "express";
import multer from "multer";
import { profesorController } from "./profesor.controller";
import { authenticateToken, authorizeRoles } from "../../middlewares/auth.middleware";
import { validate } from "../../middlewares/validate.middleware";
import { crearProfesorSchema, editarProfesorSchema } from "./profesor.validation";

const upload = multer({
  storage: multer.memoryStorage(),
  limits:  { fileSize: 5 * 1024 * 1024 }, // 5 MB máximo
  fileFilter: (_req, file, cb) => {
    if (file.mimetype.startsWith("image/")) cb(null, true);
    else cb(new Error("Solo se permiten archivos de imagen"));
  },
});

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

router.post(
  "/:id/imagen",
  authenticateToken, authorizeRoles("ADMIN"),
  upload.single("imagen"),
  profesorController.subirImagen
);

router.delete(
  "/:id",
  authenticateToken, authorizeRoles("ADMIN"),
  profesorController.eliminar
);

export default router;
