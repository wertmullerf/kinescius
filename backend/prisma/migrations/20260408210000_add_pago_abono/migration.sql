-- CreateTable
CREATE TABLE "pagos_abono" (
    "id"             SERIAL NOT NULL,
    "clienteId"      INTEGER NOT NULL,
    "cantidadClases" INTEGER NOT NULL,
    "monto"          DECIMAL(10,2) NOT NULL,
    "metodo"         "MetodoPago" NOT NULL,
    "referencia"     TEXT,
    "mpPaymentId"    TEXT,
    "mpRawResponse"  JSONB,
    "createdAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "pagos_abono_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "pagos_abono" ADD CONSTRAINT "pagos_abono_clienteId_fkey"
    FOREIGN KEY ("clienteId") REFERENCES "usuarios"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;
