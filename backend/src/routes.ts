import { Application } from "express";
import authRoutes from "./modules/auth/auth.routes";

// Aquí se registran todas las rutas de la API.
// Para agregar un módulo nuevo: importarlo y añadir un app.use abajo.
export function registerRoutes(app: Application): void {
  app.get("/health", (_req, res) => {
    res.json({ success: true, message: "Kinesius API funcionando", timestamp: new Date() });
  });

  app.use("/api/auth", authRoutes);

  // app.use("/api/clases", clasesRoutes);
  // app.use("/api/reservas", reservasRoutes);
  // app.use("/api/pagos", pagosRoutes);
  // app.use("/api/usuarios", usuariosRoutes);
  // app.use("/api/reportes", reportesRoutes);
}
