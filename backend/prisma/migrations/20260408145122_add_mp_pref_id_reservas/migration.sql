-- AlterEnum
ALTER TYPE "MetodoPago" ADD VALUE 'MERCADO_PAGO';

-- AlterTable
ALTER TABLE "reservas" ADD COLUMN "mpPrefId" TEXT;
