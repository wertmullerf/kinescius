import { MercadoPagoConfig, Payment, PaymentRefund } from "mercadopago";
import { env } from "../config/env";

// ─── Clientes SDK (para leer pagos y hacer reembolsos) ───────────────────────
const client = new MercadoPagoConfig({ accessToken: env.mp.accessToken });

export const mpPayment = new Payment(client);
export const mpRefund  = new PaymentRefund(client);

export const MP_WEBHOOK_SECRET = env.mp.webhookSecret;

// ─── Creación de preferencias via fetch directo ──────────────────────────────
// El SDK de Preference tiene problemas de compatibilidad con ciertos planes de
// cuenta de MP. Usamos fetch directo a la API, igual que la documentación oficial.

interface PreferenceItem {
  id:          string;
  title:       string;
  unit_price:  number;
  quantity:    number;
  currency_id: string;
}

interface CreatePreferenceOptions {
  items:              PreferenceItem[];
  external_reference: string;
  /** Minutos hasta que vence la preferencia. Si se omite, no expira. */
  expiresEnMinutos?:  number;
}

interface PreferenceResponse {
  id:          string;
  init_point:  string;
  sandbox_init_point: string;
  [key: string]: unknown;
}

export async function crearPreferencia(
  opts: CreatePreferenceOptions
): Promise<PreferenceResponse> {
  const body: Record<string, unknown> = {
    items:              opts.items,
    external_reference: opts.external_reference,
  };

  // back_urls solo si están configuradas.
  // auto_return solo si success URL es HTTPS — MP rechaza localhost con 400.
  if (env.mp.successUrl && env.mp.failureUrl && env.mp.pendingUrl) {
    body.back_urls = {
      success: env.mp.successUrl,
      failure: env.mp.failureUrl,
      pending: env.mp.pendingUrl,
    };
    if (env.mp.successUrl.startsWith("https://")) {
      body.auto_return = "approved";
    }
  }

  // notification_url solo si está configurada (necesita URL pública, no localhost)
  if (env.mp.webhookUrl) {
    body.notification_url = env.mp.webhookUrl;
  }

  // Expiración de la preferencia (ej: 20 min para seña, no expira para abono)
  if (opts.expiresEnMinutos) {
    const ahora = new Date();
    const vence = new Date(ahora.getTime() + opts.expiresEnMinutos * 60 * 1000);
    body.expires               = true;
    body.expiration_date_from  = ahora.toISOString();
    body.expiration_date_to    = vence.toISOString();
  }

  const response = await fetch("https://api.mercadopago.com/checkout/preferences", {
    method:  "POST",
    headers: {
      Authorization:  `Bearer ${env.mp.accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  const data = await response.json() as PreferenceResponse;

  if (!response.ok) {
    throw Object.assign(
      new Error(`MP Error ${response.status}: ${JSON.stringify(data)}`),
      { status: response.status, mpData: data }
    );
  }

  return data;
}
