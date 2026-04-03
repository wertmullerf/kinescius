import express from "express";
import cors from "cors";
import { env } from "./config/env";
import { registerRoutes } from "./routes";
import { errorHandler } from "./middlewares/errorHandler";

const app = express();

app.use(cors());
app.use(express.json());

registerRoutes(app);

app.use(errorHandler);

app.listen(env.port, () => {
  console.log(`✓ Servidor corriendo en http://localhost:${env.port}`);
  console.log(`  Entorno: ${env.nodeEnv}`);
});

export default app;
