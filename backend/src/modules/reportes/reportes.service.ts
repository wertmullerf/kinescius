import { prisma } from "../../db/prisma";
import { ZonaClase } from "../../types/models";

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Calcula los rangos de fechas necesarios para el dashboard (todos en UTC). */
function calcularFechas() {
  const ahora = new Date();
  const inicioMesActual   = new Date(Date.UTC(ahora.getUTCFullYear(), ahora.getUTCMonth(), 1));
  const inicioMesAnterior = new Date(Date.UTC(ahora.getUTCFullYear(), ahora.getUTCMonth() - 1, 1));
  const finMesAnterior    = inicioMesActual;
  const inicioDia         = new Date(Date.UTC(ahora.getUTCFullYear(), ahora.getUTCMonth(), ahora.getUTCDate()));
  const finDia            = new Date(Date.UTC(ahora.getUTCFullYear(), ahora.getUTCMonth(), ahora.getUTCDate() + 1));
  return { ahora, inicioMesActual, inicioMesAnterior, finMesAnterior, inicioDia, finDia };
}

/** Convierte un Decimal de Prisma (o null/undefined) a number de forma segura. */
function toNum(value: unknown): number {
  if (value === null || value === undefined) return 0;
  return Number(value);
}

/** Formatea la hora de una fecha UTC como "HH:MM". */
function formatHoraUtc(fecha: Date): string {
  return `${fecha.getUTCHours().toString().padStart(2, "0")}:${fecha.getUTCMinutes().toString().padStart(2, "0")}`;
}

/**
 * Filtro Prisma para excluir clases canceladas.
 * motivoExcepcion es nullable, por eso se necesita el OR explícito:
 * en SQL, NULL != 'CANCELADA' evalúa a NULL (no TRUE).
 * Se define como función (no constante) para evitar problemas de readonly con `as const`.
 */
function noEsCancelada() {
  return {
    OR: [
      { motivoExcepcion: null as null | string },
      { motivoExcepcion: { not: "CANCELADA" } },
    ],
  };
}

// ── Tipos de respuesta ────────────────────────────────────────────────────────

export interface DashboardStats {
  clientesActivos:          number;
  clientesAbonados:         number;
  clientesSancionados:      number;
  ingresosMesActual:        number;
  ingresosMesAnterior:      number;
  complementosPendientes:   number;
  reservasPendientesPago:   number;
  clasesHoy: Array<{
    id:              number;
    hora:            string;
    zona:            ZonaClase;
    profesor:        string;
    cupoMaximo:      number;
    reservasActivas: number;
    enCola:          number;
  }>;
  actividadReciente: Array<{
    tipo:        "RESERVA" | "PAGO" | "CANCELACION" | "ABONO";
    descripcion: string;
    cliente:     string;
    fecha:       string;
    monto?:      number;
  }>;
  asistenciaPorDia:      Array<{ dia: string; reservas: number }>;
  popularidadPorZona:    Array<{ zona: ZonaClase; reservas: number; porcentaje: number }>;
  clasesConCupoCompleto: number;
  tasaCancelacion:       number;
}

// ── Servicio ──────────────────────────────────────────────────────────────────

export const reportesService = {

  async getDashboard(): Promise<DashboardStats> {
    const { ahora, inicioMesActual, inicioMesAnterior, finMesAnterior, inicioDia, finDia } =
      calcularFechas();

    // ── CARDS: todas las métricas en paralelo ─────────────────────────────────

    const [
      clientesActivos,
      clientesAbonados,
      clientesSancionados,
      pagosActualAgg,
      pagosAnteriorAgg,
      abonosActualAgg,
      abonosAnteriorAgg,
      complementosPendientes,
      reservasPendientesPago,
    ] = await Promise.all([
      prisma.usuario.count({ where: { rol: "CLIENTE" } }),
      prisma.usuario.count({ where: { rol: "CLIENTE", tipoCliente: "ABONADO" } }),
      prisma.usuario.count({ where: { rol: "CLIENTE", sancionado: true } }),

      prisma.pago.aggregate({
        _sum: { monto: true },
        where: { createdAt: { gte: inicioMesActual, lt: ahora } },
      }),
      prisma.pago.aggregate({
        _sum: { monto: true },
        where: { createdAt: { gte: inicioMesAnterior, lt: finMesAnterior } },
      }),
      prisma.pagoAbono.aggregate({
        _sum: { monto: true },
        where: { createdAt: { gte: inicioMesActual, lt: ahora } },
      }),
      prisma.pagoAbono.aggregate({
        _sum: { monto: true },
        where: { createdAt: { gte: inicioMesAnterior, lt: finMesAnterior } },
      }),

      // Seña pagada → esperando complemento presencial
      prisma.reserva.count({ where: { estado: "RESERVA_PAGA" } }),
      // Reservada pero sin seña todavía
      prisma.reserva.count({ where: { estado: "PENDIENTE_PAGO" } }),
    ]);

    const ingresosMesActual   = toNum(pagosActualAgg._sum.monto)   + toNum(abonosActualAgg._sum.monto);
    const ingresosMesAnterior = toNum(pagosAnteriorAgg._sum.monto) + toNum(abonosAnteriorAgg._sum.monto);

    // ── CLASES HOY ─────────────────────────────────────────────────────────────
    // Se usa `include` (no `select`) para que Prisma incluya las relaciones
    // y el campo virtual _count con filtros en el conteo.

    const instanciasHoy = await prisma.claseInstancia.findMany({
      where: {
        fecha: { gte: inicioDia, lt: finDia },
        ...noEsCancelada(),
      },
      include: {
        profesor: { select: { nombre: true, apellido: true } },
        _count: {
          select: {
            reservas:    { where: { estado: { in: ["PENDIENTE_PAGO", "RESERVA_PAGA", "CONFIRMADA"] } } },
            colasEspera: true,
          },
        },
      },
      orderBy: { fecha: "asc" },
    });

    const clasesHoy = instanciasHoy.map((inst) => ({
      id:              inst.id,
      hora:            formatHoraUtc(inst.fecha),
      zona:            inst.zona,
      profesor:        `${inst.profesor.nombre} ${inst.profesor.apellido}`,
      cupoMaximo:      inst.cupoMaximo,
      reservasActivas: inst._count.reservas,
      enCola:          inst._count.colasEspera,
    }));

    // ── ACTIVIDAD RECIENTE ─────────────────────────────────────────────────────

    const [reservasCreadas, reservasCanceladas, pagosLogs, abonosRecientes] = await Promise.all([
      prisma.reserva.findMany({
        where:   { estado: { not: "CANCELADA" } },
        select: {
          createdAt: true,
          instancia: { select: { zona: true } },
          cliente:   { select: { nombre: true, apellido: true } },
        },
        orderBy: { createdAt: "desc" },
        take:    8,
      }),

      prisma.reserva.findMany({
        where:   { estado: "CANCELADA" },
        select: {
          updatedAt: true,
          instancia: { select: { zona: true } },
          cliente:   { select: { nombre: true, apellido: true } },
        },
        orderBy: { updatedAt: "desc" },
        take:    8,
      }),

      prisma.pagoLog.findMany({
        where:   { evento: "APROBADO" },
        select: {
          createdAt: true,
          pago: {
            select: {
              monto:   true,
              reserva: { select: { cliente: { select: { nombre: true, apellido: true } } } },
            },
          },
        },
        orderBy: { createdAt: "desc" },
        take:    8,
      }),

      prisma.pagoAbono.findMany({
        select: {
          monto:     true,
          createdAt: true,
          cliente:   { select: { nombre: true, apellido: true } },
        },
        orderBy: { createdAt: "desc" },
        take:    8,
      }),
    ]);

    type RawItem = {
      tipo:        "RESERVA" | "PAGO" | "CANCELACION" | "ABONO";
      descripcion: string;
      cliente:     string;
      timestamp:   Date;
      monto?:      number;
    };

    const rawItems: RawItem[] = [
      ...reservasCreadas.map((r) => ({
        tipo:        "RESERVA"     as const,
        descripcion: `${r.cliente.nombre} ${r.cliente.apellido} reservó Zona ${r.instancia.zona}`,
        cliente:     `${r.cliente.nombre} ${r.cliente.apellido}`,
        timestamp:   r.createdAt,
      })),
      ...reservasCanceladas.map((r) => ({
        tipo:        "CANCELACION" as const,
        descripcion: `${r.cliente.nombre} ${r.cliente.apellido} canceló su reserva de Zona ${r.instancia.zona}`,
        cliente:     `${r.cliente.nombre} ${r.cliente.apellido}`,
        timestamp:   r.updatedAt,
      })),
      ...pagosLogs.map((pl) => ({
        tipo:        "PAGO"        as const,
        descripcion: `${pl.pago.reserva.cliente.nombre} ${pl.pago.reserva.cliente.apellido} pagó una clase`,
        cliente:     `${pl.pago.reserva.cliente.nombre} ${pl.pago.reserva.cliente.apellido}`,
        timestamp:   pl.createdAt,
        monto:       toNum(pl.pago.monto),
      })),
      ...abonosRecientes.map((a) => ({
        tipo:        "ABONO"       as const,
        descripcion: `${a.cliente.nombre} ${a.cliente.apellido} adquirió un abono`,
        cliente:     `${a.cliente.nombre} ${a.cliente.apellido}`,
        timestamp:   a.createdAt,
        monto:       toNum(a.monto),
      })),
    ];

    const actividadReciente = rawItems
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
      .slice(0, 8)
      .map(({ timestamp, ...rest }) => ({ ...rest, fecha: timestamp.toISOString() }));

    // ── ESTADÍSTICAS DEL MES ───────────────────────────────────────────────────

    // Instancias del mes con _count de reservas activas.
    // Se usa `include` para que el _count con filtro sea reconocido por TypeScript.
    const instanciasMes = await prisma.claseInstancia.findMany({
      where: {
        fecha: { gte: inicioMesActual, lt: ahora },
        ...noEsCancelada(),
      },
      include: {
        _count: {
          select: {
            reservas: { where: { estado: { in: ["PENDIENTE_PAGO", "RESERVA_PAGA", "CONFIRMADA"] } } },
          },
        },
      },
    });

    const diasData: Record<number, { total: number; count: number }> = {};
    for (let i = 0; i < 7; i++) diasData[i] = { total: 0, count: 0 };
    let clasesConCupoCompleto = 0;

    for (const inst of instanciasMes) {
      const diaSemana = inst.fecha.getUTCDay();
      diasData[diaSemana].total += inst._count.reservas;
      diasData[diaSemana].count += 1;
      if (inst._count.reservas >= inst.cupoMaximo) clasesConCupoCompleto++;
    }

    const nombresDias = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];
    const asistenciaPorDia = [1, 2, 3, 4, 5, 6, 0].map((dia) => ({
      dia:      nombresDias[dia],
      reservas: diasData[dia].count > 0
        ? Math.round(diasData[dia].total / diasData[dia].count)
        : 0,
    }));

    // Popularidad por zona
    const reservasPorZona = await prisma.reserva.findMany({
      where: {
        instancia: { fecha: { gte: inicioMesActual, lt: ahora } },
        estado:    { in: ["PENDIENTE_PAGO", "RESERVA_PAGA", "CONFIRMADA"] },
      },
      select: { instancia: { select: { zona: true } } },
    });

    const zonaCount: Record<ZonaClase, number> = { ALTA: 0, MEDIA: 0, BAJA: 0 };
    for (const r of reservasPorZona) zonaCount[r.instancia.zona]++;

    const totalZona = Object.values(zonaCount).reduce((a, b) => a + b, 0);
    const popularidadPorZona = (Object.entries(zonaCount) as [ZonaClase, number][]).map(
      ([zona, reservas]) => ({
        zona,
        reservas,
        porcentaje: totalZona > 0 ? Number(((reservas / totalZona) * 100).toFixed(1)) : 0,
      })
    );

    // Tasa de cancelación del mes actual
    const [totalReservasMes, canceladasMes] = await Promise.all([
      prisma.reserva.count({ where: { createdAt: { gte: inicioMesActual, lt: ahora } } }),
      prisma.reserva.count({
        where: { createdAt: { gte: inicioMesActual, lt: ahora }, estado: "CANCELADA" },
      }),
    ]);
    const tasaCancelacion = totalReservasMes > 0
      ? Number(((canceladasMes / totalReservasMes) * 100).toFixed(1))
      : 0;

    return {
      clientesActivos,
      clientesAbonados,
      clientesSancionados,
      ingresosMesActual,
      ingresosMesAnterior,
      complementosPendientes,
      reservasPendientesPago,
      clasesHoy,
      actividadReciente,
      asistenciaPorDia,
      popularidadPorZona,
      clasesConCupoCompleto,
      tasaCancelacion,
    };
  },
};
