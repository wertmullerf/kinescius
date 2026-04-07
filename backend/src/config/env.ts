import dotenv from "dotenv";

dotenv.config();

// Centraliza todas las variables de entorno.
// Si falta alguna obligatoria, la app lanza un error al arrancar
// en lugar de fallar silenciosamente más tarde.
function required(key: string): string {
  const value = process.env[key];
  if (!value) {
    throw new Error(`Variable de entorno requerida no definida: ${key}`);
  }
  return value;
}

export const env = {
  port: Number(process.env.PORT) || 3000,
  nodeEnv: process.env.NODE_ENV || "development",
  databaseUrl: required("DATABASE_URL"),
  jwt: {
    secret: required("JWT_SECRET"),
    expiresIn: process.env.JWT_EXPIRES_IN || "7d",
  },
  mp: {
    accessToken:  process.env.MP_ACCESS_TOKEN  || "",
    webhookSecret: process.env.MP_WEBHOOK_SECRET || "",
    webhookUrl:   process.env.MP_WEBHOOK_URL   || "",
    successUrl:   process.env.MP_SUCCESS_URL   || "",
    failureUrl:   process.env.MP_FAILURE_URL   || "",
    pendingUrl:   process.env.MP_PENDING_URL   || "",
  },
  resend: {
    apiKey:    process.env.RESEND_API_KEY    || "",
    fromEmail: process.env.RESEND_FROM_EMAIL || "Kinesius <noreply@kinesius.com>",
  },
};
