-- AlterTable
ALTER TABLE "usuarios" ADD COLUMN     "twoFactorCode" TEXT,
ADD COLUMN     "twoFactorExpires" TIMESTAMP(3);
