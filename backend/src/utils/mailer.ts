import { Resend } from "resend";
import { env } from "../config/env";

const resend = new Resend(env.resend.apiKey);
const FROM   = env.resend.fromEmail;

// Colores del centro
const VERDE   = "#2e7d32";
const AMARILLO = "#f9a825";

function layout(titulo: string, cuerpo: string): string {
  return `
    <div style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:24px">
      <div style="background:${VERDE};padding:16px 24px;border-radius:8px 8px 0 0">
        <h1 style="color:#fff;margin:0;font-size:20px">Kinesius</h1>
      </div>
      <div style="border:1px solid #e0e0e0;border-top:none;padding:24px;border-radius:0 0 8px 8px">
        <h2 style="color:${VERDE};margin-top:0">${titulo}</h2>
        ${cuerpo}
      </div>
      <p style="color:#9e9e9e;font-size:12px;margin-top:16px;text-align:center">
        Este es un mensaje automático. Por favor no respondas este correo.
      </p>
    </div>
  `;
}

function formatFecha(fecha: Date): string {
  return fecha.toLocaleDateString("es-AR", {
    weekday: "long", year: "numeric", month: "long", day: "numeric", hour: "2-digit", minute: "2-digit",
  });
}

async function send(to: string, subject: string, html: string) {
  try {
    await resend.emails.send({ from: FROM, to, subject, html });
  } catch (err) {
    console.error(`[mailer] Error enviando "${subject}" a ${to}:`, err);
  }
}

// ─── Mails exportados ────────────────────────────────────────────────────────

export async function mailReservaConfirmada(
  cliente: { nombre: string; email: string },
  instancia: { fecha: Date; zona: string }
) {
  const html = layout(
    "Reserva confirmada",
    `<p>Hola <strong>${cliente.nombre}</strong>,</p>
     <p>Tu reserva para la clase <span style="color:${AMARILLO};font-weight:bold">${instancia.zona}</span>
     del <strong>${formatFecha(instancia.fecha)}</strong> está confirmada.</p>
     <p style="background:#e8f5e9;padding:12px;border-radius:6px">
       ¡Te esperamos! Recordá llegar 5 minutos antes.
     </p>`
  );
  await send(cliente.email, "Reserva confirmada — Kinesius", html);
}

export async function mailReservaPendientePago(
  cliente: { nombre: string; email: string },
  instancia: { fecha: Date; zona: string },
  linkPago: string
) {
  const html = layout(
    "Completá tu reserva",
    `<p>Hola <strong>${cliente.nombre}</strong>,</p>
     <p>Realizaste una reserva para la clase <span style="color:${AMARILLO};font-weight:bold">${instancia.zona}</span>
     del <strong>${formatFecha(instancia.fecha)}</strong>.</p>
     <p>Para confirmarla, abonás la <strong>seña del 50%</strong> antes de que expire el tiempo:</p>
     <div style="text-align:center;margin:24px 0">
       <a href="${linkPago}"
          style="background:${AMARILLO};color:#000;padding:14px 28px;border-radius:6px;
                 text-decoration:none;font-weight:bold;font-size:16px">
         Pagar seña ahora
       </a>
     </div>
     <p style="color:#e53935;font-size:13px">
       ⚠ Si no pagás en los próximos 15 minutos, la reserva se cancelará automáticamente.
     </p>`
  );
  await send(cliente.email, "Completá el pago de tu reserva — Kinesius", html);
}

export async function mailReservaCancelada(
  cliente: { nombre: string; email: string },
  instancia: { fecha: Date; zona: string },
  nota?: string
) {
  const notaHtml = nota
    ? `<p style="background:#fff3e0;padding:12px;border-radius:6px;color:#e65100">${nota}</p>`
    : "";
  const html = layout(
    "Reserva cancelada",
    `<p>Hola <strong>${cliente.nombre}</strong>,</p>
     <p>Tu reserva para la clase <strong>${instancia.zona}</strong>
     del <strong>${formatFecha(instancia.fecha)}</strong> fue cancelada.</p>
     ${notaHtml}
     <p>Si tenés alguna duda, contactanos directamente.</p>`
  );
  await send(cliente.email, "Tu reserva fue cancelada — Kinesius", html);
}

export async function mailColaEsperaNotificacion(
  cliente: { nombre: string; email: string },
  instancia: { fecha: Date; zona: string },
  expiraEn: Date
) {
  const html = layout(
    "¡Se liberó un lugar!",
    `<p>Hola <strong>${cliente.nombre}</strong>,</p>
     <p>Se liberó un cupo en la clase <span style="color:${AMARILLO};font-weight:bold">${instancia.zona}</span>
     del <strong>${formatFecha(instancia.fecha)}</strong>.</p>
     <p>Tenés tiempo hasta el <strong>${formatFecha(expiraEn)}</strong> para reservar tu lugar.</p>
     <p style="background:#e8f5e9;padding:12px;border-radius:6px">
       Ingresá a la app y confirma tu reserva antes de que venza el tiempo.
     </p>`
  );
  await send(cliente.email, "¡Hay un lugar disponible para vos! — Kinesius", html);
}

export async function mailReembolsoProcesado(
  cliente: { nombre: string; email: string },
  pago: { monto: number | string }
) {
  const html = layout(
    "Reembolso procesado",
    `<p>Hola <strong>${cliente.nombre}</strong>,</p>
     <p>Procesamos el reembolso de <strong>$${pago.monto}</strong> correspondiente
     a la seña de tu reserva cancelada.</p>
     <p style="background:#e8f5e9;padding:12px;border-radius:6px">
       El dinero volverá a tu cuenta según los tiempos de Mercado Pago (1–5 días hábiles).
     </p>`
  );
  await send(cliente.email, "Reembolso procesado — Kinesius", html);
}
