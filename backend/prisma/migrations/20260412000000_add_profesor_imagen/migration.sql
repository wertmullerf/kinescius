-- AlterTable: añade la URL de imagen al profesor (nullable, se carga desde Cloudinary)
ALTER TABLE "profesores" ADD COLUMN "imagenUrl" TEXT;
