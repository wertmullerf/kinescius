import express from "express";
import cors from "cors";
import morgan from "morgan";
import { env } from "./config/env";
import { registerRoutes } from "./routes";
import { errorHandler } from "./middlewares/errorHandler";

// Registrar el cron job de limpieza (se activa al importar el módulo)
import "./jobs/limpiarExpiraciones";

const app = express();

app.use(cors());
app.use(express.json());
app.use(morgan("dev")); // log de requests: método, ruta, status, tiempo

registerRoutes(app);

app.use(errorHandler);

app.listen(env.port, () => {
  console.log(`✓ Servidor corriendo en http://localhost:${env.port}`);
  console.log(`  Entorno: ${env.nodeEnv}`);
});

export default app;
