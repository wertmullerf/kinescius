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
    publicKey:    process.env.MP_PUBLIC_KEY    || "",
    webhookUrl:   process.env.MP_WEBHOOK_URL?.trim() || "",
    frontendUrl:  process.env.MP_FRONTEND_URL  || "http://localhost:5173",
    // Se deriva automáticamente del token: TEST- → sandbox, APP- → producción
    isSandbox:    (process.env.MP_ACCESS_TOKEN || "").startsWith("TEST-"),
  },
  mail: {
    user: process.env.MAIL_USER || "",
    pass: process.env.MAIL_PASS || "",  // contraseña de aplicación de Gmail (16 caracteres)
    from: process.env.MAIL_FROM || "",  // ej: "Kinescius <kinescius@gmail.com>"
  },
  cloudinary: {
    cloudName:  required("CLOUDINARY_CLOUD_NAME"),
    apiKey:     required("CLOUDINARY_API_KEY"),
    apiSecret:  required("CLOUDINARY_API_SECRET"),
  },
};
