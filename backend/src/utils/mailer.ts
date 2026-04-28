import nodemailer from "nodemailer";
import { env } from "../config/env";

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: env.mail.user,
    pass: env.mail.pass,  // contraseña de aplicación (no la de la cuenta)
  },
});

const FROM = env.mail.from;

const VERDE        = "#2e7d32";
const VERDE_CLARO  = "#e8f5e9";
const VERDE_MEDIO  = "#43a047";
const GRIS_TEXTO   = "#424242";
const GRIS_SUAVE   = "#f5f5f5";

function layout(titulo: string, cuerpo: string): string {
  return `
    <div style="font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;max-width:580px;margin:0 auto;background:#ffffff">

      <!-- Header -->
      <div style="background:${VERDE};padding:28px 32px;border-radius:10px 10px 0 0">
        <p style="color:#a5d6a7;font-size:11px;letter-spacing:3px;text-transform:uppercase;margin:0 0 4px">Centro de Kinesiología</p>
        <h1 style="color:#ffffff;margin:0;font-size:26px;font-weight:700;letter-spacing:-0.5px">Kinescius</h1>
      </div>

      <!-- Divider accent -->
      <div style="height:4px;background:linear-gradient(to right,${VERDE_MEDIO},#81c784)"></div>

      <!-- Body -->
      <div style="padding:32px;border:1px solid #e0e0e0;border-top:none;border-radius:0 0 10px 10px">
        <h2 style="color:${VERDE};margin:0 0 20px;font-size:20px;font-weight:600">${titulo}</h2>
        <div style="color:${GRIS_TEXTO};font-size:15px;line-height:1.7">
          ${cuerpo}
        </div>
      </div>

      <!-- Footer -->
      <p style="color:#9e9e9e;font-size:12px;margin:20px 0 0;text-align:center;line-height:1.6">
        Este es un mensaje automático · Por favor no respondas este correo
      </p>
    </div>
  `;
}

function formatFecha(fecha: Date): string {
  return fecha.toLocaleDateString("es-AR", {
    weekday: "long", year: "numeric", month: "long", day: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

async function send(to: string, subject: string, html: string): Promise<void> {
  try {
    await transporter.sendMail({ from: FROM, to, subject, html });
  } catch (err) {
    console.error(`[mailer] Error enviando "${subject}" a ${to}:`, err);
  }
}

// ─── Emails ───────────────────────────────────────────────────────────────────

export async function mailReservaConfirmada(
  cliente:  { nombre: string; email: string },
  instancia: { fecha: Date; zona: string }
) {
  await send(
    cliente.email,
    "Reserva confirmada — Kinescius",
    layout(
      "¡Reserva confirmada!",
      `<p>Hola <strong>${cliente.nombre}</strong>,</p>
       <p>Tu reserva está confirmada. Te esperamos en la clase:</p>
       <div style="background:${VERDE_CLARO};border-left:4px solid ${VERDE};padding:16px 20px;border-radius:0 8px 8px 0;margin:20px 0">
         <p style="margin:0 0 4px;font-size:13px;color:${VERDE};font-weight:600;text-transform:uppercase;letter-spacing:1px">Zona</p>
         <p style="margin:0 0 12px;font-size:18px;font-weight:700;color:${VERDE}">${instancia.zona}</p>
         <p style="margin:0 0 4px;font-size:13px;color:${VERDE};font-weight:600;text-transform:uppercase;letter-spacing:1px">Fecha y hora</p>
         <p style="margin:0;font-size:15px;color:${GRIS_TEXTO}">${formatFecha(instancia.fecha)}</p>
       </div>
       <p style="color:#616161;font-size:14px">Recordá llegar 5 minutos antes. ¡Nos vemos!</p>`
    )
  );
}
/*
export async function mailReservaPendientePago(
  cliente:  { nombre: string; email: string },
  instancia: { fecha: Date; zona: string },
  linkPago:  string
) {
  await send(
    cliente.email,
    "Completá el pago de tu reserva — Kinescius",
    layout(
      "Completá tu reserva",
      `<p>Hola <strong>${cliente.nombre}</strong>,</p>
       <p>Reservaste un lugar en la siguiente clase:</p>
       <div style="background:${GRIS_SUAVE};padding:16px 20px;border-radius:8px;margin:20px 0">
         <p style="margin:0 0 4px;font-size:13px;color:#757575;text-transform:uppercase;letter-spacing:1px">Zona · ${instancia.zona}</p>
         <p style="margin:0;font-size:15px;color:${GRIS_TEXTO};font-weight:600">${formatFecha(instancia.fecha)}</p>
       </div>
       <p>Para confirmar tu lugar tenés que abonar la <strong>seña del 50%</strong> a través de Mercado Pago:</p>
       <div style="text-align:center;margin:28px 0">
         <a href="${linkPago}"
            style="background:${VERDE};color:#ffffff;padding:15px 36px;border-radius:8px;
                   text-decoration:none;font-weight:700;font-size:16px;display:inline-block">
           Pagar seña →
         </a>
       </div>
       <p style="color:#9e9e9e;font-size:13px;text-align:center">Si no pagás a tiempo, tu lugar se liberará automáticamente.</p>`
    )
  );
}
*/
export async function mailColaEsperaIngreso(
  cliente:   { nombre: string; email: string },
  instancia: { fecha: Date; zona: string },
  posicion:  number
) {
  await send(
    cliente.email,
    "Estás en la lista de espera — Kinescius",
    layout(
      "Te anotamos en la lista de espera",
      `<p>Hola <strong>${cliente.nombre}</strong>,</p>
       <p>No había cupo disponible, pero te anotamos en la lista de espera para:</p>
       <div style="background:${GRIS_SUAVE};padding:16px 20px;border-radius:8px;margin:20px 0">
         <p style="margin:0 0 4px;font-size:13px;color:#757575;text-transform:uppercase;letter-spacing:1px">Zona · ${instancia.zona}</p>
         <p style="margin:0;font-size:15px;color:${GRIS_TEXTO};font-weight:600">${formatFecha(instancia.fecha)}</p>
       </div>
       <div style="text-align:center;margin:20px 0">
         <p style="margin:0 0 4px;font-size:13px;color:#757575;text-transform:uppercase;letter-spacing:1px">Tu posición en la lista</p>
         <p style="margin:0;font-size:42px;font-weight:700;color:${VERDE}">#${posicion}</p>
       </div>
       <p style="color:#616161;font-size:14px">Si se libera un lugar, te avisamos por este medio y tendrás <strong>5 horas</strong> para confirmar.</p>`
    )
  );
}

export async function mailColaEsperaNotificacion(
  cliente:  { nombre: string; email: string },
  instancia: { fecha: Date; zona: string },
  expiraEn:  Date
) {
  await send(
    cliente.email,
    "¡Se liberó un lugar para vos! — Kinescius",
    layout(
      "¡Se liberó un lugar!",
      `<p>Hola <strong>${cliente.nombre}</strong>,</p>
       <p>Quedaste primero en la lista de espera y se liberó un cupo en:</p>
       <div style="background:${VERDE_CLARO};border-left:4px solid ${VERDE};padding:16px 20px;border-radius:0 8px 8px 0;margin:20px 0">
         <p style="margin:0 0 4px;font-size:13px;color:${VERDE};font-weight:600;text-transform:uppercase;letter-spacing:1px">Zona</p>
         <p style="margin:0 0 12px;font-size:18px;font-weight:700;color:${VERDE}">${instancia.zona}</p>
         <p style="margin:0 0 4px;font-size:13px;color:${VERDE};font-weight:600;text-transform:uppercase;letter-spacing:1px">Fecha y hora</p>
         <p style="margin:0;font-size:15px;color:${GRIS_TEXTO}">${formatFecha(instancia.fecha)}</p>
       </div>
       <p>Tenés tiempo para confirmar hasta el <strong>${formatFecha(expiraEn)}</strong>. Pasado ese tiempo, el lugar pasa al siguiente en la lista.</p>
       <p style="color:#616161;font-size:14px">Ingresá a la app y reservá tu lugar.</p>`
    )
  );
}

/** Solo se envía si hay nota (sanción o pérdida de seña) */
export async function mailReservaCancelada(
  cliente:  { nombre: string; email: string },
  instancia: { fecha: Date; zona: string },
  nota?:     string
) {
  if (!nota) return;
  await send(
    cliente.email,
    "Tu reserva fue cancelada — Kinescius",
    layout(
      "Reserva cancelada",
      `<p>Hola <strong>${cliente.nombre}</strong>,</p>
       <p>Tu reserva para la clase <strong>${instancia.zona}</strong> del <strong>${formatFecha(instancia.fecha)}</strong> fue cancelada.</p>
       <div style="background:#fbe9e7;border-left:4px solid #e64a19;padding:14px 18px;border-radius:0 8px 8px 0;margin:20px 0;color:#bf360c;font-size:14px">
         ${nota}
       </div>
       <p style="color:#616161;font-size:14px">Si tenés alguna duda, contactanos directamente.</p>`
    )
  );
}

export async function mailAbonoConfirmado(
  cliente: { nombre: string; email: string },
  abono:   { cantidadClases: number; precioPorClase: number; montoTotal: number | string }
) {
  await send(
    cliente.email,
    "Abono confirmado — Kinescius",
    layout(
      "¡Tu abono fue acreditado!",
      `<p>Hola <strong>${cliente.nombre}</strong>,</p>
       <p>Recibimos tu pago y ya acreditamos las clases en tu cuenta:</p>
       <div style="background:${VERDE_CLARO};border-left:4px solid ${VERDE};padding:16px 20px;border-radius:0 8px 8px 0;margin:20px 0">
         <p style="margin:0 0 4px;font-size:13px;color:${VERDE};font-weight:600;text-transform:uppercase;letter-spacing:1px">Clases acreditadas</p>
         <p style="margin:0 0 12px;font-size:28px;font-weight:700;color:${VERDE}">${abono.cantidadClases}</p>
         <p style="margin:0 0 4px;font-size:13px;color:${VERDE};font-weight:600;text-transform:uppercase;letter-spacing:1px">Total abonado</p>
         <p style="margin:0;font-size:18px;font-weight:700;color:${GRIS_TEXTO}">$${abono.montoTotal}</p>
       </div>
       <p style="color:#616161;font-size:14px">Ya podés reservar tus clases con descuento del 20%. ¡Nos vemos!</p>`
    )
  );
}

export async function mailClaseModificada(
  cliente:   { nombre: string; email: string },
  instancia: { fechaAnterior: Date; fechaNueva: Date; zona: string; motivo: string }
) {
  await send(
    cliente.email,
    "Tu clase fue reprogramada — Kinescius",
    layout(
      "Tu clase tiene un nuevo horario",
      `<p>Hola <strong>${cliente.nombre}</strong>,</p>
       <p>Una clase en la que tenés una reserva fue reprogramada:</p>
       <div style="background:${GRIS_SUAVE};padding:16px 20px;border-radius:8px;margin:20px 0">
         <p style="margin:0 0 4px;font-size:13px;color:#757575;text-transform:uppercase;letter-spacing:1px">Horario anterior</p>
         <p style="margin:0 0 12px;font-size:15px;color:${GRIS_TEXTO};text-decoration:line-through">${formatFecha(instancia.fechaAnterior)}</p>
         <p style="margin:0 0 4px;font-size:13px;color:${VERDE};font-weight:600;text-transform:uppercase;letter-spacing:1px">Nuevo horario</p>
         <p style="margin:0 0 8px;font-size:17px;font-weight:700;color:${VERDE}">${formatFecha(instancia.fechaNueva)}</p>
         <p style="margin:0;font-size:13px;color:#757575">Zona: <strong>${instancia.zona}</strong> · Motivo: ${instancia.motivo}</p>
       </div>
       <p style="background:#fff8e1;border-left:4px solid #ffc107;padding:12px 16px;border-radius:0 8px 8px 0;font-size:14px;color:#5d4037;margin:0">
         Si el nuevo horario no te sirve, podés cancelar tu reserva desde la app.
         Recordá las políticas de cancelación vigentes.
       </p>`
    )
  );
}

export async function mailInstanciaCancelada(
  cliente:   { nombre: string; email: string },
  instancia: { fecha: Date; zona: string }
) {
  await send(
    cliente.email,
    "Clase cancelada — Kinescius",
    layout(
      "Una clase fue cancelada",
      `<p>Hola <strong>${cliente.nombre}</strong>,</p>
       <p>Lamentablemente la siguiente clase fue <strong>cancelada</strong> por el centro:</p>
       <div style="background:#fbe9e7;border-left:4px solid #e64a19;padding:16px 20px;border-radius:0 8px 8px 0;margin:20px 0">
         <p style="margin:0 0 4px;font-size:13px;color:#e64a19;font-weight:600;text-transform:uppercase;letter-spacing:1px">Zona</p>
         <p style="margin:0 0 10px;font-size:18px;font-weight:700;color:#bf360c">${instancia.zona}</p>
         <p style="margin:0 0 4px;font-size:13px;color:#e64a19;font-weight:600;text-transform:uppercase;letter-spacing:1px">Fecha y hora</p>
         <p style="margin:0;font-size:15px;color:#bf360c">${formatFecha(instancia.fecha)}</p>
       </div>
       <p style="color:#616161;font-size:14px">Tu reserva fue cancelada automáticamente. Si habías realizado un pago, el equipo del centro se comunicará para coordinar el reembolso.</p>`
    )
  );
}

export async function mail2FACode(
  admin: { nombre: string; email: string },
  codigo: string
) {
  await send(
    admin.email,
    "Código de verificación — Kinescius",
    layout(
      "Verificación en dos pasos",
      `<p>Hola <strong>${admin.nombre}</strong>,</p>
       <p>Tu código de verificación para acceder como administrador es:</p>
       <div style="text-align:center;margin:28px 0;background:${VERDE_CLARO};border-radius:12px;padding:28px">
         <p style="margin:0 0 8px;font-size:13px;color:${VERDE};font-weight:600;text-transform:uppercase;letter-spacing:2px">Código de acceso</p>
         <p style="font-size:48px;font-weight:700;letter-spacing:16px;color:${VERDE};margin:0;font-family:monospace">${codigo}</p>
       </div>
       <p style="color:#9e9e9e;font-size:13px;text-align:center">
         Este código expira en <strong>10 minutos</strong>.<br>
         Si no intentaste iniciar sesión, cambiá tu contraseña de inmediato.
       </p>`
    )
  );
}

export async function mailRestablecerContrasenia(
  cliente: { nombre: string; email: string },
  resetLink: string
) {
  await send(
    cliente.email,
    "Restablecer contraseña — Kinescius",
    layout(
      "Restablecer tu contraseña",
      `<p>Hola <strong>${cliente.nombre}</strong>,</p>
       <p>Recibimos una solicitud para restablecer la contraseña de tu cuenta.</p>
       <div style="text-align:center;margin:28px 0">
         <a href="${resetLink}"
            style="background:${VERDE};color:#ffffff;padding:15px 36px;border-radius:8px;
                   text-decoration:none;font-weight:700;font-size:16px;display:inline-block">
           Cambiar contraseña →
         </a>
       </div>
       <p style="color:#9e9e9e;font-size:13px;text-align:center">
         Este enlace expira en <strong>1 hora</strong>.<br>
         Si no solicitaste este cambio, podés ignorar este correo.
       </p>`
    )
  );
}

export async function mailReembolsoProcesado(
  cliente: { nombre: string; email: string },
  pago:    { monto: number | string }
) {
  await send(
    cliente.email,
    "Reembolso procesado — Kinescius",
    layout(
      "Reembolso procesado",
      `<p>Hola <strong>${cliente.nombre}</strong>,</p>
       <p>Procesamos el reembolso de la seña de tu reserva cancelada.</p>
       <div style="background:${GRIS_SUAVE};padding:16px 20px;border-radius:8px;margin:20px 0;text-align:center">
         <p style="margin:0 0 4px;font-size:13px;color:#757575;text-transform:uppercase;letter-spacing:1px">Monto reembolsado</p>
         <p style="margin:0;font-size:28px;font-weight:700;color:${VERDE}">$${pago.monto}</p>
       </div>
       <p style="color:#616161;font-size:14px">El dinero volverá a tu cuenta según los tiempos de Mercado Pago (1–5 días hábiles).</p>`
    )
  );
}
