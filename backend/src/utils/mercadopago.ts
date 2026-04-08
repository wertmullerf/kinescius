import { env } from "../config/env";

const MP_API = "https://api.mercadopago.com";

function authHeaders() {
  return {
    Authorization:  `Bearer ${env.mp.accessToken}`,
    "Content-Type": "application/json",
  };
}

async function mpFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const res  = await fetch(`${MP_API}${path}`, init);
  const data = await res.json() as T;
  if (!res.ok) {
    throw Object.assign(
      new Error(`MP ${res.status} ${path}: ${JSON.stringify(data)}`),
      { status: res.status, mpData: data }
    );
  }
  return data;
}

// ─── Preferencias ────────────────────────────────────────────────────────────

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
  id:                 string;
  init_point:         string;
  sandbox_init_point: string;
  [key: string]:      unknown;
}

export async function crearPreferencia(
  opts: CreatePreferenceOptions
): Promise<PreferenceResponse> {
  const body: Record<string, unknown> = {
    items:              opts.items,
    external_reference: opts.external_reference,
  };

  if (env.mp.successUrl && env.mp.failureUrl && env.mp.pendingUrl) {
    body.back_urls = {
      success: env.mp.successUrl,
      failure: env.mp.failureUrl,
      pending: env.mp.pendingUrl,
    };
    // auto_return solo funciona con HTTPS
    if (env.mp.successUrl.startsWith("https://")) {
      body.auto_return = "approved";
    }
  }

  if (env.mp.webhookUrl) {
    body.notification_url = env.mp.webhookUrl;
  }

  if (opts.expiresEnMinutos) {
    const ahora = new Date();
    const vence = new Date(ahora.getTime() + opts.expiresEnMinutos * 60 * 1000);
    body.expires              = true;
    body.expiration_date_from = ahora.toISOString();
    body.expiration_date_to   = vence.toISOString();
  }

  const data = await mpFetch<PreferenceResponse>("/checkout/preferences", {
    method:  "POST",
    headers: authHeaders(),
    body:    JSON.stringify(body),
  });

  // En sandbox usar sandbox_init_point; en producción init_point
  if (env.mp.isSandbox) {
    data.init_point = data.sandbox_init_point ?? data.init_point;
  }

  return data;
}

// ─── Pagos ───────────────────────────────────────────────────────────────────

export async function obtenerPago(paymentId: string): Promise<Record<string, unknown>> {
  return mpFetch<Record<string, unknown>>(`/v1/payments/${paymentId}`, {
    headers: authHeaders(),
  });
}

// ─── Reembolsos ──────────────────────────────────────────────────────────────

export async function reembolsarPago(paymentId: string): Promise<void> {
  await mpFetch(`/v1/payments/${paymentId}/refunds`, {
    method:  "POST",
    headers: authHeaders(),
    body:    JSON.stringify({}),
  });
}
