import { Router } from "express";
import { authController } from "./auth.controller";
import { authenticateToken } from "../../middlewares/auth.middleware";
import { validate } from "../../middlewares/validate.middleware";
import { registerSchema, loginSchema } from "./auth.validations";

const router = Router();

// Rutas públicas
router.post("/register", validate(registerSchema), authController.register);
router.post("/login", validate(loginSchema), authController.login);

// Rutas protegidas (requieren JWT válido)
router.post("/logout", authenticateToken, authController.logout);
router.get("/me", authenticateToken, authController.me);

export default router;
