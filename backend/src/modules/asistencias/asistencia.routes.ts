import { Router } from "express";
import { authenticateToken, authorizeRoles } from "../../middlewares/auth.middleware";
import { asistenciaController } from "./asistencia.controller";

const router = Router();

/**
 * GET /api/asistencias
 * Listado global de asistencias. Filtro opcional: ?q= (nombre/apellido/email del cliente)
 * Debe ir ANTES de las rutas con parámetros.
 */
router.get(
  "/",
  authenticateToken,
  authorizeRoles("ADMIN"),
  asistenciaController.listarTodas
);

/**
 * GET /api/asistencias/mis-clases
 * Clases propias del profesor (últimos 2 días + próximos 60), con lista de alumnos.
 * Rol: PROFESOR
 */
router.get(
  "/mis-clases",
  authenticateToken,
  authorizeRoles("PROFESOR"),
  asistenciaController.misClases
);

/**
 * POST /api/asistencias/dar-presente
 * El cliente escanea el QR y da su propio presente.
 * Solo disponible 2 horas antes de la clase.
 * Rol: CLIENTE
 */
router.post(
  "/dar-presente",
  authenticateToken,
  authorizeRoles("CLIENTE"),
  asistenciaController.darPresente
);

/**
 * GET /api/asistencias/qr/:codigoQr
 * Carga la clase a partir del código QR de la instancia.
 * Devuelve la clase con la lista de alumnos reservados y su estado de asistencia.
 * Rol: PROFESOR, ADMIN
 */
router.get(
  "/qr/:codigoQr",
  authenticateToken,
  authorizeRoles("PROFESOR", "ADMIN"),
  asistenciaController.obtenerPorQr
);

/**
 * PATCH /api/asistencias/:reservaId
 * Marca la asistencia de un alumno. Body: { presente: boolean }
 * Cierra la reserva como COMPLETADA independientemente de si asistió o no.
 * Rol: PROFESOR, ADMIN
 */
router.patch(
  "/:reservaId",
  authenticateToken,
  authorizeRoles("PROFESOR", "ADMIN"),
  asistenciaController.marcar
);

/**
 * GET /api/asistencias/clase/:instanciaId
 * Lista completa de asistencia de una clase.
 * Rol: ADMIN
 */
router.get(
  "/clase/:instanciaId",
  authenticateToken,
  authorizeRoles("ADMIN"),
  asistenciaController.listarPorClase
);

/**
 * GET /api/asistencias/cliente/:clienteId
 * Historial de asistencias de un cliente.
 * Rol: ADMIN
 */
router.get(
  "/cliente/:clienteId",
  authenticateToken,
  authorizeRoles("ADMIN"),
  asistenciaController.historialCliente
);

export default router;
