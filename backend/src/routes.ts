import { Application } from "express";
import authRoutes         from "./modules/auth/auth.routes";
import profesoresRoutes   from "./modules/profesores/profesor.routes";
import agendaRoutes       from "./modules/agenda/agenda.routes";
import claseRoutes        from "./modules/clases/clase.routes";
import reservaRoutes      from "./modules/reservas/reserva.routes";
import pagosRoutes        from "./modules/pagos/pago.routes";
import colaRoutes         from "./modules/cola-espera/cola.routes";
import usuariosRoutes     from "./modules/usuarios/usuarios.routes";
import asistenciasRoutes  from "./modules/asistencias/asistencia.routes";

// Aquí se registran todas las rutas de la API.
// Para agregar un módulo nuevo: importarlo y añadir un app.use abajo.
export function registerRoutes(app: Application): void {
  app.get("/health", (_req, res) => {
    res.json({ success: true, message: "Kinesius API funcionando", timestamp: new Date() });
  });

  app.use("/api/auth",       authRoutes);
  app.use("/api/profesores", profesoresRoutes);
  app.use("/api/agenda",     agendaRoutes);

  // claseRoutes se monta en /api porque gestiona rutas anidadas bajo dos prefijos:
  //   /api/agenda/:agendaId/recurrentes  →  patrones recurrentes
  //   /api/agenda/:agendaId/instancias   →  instancias del mes
  //   /api/instancias/:id                →  editar / cancelar instancia
  //   /api/instancias/sueltas            →  clases sueltas
  // Express evalúa agendaRoutes primero; si no hay match (ej: GET /agenda/1/recurrentes),
  // la request cae aquí donde claseRoutes sí tiene el handler correcto.
  app.use("/api", claseRoutes);

  app.use("/api/reservas",     reservaRoutes);
  app.use("/api/pagos",        pagosRoutes);
  app.use("/api/cola-espera",  colaRoutes);
  app.use("/api/usuarios",     usuariosRoutes);
  app.use("/api/asistencias",  asistenciasRoutes);
}
