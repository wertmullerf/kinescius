import { PrismaClient, TipoClase, ZonaClase, EstadoReserva, MetodoPago, TipoPago } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

// Devuelve la fecha del próximo día de la semana indicado a la hora indicada.
// dayOfWeek: 0=Dom, 1=Lun, 2=Mar, 3=Mie, 4=Jue, 5=Vie, 6=Sab
function proximoDia(dayOfWeek: number, hour: number): Date {
  const ahora = new Date();
  const resultado = new Date(ahora);
  resultado.setHours(hour, 0, 0, 0);
  const diff = (dayOfWeek - ahora.getDay() + 7) % 7 || 7;
  resultado.setDate(ahora.getDate() + diff);
  return resultado;
}

async function main() {
  console.log("🌱 Iniciando seed...");

  // ─── 1. Limpiar tablas dependientes (orden inverso a las FK) ────
  // Esto hace que el seed sea idempotente: podés correrlo N veces sin duplicados
  await prisma.pago.deleteMany();
  await prisma.asistencia.deleteMany();
  await prisma.colaEspera.deleteMany();
  await prisma.reserva.deleteMany();
  await prisma.clase.deleteMany();
  await prisma.agendaMensual.deleteMany();
  // Usuarios y Profesores usan upsert más abajo, no se borran

  // ─── 2. Usuarios del sistema (upsert por email) ─────────────────

  const hashAdmin = await bcrypt.hash("admin1234", 10);
  const hashProfesor = await bcrypt.hash("profesor1234", 10);
  const hashCliente = await bcrypt.hash("cliente1234", 10);

  const admin = await prisma.usuario.upsert({
    where: { email: "laura@kinesius.com" },
    update: {},
    create: {
      nombre: "Laura",
      apellido: "Admin",
      dni: "20000001",
      email: "laura@kinesius.com",
      password: hashAdmin,
      rol: "ADMIN",
    },
  });

  // Cuenta compartida que usan todos los profesores para registrar asistencia
  await prisma.usuario.upsert({
    where: { email: "profesor@kinesius.com" },
    update: {},
    create: {
      nombre: "Profesor",
      apellido: "Kinesius",
      dni: "20000002",
      email: "profesor@kinesius.com",
      password: hashProfesor,
      rol: "PROFESOR",
    },
  });

  const carlos = await prisma.usuario.upsert({
    where: { email: "carlos@mail.com" },
    update: {},
    create: {
      nombre: "Carlos",
      apellido: "García",
      dni: "30111222",
      email: "carlos@mail.com",
      password: hashCliente,
      rol: "CLIENTE",
      tipoCliente: "ABONADO",
    },
  });

  const ana = await prisma.usuario.upsert({
    where: { email: "ana@mail.com" },
    update: {},
    create: {
      nombre: "Ana",
      apellido: "Martínez",
      dni: "32222333",
      email: "ana@mail.com",
      password: hashCliente,
      rol: "CLIENTE",
      tipoCliente: "ABONADO",
    },
  });

  const lucas = await prisma.usuario.upsert({
    where: { email: "lucas@mail.com" },
    update: {},
    create: {
      nombre: "Lucas",
      apellido: "Fernández",
      dni: "35333444",
      email: "lucas@mail.com",
      password: hashCliente,
      rol: "CLIENTE",
      tipoCliente: "NO_ABONADO",
    },
  });

  const sofia = await prisma.usuario.upsert({
    where: { email: "sofia@mail.com" },
    update: {},
    create: {
      nombre: "Sofía",
      apellido: "López",
      dni: "37444555",
      email: "sofia@mail.com",
      password: hashCliente,
      rol: "CLIENTE",
      tipoCliente: "NO_ABONADO",
    },
  });

  console.log("✓ Usuarios creados");

  // ─── 3. Profesores reales (tabla Profesor, upsert por nombre+apellido) ──

  const profJuan = await prisma.profesor.upsert({
    where: { nombre_apellido: { nombre: "Juan", apellido: "Pérez" } },
    update: {},
    create: { nombre: "Juan", apellido: "Pérez" },
  });

  const profMaria = await prisma.profesor.upsert({
    where: { nombre_apellido: { nombre: "María", apellido: "González" } },
    update: {},
    create: { nombre: "María", apellido: "González" },
  });

  const profCarlos = await prisma.profesor.upsert({
    where: { nombre_apellido: { nombre: "Carlos", apellido: "López" } },
    update: {},
    create: { nombre: "Carlos", apellido: "López" },
  });

  console.log("✓ Profesores creados");

  // ─── 4. Agenda mensual del mes actual ───────────────────────────

  const hoy = new Date();
  const agenda = await prisma.agendaMensual.create({
    data: { mes: hoy.getMonth() + 1, anio: hoy.getFullYear() },
  });

  // ─── 5. Clases fijas (6): 2 por zona, distintos días y horarios ─
  // Precios: ALTA $2000, MEDIA $1500, BAJA $1000

  const clasesFijas = await Promise.all([
    // ALTA
    prisma.clase.create({
      data: {
        zona: ZonaClase.ALTA,
        tipo: TipoClase.FIJA,
        horario: proximoDia(1, 8),  // Lunes 08:00
        cupoMaximo: 10,
        precio: 2000,
        profesorId: profJuan.id,
        agendaId: agenda.id,
      },
    }),
    prisma.clase.create({
      data: {
        zona: ZonaClase.ALTA,
        tipo: TipoClase.FIJA,
        horario: proximoDia(3, 9),  // Miércoles 09:00
        cupoMaximo: 10,
        precio: 2000,
        profesorId: profMaria.id,
        agendaId: agenda.id,
      },
    }),
    // MEDIA
    prisma.clase.create({
      data: {
        zona: ZonaClase.MEDIA,
        tipo: TipoClase.FIJA,
        horario: proximoDia(1, 10), // Lunes 10:00
        cupoMaximo: 10,
        precio: 1500,
        profesorId: profCarlos.id,
        agendaId: agenda.id,
      },
    }),
    prisma.clase.create({
      data: {
        zona: ZonaClase.MEDIA,
        tipo: TipoClase.FIJA,
        horario: proximoDia(5, 16), // Viernes 16:00
        cupoMaximo: 10,
        precio: 1500,
        profesorId: profJuan.id,
        agendaId: agenda.id,
      },
    }),
    // BAJA
    prisma.clase.create({
      data: {
        zona: ZonaClase.BAJA,
        tipo: TipoClase.FIJA,
        horario: proximoDia(3, 11), // Miércoles 11:00
        cupoMaximo: 10,
        precio: 1000,
        profesorId: profCarlos.id,
        agendaId: agenda.id,
      },
    }),
    prisma.clase.create({
      data: {
        zona: ZonaClase.BAJA,
        tipo: TipoClase.FIJA,
        horario: proximoDia(5, 18), // Viernes 18:00
        cupoMaximo: 10,
        precio: 1000,
        profesorId: profMaria.id,
        agendaId: agenda.id,
      },
    }),
  ]);

  // ─── 6. Clases espontáneas (2) ───────────────────────────────────

  await Promise.all([
    prisma.clase.create({
      data: {
        zona: ZonaClase.MEDIA,
        tipo: TipoClase.ESPONTANEA,
        fecha: proximoDia(2, 14),   // Martes 14:00
        horario: proximoDia(2, 14),
        cupoMaximo: 8,
        precio: 1500,
        profesorId: profJuan.id,
      },
    }),
    prisma.clase.create({
      data: {
        zona: ZonaClase.BAJA,
        tipo: TipoClase.ESPONTANEA,
        fecha: proximoDia(4, 17),   // Jueves 17:00
        horario: proximoDia(4, 17),
        cupoMaximo: 8,
        precio: 1000,
        profesorId: profMaria.id,
      },
    }),
  ]);

  console.log("✓ Clases creadas (6 fijas + 2 espontáneas)");

  // Referencias a las clases para las reservas
  const [claseAltaLun, claseAltaMie, claseMediaLun, , claseBajaLun] = clasesFijas;
  //      carlos        sofia         ana                  lucas

  // ─── 7. Reservas ────────────────────────────────────────────────

  const reservaCarlos = await prisma.reserva.create({
    data: {
      clienteId: carlos.id,
      claseId: claseAltaLun.id,
      estado: EstadoReserva.CONFIRMADA,
      montoPagado: 2000,
    },
  });

  const reservaAna = await prisma.reserva.create({
    data: {
      clienteId: ana.id,
      claseId: claseMediaLun.id,
      estado: EstadoReserva.CONFIRMADA,
      montoPagado: 1500,
    },
  });

  const reservaLucas = await prisma.reserva.create({
    data: {
      clienteId: lucas.id,
      claseId: claseBajaLun.id,
      estado: EstadoReserva.RESERVA_PAGA,
      montoPagado: 500, // 50% de $1000
    },
  });

  const reservaSofia = await prisma.reserva.create({
    data: {
      clienteId: sofia.id,
      claseId: claseAltaMie.id,
      estado: EstadoReserva.RESERVA_PAGA,
      montoPagado: 1000, // 50% de $2000
    },
  });

  console.log("✓ Reservas creadas");

  // ─── 8. Pagos ────────────────────────────────────────────────────

  await Promise.all([
    // Abonados: pagaron el total como ABONO
    prisma.pago.create({
      data: {
        reservaId: reservaCarlos.id,
        monto: 2000,
        metodo: MetodoPago.EFECTIVO,
        tipo: TipoPago.ABONO,
      },
    }),
    prisma.pago.create({
      data: {
        reservaId: reservaAna.id,
        monto: 1500,
        metodo: MetodoPago.EFECTIVO,
        tipo: TipoPago.ABONO,
      },
    }),
    // No abonados: pagaron el 50% como SEÑA
    prisma.pago.create({
      data: {
        reservaId: reservaLucas.id,
        monto: 500,
        metodo: MetodoPago.TRANSFERENCIA,
        tipo: TipoPago.SENA,
      },
    }),
    prisma.pago.create({
      data: {
        reservaId: reservaSofia.id,
        monto: 1000,
        metodo: MetodoPago.TRANSFERENCIA,
        tipo: TipoPago.SENA,
      },
    }),
  ]);

  console.log("✓ Pagos creados");
  console.log("\n✅ Seed completado exitosamente");
  console.log("\nUsuarios de prueba:");
  console.log("  ADMIN    → laura@kinesius.com      / admin1234");
  console.log("  PROFESOR → profesor@kinesius.com   / profesor1234");
  console.log("  CLIENTE  → carlos@mail.com         / cliente1234 (abonado)");
  console.log("  CLIENTE  → ana@mail.com            / cliente1234 (abonado)");
  console.log("  CLIENTE  → lucas@mail.com          / cliente1234 (no abonado)");
  console.log("  CLIENTE  → sofia@mail.com          / cliente1234 (no abonado)");
}

main()
  .catch((e) => {
    console.error("❌ Error en el seed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
