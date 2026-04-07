import { Router } from "express";
import { authenticateToken, authorizeRoles } from "../../middlewares/auth.middleware";
import { validate } from "../../middlewares/validate.middleware";
import { pagoController } from "./pago.controller";
import { abonoPresencialSchema, abonoMpSchema, complementoSchema } from "./pago.validation";

const router = Router();

// POST /pagos/abono — admin carga abono presencial (ADMIN)
router.post(
  "/abono",
  authenticateToken,
  authorizeRoles("ADMIN"),
  validate(abonoPresencialSchema),
  pagoController.cargarAbono
);

// POST /pagos/abono/mp — cliente inicia abono por MP (CLIENTE)
router.post(
  "/abono/mp",
  authenticateToken,
  authorizeRoles("CLIENTE"),
  validate(abonoMpSchema),
  pagoController.iniciarAbonoMp
);

// POST /pagos/complemento/:reservaId — admin registra 50% restante (ADMIN)
router.post(
  "/complemento/:reservaId",
  authenticateToken,
  authorizeRoles("ADMIN"),
  validate(complementoSchema),
  pagoController.registrarComplemento
);

// GET /pagos/reserva/:reservaId — ver pagos de una reserva (ADMIN y dueño)
router.get(
  "/reserva/:reservaId",
  authenticateToken,
  authorizeRoles("ADMIN", "CLIENTE"),
  pagoController.listarPorReserva
);

// POST /pagos/webhook — webhook de MP (público, sin auth)
router.post("/webhook", pagoController.webhook);

export default router;
