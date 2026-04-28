-- CreateEnum
CREATE TYPE "TipoMovimientoSaldo" AS ENUM ('ACREDITADO_CANCELACION_CLASE', 'ACREDITADO_CANCELACION_RESERVA', 'UTILIZADO_RESERVA', 'REVERTIDO_RECHAZO_PAGO', 'RECLAMADO');

-- AlterTable
ALTER TABLE "reservas" ADD COLUMN     "saldoUtilizado" DECIMAL(10,2) NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "usuarios" ADD COLUMN     "saldoFavor" DECIMAL(10,2) NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "movimientos_saldo" (
    "id" SERIAL NOT NULL,
    "clienteId" INTEGER NOT NULL,
    "monto" DECIMAL(10,2) NOT NULL,
    "tipo" "TipoMovimientoSaldo" NOT NULL,
    "descripcion" TEXT NOT NULL,
    "reservaId" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "movimientos_saldo_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "movimientos_saldo" ADD CONSTRAINT "movimientos_saldo_clienteId_fkey" FOREIGN KEY ("clienteId") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "movimientos_saldo" ADD CONSTRAINT "movimientos_saldo_reservaId_fkey" FOREIGN KEY ("reservaId") REFERENCES "reservas"("id") ON DELETE SET NULL ON UPDATE CASCADE;
