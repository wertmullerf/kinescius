/*
  Warnings:

  - Made the column `tipoCliente` on table `usuarios` required. This step will fail if there are existing NULL values in that column.

*/
-- AlterTable
ALTER TABLE "usuarios" ALTER COLUMN "tipoCliente" SET NOT NULL,
ALTER COLUMN "tipoCliente" SET DEFAULT 'NO_ABONADO';
