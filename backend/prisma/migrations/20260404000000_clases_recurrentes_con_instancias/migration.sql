-- DropForeignKey
ALTER TABLE "clases" DROP CONSTRAINT "clases_agendaId_fkey";

-- DropForeignKey
ALTER TABLE "clases" DROP CONSTRAINT "clases_profesorId_fkey";

-- DropForeignKey
ALTER TABLE "cola_espera" DROP CONSTRAINT "cola_espera_claseId_fkey";

-- DropForeignKey
ALTER TABLE "reservas" DROP CONSTRAINT "reservas_claseId_fkey";

-- DropIndex
DROP INDEX "cola_espera_claseId_clienteId_key";

-- DropIndex
DROP INDEX "cola_espera_claseId_posicion_key";

-- DropIndex
DROP INDEX "reservas_clienteId_claseId_key";

-- AlterTable
ALTER TABLE "cola_espera" DROP COLUMN "claseId",
ADD COLUMN     "instanciaId" INTEGER NOT NULL;

-- AlterTable
ALTER TABLE "reservas" DROP COLUMN "claseId",
ADD COLUMN     "instanciaId" INTEGER NOT NULL;

-- DropTable
DROP TABLE "clases";

-- DropEnum
DROP TYPE "TipoClase";

-- CreateTable
CREATE TABLE "clases_recurrentes" (
    "id" SERIAL NOT NULL,
    "diaSemana" INTEGER NOT NULL,
    "hora" TIMESTAMP(3) NOT NULL,
    "zona" "ZonaClase" NOT NULL,
    "cupoMaximo" INTEGER NOT NULL,
    "duracion" INTEGER NOT NULL DEFAULT 60,
    "precio" DECIMAL(10,2) NOT NULL,
    "profesorId" INTEGER NOT NULL,
    "agendaId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "clases_recurrentes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "clases_instancias" (
    "id" SERIAL NOT NULL,
    "fecha" TIMESTAMP(3) NOT NULL,
    "zona" "ZonaClase" NOT NULL,
    "cupoMaximo" INTEGER NOT NULL,
    "duracion" INTEGER NOT NULL DEFAULT 60,
    "precio" DECIMAL(10,2) NOT NULL,
    "codigoQr" TEXT NOT NULL,
    "esExcepcion" BOOLEAN NOT NULL DEFAULT false,
    "motivoExcepcion" TEXT,
    "profesorId" INTEGER NOT NULL,
    "recurrenteId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "clases_instancias_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "clases_instancias_codigoQr_key" ON "clases_instancias"("codigoQr");

-- CreateIndex
CREATE UNIQUE INDEX "cola_espera_instanciaId_clienteId_key" ON "cola_espera"("instanciaId", "clienteId");

-- CreateIndex
CREATE UNIQUE INDEX "cola_espera_instanciaId_posicion_key" ON "cola_espera"("instanciaId", "posicion");

-- CreateIndex
CREATE UNIQUE INDEX "reservas_clienteId_instanciaId_key" ON "reservas"("clienteId", "instanciaId");

CREATE UNIQUE INDEX "clases_instancias_recurrenteId_fecha_key" 
ON "clases_instancias"("recurrenteId", "fecha");

-- AddForeignKey
ALTER TABLE "clases_recurrentes" ADD CONSTRAINT "clases_recurrentes_profesorId_fkey" FOREIGN KEY ("profesorId") REFERENCES "profesores"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "clases_recurrentes" ADD CONSTRAINT "clases_recurrentes_agendaId_fkey" FOREIGN KEY ("agendaId") REFERENCES "agendas_mensuales"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "clases_instancias" ADD CONSTRAINT "clases_instancias_profesorId_fkey" FOREIGN KEY ("profesorId") REFERENCES "profesores"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "clases_instancias" ADD CONSTRAINT "clases_instancias_recurrenteId_fkey" FOREIGN KEY ("recurrenteId") REFERENCES "clases_recurrentes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reservas" ADD CONSTRAINT "reservas_instanciaId_fkey" FOREIGN KEY ("instanciaId") REFERENCES "clases_instancias"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cola_espera" ADD CONSTRAINT "cola_espera_instanciaId_fkey" FOREIGN KEY ("instanciaId") REFERENCES "clases_instancias"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
