import { Router } from "express";
import { claseController } from "./clase.controller";
import { authenticateToken, authorizeRoles } from "../../middlewares/auth.middleware";
import { validate } from "../../middlewares/validate.middleware";
import {
  crearPatronSchema,
  editarPatronSchema,
  editarInstanciaSchema,
  crearSueltaSchema,
} from "./clase.validation";

// Montado en /api desde routes.ts.
// Todas las rutas llevan el prefijo /api explícito en su definición
// para que sean autodocumentadas cuando se lee este archivo.
const router = Router();

// ── Patrones recurrentes ────────────────────────────────────────────────────
router.get(
  "/agenda/:agendaId/recurrentes",
  authenticateToken, authorizeRoles("ADMIN", "PROFESOR"),
  claseController.listarPatrones
);

router.post(
  "/agenda/:agendaId/recurrentes",
  authenticateToken, authorizeRoles("ADMIN"),
  validate(crearPatronSchema),
  claseController.crearPatron
);

router.put(
  "/agenda/:agendaId/recurrentes/:id",
  authenticateToken, authorizeRoles("ADMIN"),
  validate(editarPatronSchema),
  claseController.editarPatron
);

router.delete(
  "/agenda/:agendaId/recurrentes/:id",
  authenticateToken, authorizeRoles("ADMIN"),
  claseController.eliminarPatron
);

// ── Instancias del mes ──────────────────────────────────────────────────────
router.get(
  "/agenda/:agendaId/instancias",
  authenticateToken, authorizeRoles("ADMIN", "PROFESOR", "CLIENTE"),
  claseController.listarInstancias
);

// ── Instancias sueltas (antes de /:id para evitar que "sueltas" sea tratado como param)
router.post(
  "/instancias/sueltas",
  authenticateToken, authorizeRoles("ADMIN"),
  validate(crearSueltaSchema),
  claseController.crearSuelta
);

router.delete(
  "/instancias/sueltas/:id",
  authenticateToken, authorizeRoles("ADMIN"),
  claseController.eliminarSuelta
);

// ── Instancias puntuales (excepción / cancelación) ──────────────────────────
// /cancelar antes de /:id para evitar ambigüedad
router.patch(
  "/instancias/:id/cancelar",
  authenticateToken, authorizeRoles("ADMIN"),
  claseController.cancelarInstancia
);

router.patch(
  "/instancias/:id",
  authenticateToken, authorizeRoles("ADMIN"),
  validate(editarInstanciaSchema),
  claseController.editarInstancia
);

export default router;
