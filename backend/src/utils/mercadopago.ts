import { MercadoPagoConfig, Preference, Payment, PaymentRefund } from "mercadopago";
import type { PaymentResponse } from "mercadopago/dist/clients/payment/commonTypes";
import { env } from "../config/env";

const client = new MercadoPagoConfig({ accessToken: env.mp.accessToken });

const preferenceApi = new Preference(client);
const paymentApi    = new Payment(client);
const refundApi     = new PaymentRefund(client);

// ─── Tipos exportados ─────────────────────────────────────────────────────────

export type { PaymentResponse };

/**
 * Snapshot tipado de los campos que persistimos en PagoLog.mpRawResponse.
 * El index signature [key: string] lo hace compatible con Prisma.InputJsonObject.
 */
export interface MpPaymentLog {
  [key: string]:      string | number | boolean | null;
  mp_id:              number | null;
  status:             string | null;
  status_detail:      string | null;
  external_reference: string | null;
  transaction_amount: number | null;
  date_approved:      string | null;
  payment_method_id:  string | null;
  payment_type_id:    string | null;
}

export interface PreferenceItem {
  id:          string;
  title:       string;
  unit_price:  number;
  quantity:    number;
  currency_id: string;
}

export interface CreatePreferenceOptions {
  items:              PreferenceItem[];
  external_reference: string;
  /** Minutos hasta que vence la preferencia. */
  expiresEnMinutos?:  number;
  /**
   * Path del frontend al que MP debe redirigir después del pago.
   * Ej: '/reservas' | '/abonos'
   * Se construyen tres back_urls: ?payment=success|failure|pending
   */
  returnPath?:        string;
}

export interface PreferenceResult {
  id:         string;
  init_point: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Extrae los campos relevantes de PaymentResponse en un objeto Prisma-compatible. */
export function paymentToLog(p: PaymentResponse): MpPaymentLog {
  return {
    mp_id:              p.id                 ?? null,
    status:             p.status             ?? null,
    status_detail:      p.status_detail      ?? null,
    external_reference: p.external_reference ?? null,
    transaction_amount: p.transaction_amount ?? null,
    date_approved:      p.date_approved      ?? null,
    payment_method_id:  p.payment_method_id  ?? null,
    payment_type_id:    p.payment_type_id    ?? null,
  };
}

// ─── Preferencias ─────────────────────────────────────────────────────────────

export async function crearPreferencia(
  opts: CreatePreferenceOptions
): Promise<PreferenceResult> {
  const body: Parameters<typeof preferenceApi.create>[0]["body"] = {
    items:              opts.items,
    external_reference: opts.external_reference,
  };

  if (opts.returnPath) {
    const base = `${env.mp.frontendUrl}${opts.returnPath}`;
    body.back_urls = {
      success: `${base}?payment=success`,
      failure: `${base}?payment=failure`,
      pending: `${base}?payment=pending`,
    };
    // auto_return requiere HTTPS — solo lo seteamos en producción
    if (env.mp.frontendUrl.startsWith("https://")) {
      body.auto_return = "approved";
    }
  }

  if (env.mp.webhookUrl) {
    body.notification_url = env.mp.webhookUrl;
  }

  if (opts.expiresEnMinutos) {
    const ahora = new Date();
    const vence = new Date(ahora.getTime() + opts.expiresEnMinutos * 60_000);
    body.expires              = true;
    body.expiration_date_from = ahora.toISOString();
    body.expiration_date_to   = vence.toISOString();
  }

  const pref = await preferenceApi.create({ body });

  console.log(`[MP] Preferencia creada: id=${pref.id} | notification_url=${pref.notification_url ?? "(no seteada)"}`);

  return {
    id:         pref.id!,
    init_point: pref.init_point!,
  };
}

// ─── Pagos ────────────────────────────────────────────────────────────────────

export async function obtenerPago(paymentId: string): Promise<PaymentResponse> {
  return paymentApi.get({ id: Number(paymentId) });
}

// ─── Reembolsos ───────────────────────────────────────────────────────────────

export async function reembolsarPago(paymentId: string): Promise<void> {
  await refundApi.create({ payment_id: Number(paymentId) });
}
