-- DropForeignKey
ALTER TABLE "clases_instancias" DROP CONSTRAINT "clases_instancias_recurrenteId_fkey";

-- AlterTable
ALTER TABLE "clases_instancias" ALTER COLUMN "recurrenteId" DROP NOT NULL;

-- AddForeignKey
ALTER TABLE "clases_instancias" ADD CONSTRAINT "clases_instancias_recurrenteId_fkey" FOREIGN KEY ("recurrenteId") REFERENCES "clases_recurrentes"("id") ON DELETE SET NULL ON UPDATE CASCADE;
