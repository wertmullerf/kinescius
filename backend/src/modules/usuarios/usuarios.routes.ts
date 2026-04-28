import { Router } from "express";
import { authenticateToken, authorizeRoles } from "../../middlewares/auth.middleware";
import { usuariosController } from "./usuarios.controller";

const router = Router();

/**
 * GET /api/usuarios
 * Lista todos los clientes. Soporta filtros por query:
 *   ?busqueda=  — nombre, apellido, dni o email (parcial, case-insensitive)
 *   ?tipoCliente=ABONADO|NO_ABONADO
 *   ?sancionado=true|false
 */
router.get(
  "/",
  authenticateToken,
  authorizeRoles("ADMIN"),
  usuariosController.listar
);

/**
 * GET /api/usuarios/mi-saldo
 * Devuelve el saldo a favor y los últimos 20 movimientos del cliente autenticado.
 */
router.get(
  "/mi-saldo",
  authenticateToken,
  authorizeRoles("CLIENTE"),
  usuariosController.miSaldo
);

/**
 * POST /api/usuarios/reclamar-saldo
 * El cliente retira su saldo a favor (queda en 0 en DB).
 */
router.post(
  "/reclamar-saldo",
  authenticateToken,
  authorizeRoles("CLIENTE"),
  usuariosController.reclamarSaldo
);

/**
 * GET /api/usuarios/:id
 * Detalle de un cliente con sus últimas 20 reservas.
 */
router.get(
  "/:id",
  authenticateToken,
  authorizeRoles("ADMIN"),
  usuariosController.obtener
);

/**
 * PUT /api/usuarios/:id
 * Edita datos de un cliente.
 * Body (todos opcionales): { nombre, apellido, dni, email, password, sancionado }
 */
router.put(
  "/:id",
  authenticateToken,
  authorizeRoles("ADMIN"),
  usuariosController.editar
);

/**
 * DELETE /api/usuarios/:id
 * Elimina un cliente. Falla si tiene reservas activas.
 */
router.delete(
  "/:id",
  authenticateToken,
  authorizeRoles("ADMIN"),
  usuariosController.eliminar
);

export default router;
