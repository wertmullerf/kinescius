import { Router } from "express";
import { authenticateToken, authorizeRoles } from "../../middlewares/auth.middleware";
import { validate } from "../../middlewares/validate.middleware";
import { pagoController } from "./pago.controller";
import { abonoPresencialSchema, abonoMpSchema, complementoSchema } from "./pago.validation";

const router = Router();

/**
 * POST /api/pagos/webhook
 * Formato nuevo: { type: "payment", action: "payment.created|updated", data: { id: "..." } }
 *
 * GET /api/pagos/webhook
 * Formato IPN: ?topic=payment&id=PAYMENT_ID
 *
 * Ambas rutas son públicas y van PRIMERO, antes de cualquier middleware de auth.
 */
router.post("/webhook", pagoController.webhookPost);
router.get("/webhook",  pagoController.webhookGet);

/**
 * POST /api/pagos/abono
 * Admin registra un abono presencial (efectivo / transferencia).
 * Body: { clienteId, cantidadClases, monto, metodo, referencia? }
 */
router.post(
  "/abono",
  authenticateToken,
  authorizeRoles("ADMIN"),
  validate(abonoPresencialSchema),
  pagoController.cargarAbono
);

/**
 * POST /api/pagos/abono/mp
 * Cliente inicia un abono de clases vía Mercado Pago Checkout Pro.
 * Body: { cantidadClases, monto }
 * Response: { initPoint, external_reference, mpPrefId }
 */
router.post(
  "/abono/mp",
  authenticateToken,
  authorizeRoles("CLIENTE"),
  validate(abonoMpSchema),
  pagoController.iniciarAbonoMp
);

/**
 * POST /api/pagos/complemento/:reservaId
 * Admin registra el saldo restante de una reserva con seña pagada.
 * Body: { metodo, referencia? }
 */
router.post(
  "/complemento/:reservaId",
  authenticateToken,
  authorizeRoles("ADMIN"),
  validate(complementoSchema),
  pagoController.registrarComplemento
);

/**
 * GET /api/pagos/abonos
 * Todos los abonos. Filtro opcional: ?q= (nombre/apellido/email/dni del cliente)
 * Debe ir ANTES de /abonos/:clienteId
 */
router.get(
  "/abonos",
  authenticateToken,
  authorizeRoles("ADMIN"),
  pagoController.listarAbonos
);

/**
 * GET /api/pagos/historial
 * Todos los pagos de reservas (señas y complementos). Filtro opcional: ?q=
 */
router.get(
  "/historial",
  authenticateToken,
  authorizeRoles("ADMIN"),
  pagoController.listarPagosReserva
);

/**
 * GET /api/pagos/abonos/:clienteId
 * Historial de abonos (presenciales y MP) de un cliente.
 * Rol: ADMIN
 */
router.get(
  "/abonos/:clienteId",
  authenticateToken,
  authorizeRoles("ADMIN"),
  pagoController.listarAbonosPorCliente
);

/**
 * GET /api/pagos/reserva/:reservaId
 * Lista los pagos de una reserva. Admin ve cualquiera; cliente solo las propias.
 */
router.get(
  "/reserva/:reservaId",
  authenticateToken,
  authorizeRoles("ADMIN", "CLIENTE"),
  pagoController.listarPorReserva
);

export default router;
