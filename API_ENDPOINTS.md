# Kinescius — Documentación completa de endpoints de la API

## Contexto general del sistema

**Kinescius** es el backend de un centro de kinesiología. Gestiona agendas de clases, reservas de clientes, pagos (efectivo, transferencia y Mercado Pago), cola de espera y registro de asistencia.

### Stack
- **Runtime:** Node.js + Express + TypeScript
- **ORM:** Prisma + PostgreSQL
- **Auth:** JWT (Bearer token en header `Authorization`)
- **Pagos:** Mercado Pago Checkout Pro (SDK oficial)
- **Emails:** Nodemailer + Gmail SMTP

### URL base
```
http://localhost:3000/api
```

### Formato de respuesta estándar
Todas las respuestas siguen esta estructura:
```json
{
  "success": true | false,
  "message": "texto descriptivo",
  "data": { ... } | null
}
```

---

## Autenticación

Todos los endpoints (salvo los marcados como **público**) requieren:
```
Authorization: Bearer <token>
```

### Roles del sistema
| Rol | Descripción |
|-----|-------------|
| `ADMIN` | Acceso total. Gestiona todo el sistema. 1 cuenta precargada. |
| `PROFESOR` | Puede escanear QR y registrar asistencia. 1 cuenta compartida. |
| `CLIENTE` | Clientes que se registran, reservan y pagan. |

---

## Módulo: Auth

### `POST /auth/register` — Público
Registra un nuevo cliente.

**Body:**
```json
{
  "nombre": "Juan",
  "apellido": "Pérez",
  "dni": "12345678",
  "email": "juan@email.com",
  "password": "miPassword123"
}
```

**Respuesta exitosa:** devuelve `{ token, user }`. El rol siempre es `CLIENTE`. No se puede registrar un `ADMIN` o `PROFESOR` por esta vía.

---

### `POST /auth/login` — Público
Inicia sesión. Devuelve un JWT.

**Body:**
```json
{
  "email": "juan@email.com",
  "password": "miPassword123"
}
```

**Respuesta exitosa:** `{ token, user: { id, nombre, apellido, email, rol, tipoCliente, clasesDisponibles, sancionado } }`

---

### `POST /auth/logout` — TODOS los roles
Invalida el token actual (lo agrega a una lista negra en memoria).

---

### `GET /auth/me` — TODOS los roles
Devuelve los datos del usuario autenticado.

---

## Módulo: Usuarios

> Todos los endpoints de este módulo son exclusivos de **ADMIN**.

### `GET /usuarios` — ADMIN
Lista todos los clientes con filtros opcionales.

**Query params:**
| Param | Tipo | Descripción |
|-------|------|-------------|
| `busqueda` | string | Busca por nombre, apellido, email o DNI (case insensitive) |
| `tipoCliente` | `ABONADO` \| `NO_ABONADO` | Filtra por tipo |
| `sancionado` | `true` \| `false` | Filtra sancionados |

---

### `GET /usuarios/:id` — ADMIN
Detalle de un usuario. Incluye sus últimas 20 reservas con instancia, pagos y asistencia.

---

### `PUT /usuarios/:id` — ADMIN
Edita datos de un usuario (nombre, apellido, DNI, email). Valida unicidad de DNI y email antes de actualizar.

**Body:**
```json
{
  "nombre": "Juan",
  "apellido": "Pérez",
  "dni": "12345678",
  "email": "juan@email.com"
}
```

---

### `DELETE /usuarios/:id` — ADMIN
Elimina un usuario. **Falla** si el usuario tiene reservas activas (`PENDIENTE_PAGO`, `RESERVA_PAGA`, `CONFIRMADA`).

---

## Módulo: Profesores

> Los profesores en esta tabla son los **kinesiólogos reales** del centro. No confundir con el rol `PROFESOR` del sistema de acceso. No tienen cuenta propia; se les asignan clases.

### `GET /profesores` — ADMIN, PROFESOR
Lista todos los profesores (kinesiólogos).

---

### `GET /profesores/:id` — ADMIN, PROFESOR
Detalle de un kinesiólogo.

---

### `POST /profesores` — ADMIN
Crea un kinesiólogo.

**Body:**
```json
{
  "nombre": "Carlos",
  "apellido": "López",
  "dni": "87654321"
}
```

---

### `PUT /profesores/:id` — ADMIN
Edita datos de un kinesiólogo.

---

### `DELETE /profesores/:id` — ADMIN
Elimina un kinesiólogo. Puede fallar si tiene clases asignadas.

---

## Módulo: Agenda

La **agenda mensual** agrupa los patrones de clases de un mes/año. Es el contenedor que se crea primero antes de definir clases recurrentes.

### `GET /agenda` — ADMIN, PROFESOR
Lista todas las agendas mensuales.

---

### `GET /agenda/:id` — ADMIN, PROFESOR
Detalle de una agenda con sus patrones recurrentes.

---

### `POST /agenda` — ADMIN
Crea una agenda mensual.

**Body:**
```json
{
  "mes": 4,
  "anio": 2026
}
```

No puede haber dos agendas para el mismo mes y año.

---

### `DELETE /agenda/:id` — ADMIN
Elimina una agenda. Elimina en cascada los patrones recurrentes asociados.

---

## Módulo: Clases (Patrones e Instancias)

### Clases recurrentes (patrones)

Los **patrones recurrentes** definen una clase que se repite cada semana: ej. "Lunes a las 10hs, zona BAJA, cupo 6, con el profesor López". A partir de cada patrón el sistema genera automáticamente las **instancias** (ocurrencias concretas con fecha y hora exacta) para cada semana del mes de la agenda.

#### `GET /agenda/:agendaId/recurrentes` — ADMIN, PROFESOR
Lista los patrones recurrentes de una agenda.

---

#### `POST /agenda/:agendaId/recurrentes` — ADMIN
Crea un patrón recurrente y **genera automáticamente** todas las instancias del mes correspondiente.

**Body:**
```json
{
  "diaSemana": 1,
  "hora": "10:00",
  "zona": "BAJA",
  "cupoMaximo": 6,
  "duracion": 60,
  "precio": 5000,
  "profesorId": 1
}
```

**Notas:**
- `diaSemana`: 0=domingo, 1=lunes, ..., 6=sábado
- `zona`: `ALTA` | `MEDIA` | `BAJA` (grupos musculares)
- `hora`: string `"HH:mm"`
- Al crear el patrón, se generan automáticamente las instancias para todas las semanas del mes de la agenda

---

#### `PUT /agenda/:agendaId/recurrentes/:id` — ADMIN
Edita un patrón recurrente. **No regenera** las instancias ya existentes; solo modifica el patrón para futuras referencias.

**Body:** mismos campos que POST, todos opcionales.

---

#### `DELETE /agenda/:agendaId/recurrentes/:id` — ADMIN
Elimina un patrón y sus instancias **futuras** (las que no tienen reservas). Las instancias pasadas o con reservas se conservan.

---

### Instancias concretas

Una **instancia** es una clase con fecha y hora exacta. Puede ser generada por un patrón recurrente o creada de forma suelta.

#### `GET /agenda/:agendaId/instancias` — ADMIN, PROFESOR, CLIENTE
Lista las instancias del mes de la agenda. Cada instancia incluye cupos disponibles, profesor asignado y conteo de reservas activas.

**Query params opcionales:**
| Param | Descripción |
|-------|-------------|
| `zona` | Filtra por zona muscular (`ALTA`, `MEDIA`, `BAJA`) |
| `fecha` | Filtra por fecha específica (`YYYY-MM-DD`) |

---

#### `POST /instancias/sueltas` — ADMIN
Crea una instancia suelta (no vinculada a ningún patrón recurrente). Útil para clases especiales o de reemplazo.

**Body:**
```json
{
  "fecha": "2026-04-15T10:00:00.000Z",
  "zona": "ALTA",
  "cupoMaximo": 5,
  "duracion": 60,
  "precio": 5000,
  "profesorId": 2
}
```

---

#### `DELETE /instancias/sueltas/:id` — ADMIN
Elimina una instancia suelta. Falla si tiene reservas activas.

---

#### `PATCH /instancias/:id` — ADMIN
Edita una instancia puntualmente (excepción). Útil para cambiar profesor por urgencia, ajustar cupo, etc.

**Body:** (todos opcionales)
```json
{
  "profesorId": 3,
  "cupoMaximo": 8,
  "precio": 5500,
  "esExcepcion": true,
  "motivoExcepcion": "Cambio de profesor por enfermedad"
}
```

Si `esExcepcion: true`, `motivoExcepcion` es **obligatorio**.

---

#### `PATCH /instancias/:id/cancelar` — ADMIN
Cancela una instancia completa. Cancela automáticamente todas las reservas activas asociadas y envía emails a los clientes afectados. Si corresponde, reembolsa las señas pagadas vía Mercado Pago.

---

## Módulo: Reservas

### Reglas de negocio críticas

**Tipos de cliente:**
- `ABONADO`: compró un abono de clases. Paga con saldo de clases disponibles. Descuento del 20% (salvo que esté sancionado). Al reservar se descuenta 1 clase del saldo.
- `NO_ABONADO`: paga una seña del 50% del precio vía Mercado Pago al reservar. El 50% restante lo paga presencial el día de la clase.

**Estados de reserva:**
| Estado | Descripción |
|--------|-------------|
| `PENDIENTE_PAGO` | No abonado que aún no pagó la seña |
| `RESERVA_PAGA` | No abonado que pagó la seña del 50% |
| `CONFIRMADA` | Reserva con pago completo (abonado con pack, o no abonado después del complemento) |
| `CANCELADA` | Reserva cancelada |
| `COMPLETADA` | Clase finalizada con asistencia registrada por el profesor |

**Política de cancelación:**
- **ABONADO con >48hs de anticipación:** se devuelve la clase al saldo. Sin sanción.
- **ABONADO con <48hs de anticipación:** no se devuelve la clase. El cliente queda `sancionado = true`. La sanción se levanta con el próximo abono. Mientras esté sancionado pierde el descuento del 20%.
- **NO ABONADO en PENDIENTE_PAGO:** cancelación sin cargo.
- **NO ABONADO en RESERVA_PAGA con >24hs:** reembolso total de la seña vía Mercado Pago.
- **NO ABONADO en RESERVA_PAGA con <24hs:** pierde la seña.

**Cola de espera:** si no hay cupo al intentar reservar, el cliente entra automáticamente a la cola. Cuando se libera un cupo, el primero de la cola recibe un email y tiene **5 horas** para confirmar la reserva (ventana de prioridad). Si otro usuario intenta reservar mientras la ventana está activa, va directo a la cola sin poder tomar ese cupo. Los ABONADO tienen prioridad en la cola sobre los NO_ABONADO.

---

### `POST /reservas` — CLIENTE
Crea una reserva en la instancia indicada.

**Body:**
```json
{
  "instanciaId": 12
}
```

**Respuestas posibles:**
- **Hay cupo y es ABONADO:** crea reserva `CONFIRMADA`, descuenta 1 clase, envía email de confirmación.
- **Hay cupo y es NO_ABONADO:** crea reserva `PENDIENTE_PAGO`, genera preferencia de Mercado Pago, devuelve `initPoint` y envía email con link de pago.
- **Sin cupo:** entra a la cola de espera automáticamente. Responde `{ posicionCola: N }`.

---

### `GET /reservas` — ADMIN, CLIENTE
Lista reservas. El ADMIN ve todas; el CLIENTE solo ve las propias.

---

### `GET /reservas/:id` — ADMIN, CLIENTE
Detalle de una reserva. El CLIENTE solo puede ver las propias.

Incluye: instancia con profesor, pagos con logs, asistencia.

---

### `PATCH /reservas/:id/cambiar` — CLIENTE
Cambia la reserva a otra instancia del **mismo día y misma zona muscular**, siempre que haya cupo disponible. No se une a cola.

**Reglas:**
- Solo reservas activas (`PENDIENTE_PAGO`, `RESERVA_PAGA`, `CONFIRMADA`)
- La clase destino debe tener cupo libre (no se une a cola si no hay)
- Misma `zona` (grupo muscular)
- Mismo día calendario
- **ABONADO:** no pierde ni gana clases (`clasesDisponibles` no cambia)
- **NO ABONADO:** la seña ya pagada queda asociada a la nueva clase automáticamente

**Body:**
```json
{
  "nuevaInstanciaId": 15
}
```

Envía email de confirmación con los datos de la nueva clase. Notifica a la cola de espera de la clase original (se liberó un cupo).

---

### `DELETE /reservas/:id` — ADMIN, CLIENTE
Cancela una reserva. El CLIENTE solo puede cancelar las propias.

Aplica la política de cancelación (ver reglas de negocio arriba). Notifica a la cola de espera de la instancia.

---

## Módulo: Pagos

### `POST /pagos/webhook` — Público (Mercado Pago)
Webhook para notificaciones de pago de Mercado Pago (formato nuevo).

**Body enviado por MP:**
```json
{
  "type": "payment",
  "action": "payment.created",
  "data": { "id": "12345678" }
}
```

Este endpoint **no requiere auth**. Es llamado directamente por los servidores de Mercado Pago. Maneja tanto señas de reserva como abonos de clases.

---

### `GET /pagos/webhook` — Público (Mercado Pago IPN)
Webhook para notificaciones IPN (formato legado de Mercado Pago).

**Query params enviados por MP:** `?topic=payment&id=PAYMENT_ID`

Este endpoint **no requiere auth**.

---

### Flujo de pago de seña (NO ABONADO)
1. Cliente crea reserva → backend genera preferencia MP y devuelve `initPoint`.
2. Cliente paga en el portal de MP.
3. MP llama al webhook (`POST` o `GET /pagos/webhook`).
4. Backend consulta el pago a MP, lo valida y actualiza la reserva a `RESERVA_PAGA`.
5. Se crea un registro en `Pago` con `tipo: "SENA"` y `metodo: "MERCADO_PAGO"`.
6. Se envía email de confirmación al cliente.

### Flujo de abono vía MP (CLIENTE)
1. Cliente llama a `POST /pagos/abono/mp` → backend calcula monto con descuento y genera preferencia MP.
2. Cliente paga en el portal de MP.
3. MP llama al webhook.
4. Backend acredita las clases, levanta sanción si existía, crea registro en `PagoAbono`.
5. Se envía email de confirmación con cantidad de clases y monto abonado.
6. El webhook es **idempotente**: si MP notifica dos veces, la segunda se ignora.

---

### `POST /pagos/abono` — ADMIN
El admin registra un abono presencial (efectivo o transferencia) para un cliente.

El backend calcula el monto automáticamente: `cantidadClases × precioPorClase`. Si el cliente **no está sancionado**, se aplica un **20% de descuento**. Si está sancionado, paga precio pleno.

**Body:**
```json
{
  "clienteId": 5,
  "cantidadClases": 10,
  "precioPorClase": 2000,
  "metodo": "EFECTIVO",
  "referencia": "Recibo #123"
}
```

**Efecto:**
- Suma `cantidadClases` al `clasesDisponibles` del cliente.
- Cambia `tipoCliente` a `ABONADO`.
- Levanta la sanción si existía (`sancionado = false`).
- Crea un registro en `PagoAbono` con el monto calculado.

---

### `POST /pagos/abono/mp` — CLIENTE
El cliente inicia un abono de clases vía Mercado Pago.

El backend calcula el monto con el mismo criterio: `cantidadClases × precioPorClase` con 20% de descuento si no está sancionado. El monto calculado es el que se cobra en MP; el cliente no puede modificarlo.

**Body:**
```json
{
  "cantidadClases": 5,
  "precioPorClase": 2000
}
```

**Respuesta:** `{ initPoint, external_reference, montoFinal, mpPrefId }`.

El pago se procesa automáticamente vía webhook. Cuando MP aprueba, el sistema acredita las clases y envía email de confirmación.

---

### `POST /pagos/complemento/:reservaId` — ADMIN
El admin registra el pago del saldo restante (50% complementario) de una reserva con seña pagada. Solo aplica a reservas en estado `RESERVA_PAGA`.

**Body:**
```json
{
  "metodo": "EFECTIVO",
  "referencia": "Efectivo cobrado en mostrador"
}
```

**Efecto:** cambia la reserva a `CONFIRMADA` y crea un registro en `Pago` con `tipo: "COMPLEMENTO"`.

> **Importante:** `COMPLETADA` es un estado exclusivo del módulo de asistencias. Una reserva pasa a `COMPLETADA` solo cuando el profesor registra la asistencia, no cuando se completa el pago.

---

### `GET /pagos/abonos/:clienteId` — ADMIN
Historial completo de abonos de un cliente (presenciales y vía MP), ordenado del más reciente al más antiguo.

Incluye: cantidad de clases, monto, método de pago, referencia, fecha.

---

### `GET /pagos/reserva/:reservaId` — ADMIN, CLIENTE
Lista todos los pagos de una reserva (seña y complemento). El CLIENTE solo puede ver los de sus propias reservas.

---

## Módulo: Cola de Espera

La cola se gestiona automáticamente cuando se intenta reservar sin cupo. Los ABONADO tienen prioridad sobre los NO_ABONADO dentro de la cola.

### `POST /cola-espera/:instanciaId` — CLIENTE
Une al cliente autenticado a la cola de espera de una instancia.

Si el cliente ya está en la cola, devuelve su posición actual sin duplicar.

---

### `DELETE /cola-espera/:instanciaId` — ADMIN, CLIENTE
Saca al cliente de la cola de espera de una instancia. Reordena automáticamente las posiciones del resto.
- **CLIENTE:** solo puede salir de su propia posición.
- **ADMIN:** puede sacar a cualquier cliente.

---

### `GET /cola-espera/:instanciaId` — ADMIN
Lista todos los clientes en la cola de espera de una instancia, ordenados por posición.

Cada entrada incluye: cliente (nombre, email, tipoCliente), posición, `expiraEn` (si tiene ventana de prioridad activa).

---

## Módulo: Asistencias

El flujo de asistencia es: el **profesor** escanea el QR del cartel de la clase → ve la lista de alumnos reservados → marca presentes/ausentes.

### `GET /asistencias/qr/:codigoQr` — PROFESOR, ADMIN
Carga la clase a partir del código QR único de la instancia. Devuelve la instancia con la lista completa de reservas en estado `CONFIRMADA` o `RESERVA_PAGA` y el estado de asistencia de cada alumno.

Cada `ClaseInstancia` tiene un campo `codigoQr` único generado automáticamente (cuid).

> **Nota:** una reserva puede llegar al día de la clase en estado `RESERVA_PAGA` si el admin no registró el complemento antes. El profesor puede marcar asistencia igualmente.

---

### `PATCH /asistencias/:reservaId` — PROFESOR, ADMIN
Registra o actualiza la asistencia de un alumno.

**Body:**
```json
{
  "presente": true
}
```

**Efecto:**
- Crea o actualiza un registro en `Asistencia` (upsert).
- Cambia el estado de la reserva a `COMPLETADA` (independientemente de si el alumno asistió o no).
- Registra el `id` del usuario que marcó la asistencia.

Solo acepta reservas en estado `CONFIRMADA` o `RESERVA_PAGA`.

---

### `GET /asistencias/clase/:instanciaId` — ADMIN
Vista completa de asistencia de una clase. Lista todas las reservas de la instancia con sus datos de asistencia (presente/ausente, quién registró, cuándo).

---

### `GET /asistencias/cliente/:clienteId` — ADMIN
Historial de asistencias de un cliente. Lista todas sus reservas completadas con el dato de si asistió o no.

---

## Endpoint de salud

### `GET /health` — Público
Verifica que la API está funcionando.

**Respuesta:**
```json
{
  "success": true,
  "message": "Kinesius API funcionando",
  "timestamp": "2026-04-08T12:00:00.000Z"
}
```

---

## Resumen de permisos por módulo

| Módulo | CLIENTE | PROFESOR | ADMIN |
|--------|---------|----------|-------|
| Auth (register/login) | ✅ | ✅ | ✅ |
| Usuarios | ❌ | ❌ | ✅ |
| Profesores (lectura) | ❌ | ✅ | ✅ |
| Profesores (escritura) | ❌ | ❌ | ✅ |
| Agenda | ❌ | ✅ (lectura) | ✅ |
| Patrones recurrentes | ❌ | ✅ (lectura) | ✅ |
| Instancias (listar) | ✅ | ✅ | ✅ |
| Instancias (crear/editar/cancelar) | ❌ | ❌ | ✅ |
| Reservas (propias) | ✅ | ❌ | ✅ |
| Cambio de clase | ✅ | ❌ | ❌ |
| Pagos (abono presencial/complemento) | ❌ | ❌ | ✅ |
| Pagos (historial de abonos) | ❌ | ❌ | ✅ |
| Pagos (abono MP) | ✅ | ❌ | ❌ |
| Cola de espera (unirse/salir) | ✅ | ❌ | ✅ |
| Cola de espera (ver) | ❌ | ❌ | ✅ |
| Asistencias (escanear QR/marcar) | ❌ | ✅ | ✅ |
| Asistencias (reportes) | ❌ | ❌ | ✅ |

---

## Modelos de datos relevantes (simplificado)

```
Usuario
  id, nombre, apellido, dni, email, password (bcrypt), rol (ADMIN|PROFESOR|CLIENTE)
  tipoCliente (ABONADO|NO_ABONADO), clasesDisponibles, sancionado

Profesor (kinesiólogos reales, sin cuenta de acceso individual)
  id, nombre, apellido, dni

AgendaMensual
  id, mes (1-12), anio
  → unique(mes, anio)

ClaseRecurrente (patrón semanal dentro de una agenda)
  id, diaSemana (0-6), hora, zona, cupoMaximo, duracion, precio
  → agendaId, profesorId

ClaseInstancia (ocurrencia concreta de una clase)
  id, fecha (datetime exacto), zona, cupoMaximo, duracion, precio
  codigoQr (único, generado automáticamente para QR de asistencia)
  esExcepcion, motivoExcepcion
  → profesorId, recurrenteId (null si es suelta)

Reserva
  id, estado (PENDIENTE_PAGO|RESERVA_PAGA|CONFIRMADA|CANCELADA|COMPLETADA)
  montoPagado, mpPrefId (id de preferencia MP mientras PENDIENTE_PAGO)
  → clienteId, instanciaId
  Índice único parcial: (clienteId, instanciaId) WHERE estado NOT IN ('CANCELADA','COMPLETADA')

Pago  (solo para pagos de reserva: seña y complemento)
  id, monto, metodo (EFECTIVO|TRANSFERENCIA|MERCADO_PAGO)
  tipo (SENA|COMPLEMENTO), referencia
  → reservaId (NOT NULL)

PagoAbono  (pagos de pack de clases; separado de Pago porque no tienen reservaId)
  id, cantidadClases, monto, metodo, referencia
  mpPaymentId, mpRawResponse
  → clienteId

PagoLog (auditoría de eventos de pago de reserva)
  id, evento (CREADO|APROBADO|REVERTIDO|FALLIDO|PENDIENTE)
  mpPaymentId, mpStatus, mpRawResponse, solicitadoPor
  → pagoId

Asistencia
  id, presente (bool), registradoPor (userId)
  → reservaId (unique: 1 asistencia por reserva)

ColaEspera
  id, posicion, expiraEn (datetime, ventana de 5hs para confirmar)
  → instanciaId, clienteId
  unique(instanciaId, clienteId), unique(instanciaId, posicion)
```

---

## Notas adicionales de implementación

- **ABONADOS tienen prioridad en la cola:** al unirse a la cola, los `ABONADO` obtienen posiciones menores que los `NO_ABONADO`. El reordenamiento es automático.
- **Ventana de prioridad de cola:** cuando se libera un cupo, el primero de la cola recibe un email ("¡Se liberó un lugar!") y su registro en `ColaEspera` recibe `expiraEn = now + 5hs`. Durante ese tiempo, nadie más puede tomar el cupo. El sistema verifica `colaEspera.expiraEn > now` al crear una reserva.
- **Reordenamiento de cola:** cuando alguien sale de la cola (manual o porque logró reservar), las posiciones del resto se decrementan automáticamente. Esto garantiza que `notificarPrimero` siempre encuentra a alguien en `posicion: 1`.
- **`tipoCliente` es gestionado por el sistema:** `clasesDisponibles > 0 → ABONADO`, `= 0 → NO_ABONADO`. No se edita manualmente.
- **Sanción:** `sancionado = true` implica que el ABONADO pierde el 20% de descuento tanto al reservar como al cargar el próximo abono. Se levanta automáticamente al cargar cualquier abono (presencial o MP).
- **Cálculo del monto de abono:** siempre es `cantidadClases × precioPorClase`. Si `sancionado = false`, se aplica 20% de descuento (`× 0.8`). El backend hace el cálculo; el frontend solo envía `cantidadClases` y `precioPorClase`.
- **Idempotencia del webhook de abono MP:** el sistema verifica si ya existe un `PagoAbono` con el mismo `mpPaymentId` antes de procesar. Si existe, ignora la notificación duplicada.
- **`COMPLETADA` solo lo setea asistencias:** el estado `COMPLETADA` en una reserva solo lo puede asignar el módulo de asistencias cuando el profesor marca la asistencia. El complemento de pago lleva la reserva a `CONFIRMADA`, no a `COMPLETADA`.
- **Partial unique index en Reservas:** la constraint `UNIQUE (clienteId, instanciaId)` solo aplica cuando el estado NO es `CANCELADA` ni `COMPLETADA`. Permite que un cliente vuelva a reservar la misma clase si su reserva anterior fue cancelada.
- **El `codigoQr` de cada instancia** es un `cuid` generado por Prisma al crear la instancia. Se usa para que el profesor escanee el QR en la clase y cargue la lista de asistencia.
- **Emails que dispara el sistema:**
  - Reserva confirmada (abonado reserva / no abonado paga seña vía MP)
  - Reserva pendiente de pago (no abonado, con link de MP)
  - Cambio de clase confirmado
  - Reserva cancelada con nota (cancelación con penalización)
  - Reembolso procesado (cancelación con devolución para no abonado)
  - Cupo liberado en cola de espera (con ventana de 5hs para confirmar)
  - Abono acreditado vía MP (con cantidad de clases y monto)
