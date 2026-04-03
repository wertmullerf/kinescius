-- CreateEnum
CREATE TYPE "Rol" AS ENUM ('ADMIN', 'PROFESOR', 'CLIENTE');

-- CreateEnum
CREATE TYPE "TipoCliente" AS ENUM ('ABONADO', 'NO_ABONADO');

-- CreateEnum
CREATE TYPE "ZonaClase" AS ENUM ('ALTA', 'MEDIA', 'BAJA');

-- CreateEnum
CREATE TYPE "TipoClase" AS ENUM ('FIJA', 'ESPONTANEA');

-- CreateEnum
CREATE TYPE "EstadoReserva" AS ENUM ('PENDIENTE_PAGO', 'RESERVA_PAGA', 'CONFIRMADA', 'CANCELADA', 'COMPLETADA');

-- CreateEnum
CREATE TYPE "MetodoPago" AS ENUM ('EFECTIVO', 'TRANSFERENCIA');

-- CreateEnum
CREATE TYPE "TipoPago" AS ENUM ('SENA', 'COMPLEMENTO', 'ABONO');

-- CreateTable
CREATE TABLE "usuarios" (
    "id" SERIAL NOT NULL,
    "nombre" TEXT NOT NULL,
    "apellido" TEXT NOT NULL,
    "dni" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "rol" "Rol" NOT NULL,
    "tipoCliente" "TipoCliente",
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "usuarios_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "agendas_mensuales" (
    "id" SERIAL NOT NULL,
    "mes" INTEGER NOT NULL,
    "anio" INTEGER NOT NULL,

    CONSTRAINT "agendas_mensuales_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "clases" (
    "id" SERIAL NOT NULL,
    "zona" "ZonaClase" NOT NULL,
    "tipo" "TipoClase" NOT NULL,
    "fecha" TIMESTAMP(3),
    "horario" TIMESTAMP(3) NOT NULL,
    "cupoMaximo" INTEGER NOT NULL,
    "precio" DECIMAL(10,2) NOT NULL,
    "profesorId" INTEGER NOT NULL,
    "agendaId" INTEGER,
    "codigoQr" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "clases_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reservas" (
    "id" SERIAL NOT NULL,
    "estado" "EstadoReserva" NOT NULL DEFAULT 'PENDIENTE_PAGO',
    "montoPagado" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "clienteId" INTEGER NOT NULL,
    "claseId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "reservas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pagos" (
    "id" SERIAL NOT NULL,
    "monto" DECIMAL(10,2) NOT NULL,
    "metodo" "MetodoPago" NOT NULL,
    "tipo" "TipoPago" NOT NULL,
    "referencia" TEXT,
    "reservaId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "pagos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "asistencias" (
    "id" SERIAL NOT NULL,
    "presente" BOOLEAN NOT NULL DEFAULT false,
    "reservaId" INTEGER NOT NULL,
    "registradoPor" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "asistencias_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cola_espera" (
    "id" SERIAL NOT NULL,
    "posicion" INTEGER NOT NULL,
    "expiraEn" TIMESTAMP(3),
    "claseId" INTEGER NOT NULL,
    "clienteId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "cola_espera_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "usuarios_dni_key" ON "usuarios"("dni");

-- CreateIndex
CREATE UNIQUE INDEX "usuarios_email_key" ON "usuarios"("email");

-- CreateIndex
CREATE UNIQUE INDEX "agendas_mensuales_mes_anio_key" ON "agendas_mensuales"("mes", "anio");

-- CreateIndex
CREATE UNIQUE INDEX "clases_codigoQr_key" ON "clases"("codigoQr");

-- CreateIndex
CREATE UNIQUE INDEX "reservas_clienteId_claseId_key" ON "reservas"("clienteId", "claseId");

-- CreateIndex
CREATE UNIQUE INDEX "asistencias_reservaId_key" ON "asistencias"("reservaId");

-- CreateIndex
CREATE UNIQUE INDEX "cola_espera_claseId_clienteId_key" ON "cola_espera"("claseId", "clienteId");

-- CreateIndex
CREATE UNIQUE INDEX "cola_espera_claseId_posicion_key" ON "cola_espera"("claseId", "posicion");

-- AddForeignKey
ALTER TABLE "clases" ADD CONSTRAINT "clases_profesorId_fkey" FOREIGN KEY ("profesorId") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "clases" ADD CONSTRAINT "clases_agendaId_fkey" FOREIGN KEY ("agendaId") REFERENCES "agendas_mensuales"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reservas" ADD CONSTRAINT "reservas_clienteId_fkey" FOREIGN KEY ("clienteId") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reservas" ADD CONSTRAINT "reservas_claseId_fkey" FOREIGN KEY ("claseId") REFERENCES "clases"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pagos" ADD CONSTRAINT "pagos_reservaId_fkey" FOREIGN KEY ("reservaId") REFERENCES "reservas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "asistencias" ADD CONSTRAINT "asistencias_reservaId_fkey" FOREIGN KEY ("reservaId") REFERENCES "reservas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cola_espera" ADD CONSTRAINT "cola_espera_claseId_fkey" FOREIGN KEY ("claseId") REFERENCES "clases"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cola_espera" ADD CONSTRAINT "cola_espera_clienteId_fkey" FOREIGN KEY ("clienteId") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
