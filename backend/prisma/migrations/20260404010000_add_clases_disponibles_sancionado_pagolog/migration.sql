-- AlterTable: agregar clasesDisponibles y sancionado a usuarios
ALTER TABLE "usuarios" ADD COLUMN "clasesDisponibles" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "usuarios" ADD COLUMN "sancionado" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable: pago_logs
CREATE TABLE "pago_logs" (
    "id" SERIAL NOT NULL,
    "pagoId" INTEGER NOT NULL,
    "evento" TEXT NOT NULL,
    "mpPaymentId" TEXT,
    "mpStatus" TEXT,
    "mpRawResponse" JSONB,
    "solicitadoPor" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "pago_logs_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "pago_logs" ADD CONSTRAINT "pago_logs_pagoId_fkey" FOREIGN KEY ("pagoId") REFERENCES "pagos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
