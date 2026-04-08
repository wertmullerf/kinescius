-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "clases_instancias_fecha_profesorId_key" ON "clases_instancias"("fecha", "profesorId");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "clases_instancias_recurrenteId_fecha_key" ON "clases_instancias"("recurrenteId", "fecha");
