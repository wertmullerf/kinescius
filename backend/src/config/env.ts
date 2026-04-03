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
};
