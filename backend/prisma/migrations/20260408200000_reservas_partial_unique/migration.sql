-- Reemplaza el unique total por un índice único parcial.
-- El constraint anterior bloqueaba crear una nueva reserva para la misma
-- (clienteId, instanciaId) si existía una reserva CANCELADA o COMPLETADA.
-- El nuevo índice solo aplica a reservas activas.

DROP INDEX IF EXISTS "reservas_clienteId_instanciaId_key";

CREATE UNIQUE INDEX "reservas_clienteId_instanciaId_activa_key"
  ON reservas("clienteId", "instanciaId")
  WHERE estado NOT IN ('CANCELADA', 'COMPLETADA');
