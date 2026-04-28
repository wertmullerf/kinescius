import { Router } from "express";
import { reportesController } from "./reportes.controller";
import { authenticateToken, authorizeRoles } from "../../middlewares/auth.middleware";

const router = Router();

router.get(
  "/dashboard",
  authenticateToken,
  authorizeRoles("ADMIN"),
  reportesController.getDashboard
);

export default router;
