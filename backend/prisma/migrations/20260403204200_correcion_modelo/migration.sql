-- DropForeignKey
ALTER TABLE "clases" DROP CONSTRAINT "clases_profesorId_fkey";

-- CreateTable
CREATE TABLE "profesores" (
    "id" SERIAL NOT NULL,
    "nombre" TEXT NOT NULL,
    "apellido" TEXT NOT NULL,

    CONSTRAINT "profesores_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "profesores_nombre_apellido_key" ON "profesores"("nombre", "apellido");

-- AddForeignKey
ALTER TABLE "clases" ADD CONSTRAINT "clases_profesorId_fkey" FOREIGN KEY ("profesorId") REFERENCES "profesores"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
