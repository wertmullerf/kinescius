/// <reference types="node" />
import {
  PrismaClient,
  ZonaClase,
  EstadoReserva,
  MetodoPago,
  TipoPago,
} from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

/**
 * Devuelve todas las fechas del mes indicado (mes: 1–12) cuyo día de semana
 * coincida con dayOfWeek (0=Dom … 6=Sab), con la hora tomada de `horaRef`.
 */
function fechasDelMes(anio: number, mes: number, dayOfWeek: number, horaRef: Date): Date[] {
  const fechas: Date[] = [];
  const totalDias = new Date(anio, mes, 0).getDate();

  for (let dia = 1; dia <= totalDias; dia++) {
    const d = new Date(anio, mes - 1, dia);
    if (d.getDay() === dayOfWeek) {
      d.setHours(horaRef.getHours(), horaRef.getMinutes(), 0, 0);
      fechas.push(d);
    }
  }
  return fechas;
}

/**
 * Devuelve la fecha del próximo día de la semana indicado a la hora indicada.
 * dayOfWeek: 0=Dom, 1=Lun … 6=Sab
 */
function proximoDia(dayOfWeek: number, hour: number): Date {
  const ahora = new Date();
  const d = new Date(ahora);
  d.setHours(hour, 0, 0, 0);
  const diff = (dayOfWeek - ahora.getDay() + 7) % 7 || 7;
  d.setDate(ahora.getDate() + diff);
  return d;
}

/** Fecha de referencia para almacenar solo la hora en ClaseRecurrente. */
function horaRef(hour: number): Date {
  const d = new Date(2000, 0, 1);
  d.setHours(hour, 0, 0, 0);
  return d;
}

async function main() {
  console.log("🌱 Iniciando seed...");

  // ─── 1. Limpiar tablas dependientes (orden inverso a FK) ────────
  console.log("  → Limpiando datos previos...");
  await prisma.pagoLog.deleteMany();
  await prisma.pago.deleteMany();
  await prisma.asistencia.deleteMany();
  await prisma.colaEspera.deleteMany();
  await prisma.reserva.deleteMany();
  await prisma.claseInstancia.deleteMany();
  await prisma.claseRecurrente.deleteMany();
  await prisma.agendaMensual.deleteMany();

  // ─── 2. Usuarios (upsert por email) ─────────────────────────────
  console.log("  → Creando usuarios...");

  const hashAdmin    = await bcrypt.hash("admin1234",    10);
  const hashProfesor = await bcrypt.hash("profesor1234", 10);
  const hashCliente  = await bcrypt.hash("cliente1234",  10);

  await prisma.usuario.upsert({
    where:  { email: "laura@kinesius.com" },
    update: {},
    create: {
      nombre: "Laura", apellido: "Admin", dni: "20000001",
      email: "laura@kinesius.com", password: hashAdmin, rol: "ADMIN",
    },
  });

  await prisma.usuario.upsert({
    where:  { email: "profesor@kinesius.com" },
    update: {},
    create: {
      nombre: "Profesor", apellido: "Kinesius", dni: "20000002",
      email: "profesor@kinesius.com", password: hashProfesor, rol: "PROFESOR",
    },
  });

  // ABONADO con clases disponibles
  const carlos = await prisma.usuario.upsert({
    where:  { email: "carlos@mail.com" },
    update: { clasesDisponibles: 5 },
    create: {
      nombre: "Carlos", apellido: "García", dni: "30111222",
      email: "carlos@mail.com", password: hashCliente,
      rol: "CLIENTE", tipoCliente: "ABONADO", clasesDisponibles: 5,
    },
  });

  const ana = await prisma.usuario.upsert({
    where:  { email: "ana@mail.com" },
    update: { clasesDisponibles: 3 },
    create: {
      nombre: "Ana", apellido: "Martínez", dni: "32222333",
      email: "ana@mail.com", password: hashCliente,
      rol: "CLIENTE", tipoCliente: "ABONADO", clasesDisponibles: 3,
    },
  });

  // NO_ABONADO sin clases disponibles
  const lucas = await prisma.usuario.upsert({
    where:  { email: "lucas@mail.com" },
    update: { clasesDisponibles: 0 },
    create: {
      nombre: "Lucas", apellido: "Fernández", dni: "35333444",
      email: "lucas@mail.com", password: hashCliente,
      rol: "CLIENTE", tipoCliente: "NO_ABONADO", clasesDisponibles: 0,
    },
  });

  const sofia = await prisma.usuario.upsert({
    where:  { email: "sofia@mail.com" },
    update: { clasesDisponibles: 0 },
    create: {
      nombre: "Sofía", apellido: "López", dni: "37444555",
      email: "sofia@mail.com", password: hashCliente,
      rol: "CLIENTE", tipoCliente: "NO_ABONADO", clasesDisponibles: 0,
    },
  });

  console.log("✓ Usuarios listos");

  // ─── 3. Profesores reales (upsert por dni) ──────────────────────
  console.log("  → Creando profesores...");

  const profJuan = await prisma.profesor.upsert({
    where:  { dni: "27100001" },
    update: {},
    create: { nombre: "Juan", apellido: "Pérez", dni: "27100001" },
  });

  const profMaria = await prisma.profesor.upsert({
    where:  { dni: "29200002" },
    update: {},
    create: { nombre: "María", apellido: "González", dni: "29200002" },
  });

  const profCarlos = await prisma.profesor.upsert({
    where:  { dni: "31300003" },
    update: {},
    create: { nombre: "Carlos", apellido: "López", dni: "31300003" },
  });

  console.log("✓ Profesores listos");

  // ─── 4. Agenda mensual ───────────────────────────────────────────
  console.log("  → Creando agenda mensual...");

  const hoy  = new Date();
  const mes  = hoy.getMonth() + 1;
  const anio = hoy.getFullYear();

  const agenda = await prisma.agendaMensual.upsert({
    where:  { mes_anio: { mes, anio } },
    update: {},
    create: { mes, anio },
  });

  console.log(`✓ Agenda ${mes}/${anio} lista`);

  // ─── 5. Patrones recurrentes ─────────────────────────────────────
  console.log("  → Creando patrones recurrentes...");

  const patrones = await Promise.all([
    prisma.claseRecurrente.create({
      data: {
        diaSemana: 1, hora: horaRef(8),   // Lunes 08:00
        zona: ZonaClase.ALTA,  cupoMaximo: 10, duracion: 60, precio: 2000,
        profesorId: profJuan.id, agendaId: agenda.id,
      },
    }),
    prisma.claseRecurrente.create({
      data: {
        diaSemana: 3, hora: horaRef(9),   // Miércoles 09:00
        zona: ZonaClase.ALTA,  cupoMaximo: 10, duracion: 60, precio: 2000,
        profesorId: profMaria.id, agendaId: agenda.id,
      },
    }),
    prisma.claseRecurrente.create({
      data: {
        diaSemana: 1, hora: horaRef(10),  // Lunes 10:00
        zona: ZonaClase.MEDIA, cupoMaximo: 10, duracion: 60, precio: 1500,
        profesorId: profCarlos.id, agendaId: agenda.id,
      },
    }),
    prisma.claseRecurrente.create({
      data: {
        diaSemana: 5, hora: horaRef(16),  // Viernes 16:00
        zona: ZonaClase.MEDIA, cupoMaximo: 10, duracion: 60, precio: 1500,
        profesorId: profJuan.id, agendaId: agenda.id,
      },
    }),
    prisma.claseRecurrente.create({
      data: {
        diaSemana: 3, hora: horaRef(11),  // Miércoles 11:00
        zona: ZonaClase.BAJA,  cupoMaximo: 10, duracion: 60, precio: 1000,
        profesorId: profCarlos.id, agendaId: agenda.id,
      },
    }),
    prisma.claseRecurrente.create({
      data: {
        diaSemana: 5, hora: horaRef(18),  // Viernes 18:00
        zona: ZonaClase.BAJA,  cupoMaximo: 10, duracion: 60, precio: 1000,
        profesorId: profMaria.id, agendaId: agenda.id,
      },
    }),
  ]);

  // patrones[0] = Lunes 08:00    ALTA  Juan
  // patrones[1] = Miércoles 09:00 ALTA  María
  // patrones[2] = Lunes 10:00    MEDIA Carlos
  // patrones[3] = Viernes 16:00  MEDIA Juan
  // patrones[4] = Miércoles 11:00 BAJA  Carlos
  // patrones[5] = Viernes 18:00  BAJA  María

  console.log(`✓ ${patrones.length} patrones recurrentes creados`);

  // ─── 6. Instancias del mes (generadas desde patrones) ───────────
  console.log("  → Generando instancias del mes...");

  let totalInstancias = 0;
  let saltadas = 0;
  const primeraInstancia: Record<number, number> = {};

  for (const patron of patrones) {
    const fechas = fechasDelMes(anio, mes, patron.diaSemana, patron.hora);

    for (const fecha of fechas) {
      try {
        const inst = await prisma.claseInstancia.create({
          data: {
            fecha,
            zona:         patron.zona,
            cupoMaximo:   patron.cupoMaximo,
            duracion:     patron.duracion,
            precio:       patron.precio,
            profesorId:   patron.profesorId,
            recurrenteId: patron.id,
            esExcepcion:  false,
          },
        });
        totalInstancias++;
        if (!(patron.id in primeraInstancia)) {
          primeraInstancia[patron.id] = inst.id;
        }
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e);
        if (msg.includes("Unique constraint")) {
          console.warn(
            `    ⚠ Conflicto saltado: profesor ${patron.profesorId} el ${fecha.toLocaleDateString()}`
          );
          saltadas++;
        } else {
          throw new Error(`Paso 6 — fallo al crear instancia del patrón ${patron.id}: ${msg}`);
        }
      }
    }
  }

  console.log(`✓ ${totalInstancias} instancias del mes creadas (${saltadas} saltadas por conflicto)`);

  // ─── 7. Instancias sueltas (sin patrón recurrente) ──────────────
  console.log("  → Creando instancias sueltas...");

  await Promise.all([
    prisma.claseInstancia.create({
      data: {
        fecha:        proximoDia(2, 14),  // Próximo martes 14:00
        zona:         ZonaClase.MEDIA,
        cupoMaximo:   8,
        duracion:     60,
        precio:       1500,
        profesorId:   profJuan.id,
        recurrenteId: null,
        esExcepcion:  false,
      },
    }),
    prisma.claseInstancia.create({
      data: {
        fecha:        proximoDia(4, 17),  // Próximo jueves 17:00
        zona:         ZonaClase.BAJA,
        cupoMaximo:   8,
        duracion:     60,
        precio:       1000,
        profesorId:   profMaria.id,
        recurrenteId: null,
        esExcepcion:  false,
      },
    }),
  ]);

  console.log("✓ 2 instancias sueltas creadas");

  // ─── 8. Reservas ────────────────────────────────────────────────
  console.log("  → Creando reservas...");

  const instIdAltaLun  = primeraInstancia[patrones[0].id]; // Lunes 08:00 ALTA
  const instIdAltaMie  = primeraInstancia[patrones[1].id]; // Miércoles 09:00 ALTA
  const instIdMediaLun = primeraInstancia[patrones[2].id]; // Lunes 10:00 MEDIA
  const instIdBajaMie  = primeraInstancia[patrones[4].id]; // Miércoles 11:00 BAJA

  if (!instIdAltaLun || !instIdAltaMie || !instIdMediaLun || !instIdBajaMie) {
    throw new Error(
      "Paso 8 — no hay instancias disponibles para alguna reserva. " +
      "El mes actual puede no tener el día de la semana requerido."
    );
  }

  const reservaCarlos = await prisma.reserva.create({
    data: { clienteId: carlos.id, instanciaId: instIdAltaLun,  estado: EstadoReserva.CONFIRMADA,   montoPagado: 1600 }, // 20% desc
  });
  const reservaAna = await prisma.reserva.create({
    data: { clienteId: ana.id,    instanciaId: instIdMediaLun, estado: EstadoReserva.CONFIRMADA,   montoPagado: 1200 }, // 20% desc
  });
  const reservaLucas = await prisma.reserva.create({
    data: { clienteId: lucas.id,  instanciaId: instIdBajaMie,  estado: EstadoReserva.RESERVA_PAGA, montoPagado: 500  },
  });
  const reservaSofia = await prisma.reserva.create({
    data: { clienteId: sofia.id,  instanciaId: instIdAltaMie,  estado: EstadoReserva.RESERVA_PAGA, montoPagado: 1000 },
  });

  console.log("✓ Reservas creadas");

  // ─── 9. Pagos ────────────────────────────────────────────────────
  console.log("  → Creando pagos...");

  const pagoCarlos = await prisma.pago.create({
    data: { reservaId: reservaCarlos.id, monto: 1600, metodo: MetodoPago.EFECTIVO,      tipo: TipoPago.ABONO },
  });
  const pagoAna = await prisma.pago.create({
    data: { reservaId: reservaAna.id,    monto: 1200, metodo: MetodoPago.EFECTIVO,      tipo: TipoPago.ABONO },
  });
  const pagoLucas = await prisma.pago.create({
    data: { reservaId: reservaLucas.id,  monto: 500,  metodo: MetodoPago.TRANSFERENCIA, tipo: TipoPago.SENA  },
  });
  const pagoSofia = await prisma.pago.create({
    data: { reservaId: reservaSofia.id,  monto: 1000, metodo: MetodoPago.TRANSFERENCIA, tipo: TipoPago.SENA  },
  });

  console.log("✓ Pagos creados");

  // ─── 10. PagoLogs ────────────────────────────────────────────────
  console.log("  → Creando pago logs...");

  await Promise.all([
    prisma.pagoLog.create({ data: { pagoId: pagoCarlos.id, evento: "CREADO",   solicitadoPor: carlos.id } }),
    prisma.pagoLog.create({ data: { pagoId: pagoAna.id,    evento: "CREADO",   solicitadoPor: ana.id    } }),
    prisma.pagoLog.create({ data: { pagoId: pagoLucas.id,  evento: "APROBADO", mpPaymentId: "mp_test_lucas_001", mpStatus: "approved" } }),
    prisma.pagoLog.create({ data: { pagoId: pagoSofia.id,  evento: "APROBADO", mpPaymentId: "mp_test_sofia_001", mpStatus: "approved" } }),
  ]);

  console.log("✓ PagoLogs creados");

  // ─── Resumen ─────────────────────────────────────────────────────
  console.log(`
✅ Seed completado exitosamente
   Agenda:               ${mes}/${anio}
   Patrones recurrentes:  ${patrones.length}
   Instancias del mes:    ${totalInstancias} (${saltadas} saltadas por conflicto)
   Instancias sueltas:    2
   Reservas:              4
   Pagos:                 4
   PagoLogs:              4

Usuarios de prueba:
  ADMIN    → laura@kinesius.com      / admin1234
  PROFESOR → profesor@kinesius.com   / profesor1234
  CLIENTE  → carlos@mail.com         / cliente1234  (abonado, 5 clases disponibles)
  CLIENTE  → ana@mail.com            / cliente1234  (abonado, 3 clases disponibles)
  CLIENTE  → lucas@mail.com          / cliente1234  (no abonado)
  CLIENTE  → sofia@mail.com          / cliente1234  (no abonado)
`);
}

main()
  .catch((e) => {
    console.error("❌ Error en el seed:", e instanceof Error ? e.message : e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
