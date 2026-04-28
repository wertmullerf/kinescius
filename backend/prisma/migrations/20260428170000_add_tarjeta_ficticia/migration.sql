-- Agregar TARJETA al enum MetodoPago
ALTER TYPE "MetodoPago" ADD VALUE 'TARJETA';

-- Agregar enum TipoTarjeta
CREATE TYPE "TipoTarjeta" AS ENUM ('VISA', 'MASTERCARD', 'AMEX');

-- Agregar columna tarjetaUltimos4 a pagos
ALTER TABLE "pagos" ADD COLUMN "tarjetaUltimos4" TEXT;

-- Agregar columna tarjetaUltimos4 a pagos_abono
ALTER TABLE "pagos_abono" ADD COLUMN "tarjetaUltimos4" TEXT;

-- Crear tabla tarjetas_ficticias
CREATE TABLE "tarjetas_ficticias" (
    "id"              SERIAL NOT NULL,
    "numero"          TEXT NOT NULL,
    "cvv"             TEXT NOT NULL,
    "fechaExpiracion" TEXT NOT NULL,
    "titular"         TEXT NOT NULL,
    "tipo"            "TipoTarjeta" NOT NULL,
    "activa"          BOOLEAN NOT NULL DEFAULT true,
    "createdAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tarjetas_ficticias_pkey" PRIMARY KEY ("id")
);

-- Índice único en número de tarjeta
CREATE UNIQUE INDEX "tarjetas_ficticias_numero_key" ON "tarjetas_ficticias"("numero");

-- Seed: insertar 4 tarjetas ficticias
INSERT INTO "tarjetas_ficticias" ("numero", "cvv", "fechaExpiracion", "titular", "tipo") VALUES
  ('4111111111111111', '123', '12/28', 'Juan García',       'VISA'),
  ('5500000000000004', '456', '08/27', 'María López',       'MASTERCARD'),
  ('4012888888881881', '789', '03/29', 'Carlos Rodríguez',  'VISA'),
  ('371449635398431',  '9210', '11/26', 'Ana Martínez',     'AMEX');
