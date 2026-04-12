const BASE_URL = import.meta.env.VITE_API_URL as string

async function request<T>(method: string, url: string, body?: unknown): Promise<T> {
  const token = localStorage.getItem('token')

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  }

  if (token) {
    headers['Authorization'] = `Bearer ${token}`
  }

  const response = await fetch(`${BASE_URL}${url}`, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  })

  // Token expirado o inválido → limpiar sesión y redirigir
  if (response.status === 401) {
    localStorage.removeItem('token')
    localStorage.removeItem('user')
    window.location.href = '/login'
    throw new Error('Sesión expirada')
  }

  const json = await response.json()

  if (!response.ok) {
    throw new Error(json?.message ?? json?.error ?? 'Error del servidor')
  }

  // El backend devuelve { success, message, data } — retornamos solo data
  return (json?.data ?? json) as T
}

export const get   = <T>(url: string): Promise<T>                         => request<T>('GET', url)
export const post  = <T>(url: string, body?: unknown): Promise<T>         => request<T>('POST', url, body)
export const put   = <T>(url: string, body?: unknown): Promise<T>         => request<T>('PUT', url, body)
export const patch = <T>(url: string, body?: unknown): Promise<T>         => request<T>('PATCH', url, body)
export const del   = <T>(url: string): Promise<T>                         => request<T>('DELETE', url)

/** Upload de archivo con multipart/form-data (sin Content-Type para que el browser lo ponga con boundary) */
export async function postFile<T>(url: string, formData: FormData): Promise<T> {
  const token = localStorage.getItem('token')
  const headers: Record<string, string> = {}
  if (token) headers['Authorization'] = `Bearer ${token}`

  const response = await fetch(`${BASE_URL}${url}`, {
    method: 'POST',
    headers,
    body: formData,
  })

  if (response.status === 401) {
    localStorage.removeItem('token')
    localStorage.removeItem('user')
    window.location.href = '/login'
    throw new Error('Sesión expirada')
  }

  const json = await response.json()
  if (!response.ok) throw new Error(json?.message ?? json?.error ?? 'Error del servidor')
  return (json?.data ?? json) as T
}
