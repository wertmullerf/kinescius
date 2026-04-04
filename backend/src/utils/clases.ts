/**
 * Utilidades compartidas para el dominio de clases.
 * Usadas por clase.service.ts y prisma/seed.ts.
 */

/** Convierte "HH:mm" a Date con fecha de referencia 2000-01-01. */
export function parseHora(horaStr: string): Date {
  const [h, m] = horaStr.split(":").map(Number);
  const d = new Date(2000, 0, 1);
  d.setHours(h, m, 0, 0);
  return d;
}

/** Formatea un Date al string "HH:mm" (para respuestas de la API). */
export function formatHora(date: Date): string {
  return `${date.getHours().toString().padStart(2, "0")}:${date
    .getMinutes()
    .toString()
    .padStart(2, "0")}`;
}

/**
 * Devuelve todas las fechas del mes indicado (mes: 1–12) cuyo día de semana
 * coincida con diaSemana (0=Dom … 6=Sab), con la hora tomada de horaRef.
 */
export function generarFechasDelMes(
  anio: number,
  mes: number,
  diaSemana: number,
  horaRef: Date
): Date[] {
  const fechas: Date[] = [];
  // new Date(anio, mes, 0).getDate() → total de días del mes (mes es 1-indexed aquí)
  const totalDias = new Date(anio, mes, 0).getDate();

  for (let dia = 1; dia <= totalDias; dia++) {
    const d = new Date(anio, mes - 1, dia);
    if (d.getDay() === diaSemana) {
      d.setHours(horaRef.getHours(), horaRef.getMinutes(), 0, 0);
      fechas.push(d);
    }
  }
  return fechas;
}
