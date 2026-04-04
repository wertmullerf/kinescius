-- DropIndex
DROP INDEX "profesores_nombre_apellido_key";

-- AlterTable
ALTER TABLE "profesores" ADD COLUMN "dni" TEXT NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "profesores_dni_key" ON "profesores"("dni");
