export type Rol = 'ADMIN' | 'PROFESOR' | 'CLIENTE'
export type TipoCliente = 'ABONADO' | 'NO_ABONADO'
export type ZonaClase = 'ALTA' | 'MEDIA' | 'BAJA'
export type EstadoReserva =
  | 'PENDIENTE_PAGO'
  | 'RESERVA_PAGA'
  | 'CONFIRMADA'
  | 'CANCELADA'
  | 'COMPLETADA'
export type MetodoPago = 'EFECTIVO' | 'TRANSFERENCIA' | 'MERCADO_PAGO'
export type TipoPago = 'SENA' | 'COMPLEMENTO' | 'ABONO'

export interface Usuario {
  id: number
  nombre: string
  apellido: string
  dni: string
  email: string
  rol: Rol
  tipoCliente: TipoCliente
  clasesDisponibles: number
  sancionado: boolean
  createdAt: string
}

export interface Profesor {
  id: number
  nombre: string
  apellido: string
  dni: string
  imagenUrl?: string
}

export interface ClaseInstancia {
  id: number
  fecha: string
  zona: ZonaClase
  cupoMaximo: number
  duracion: number
  precio: number
  codigoQr: string
  esExcepcion: boolean
  motivoExcepcion?: string
  cancelada: boolean
  profesor: Profesor
  recurrenteId?: number
  reservasActivas?: number
}

export interface Reserva {
  id: number
  estado: EstadoReserva
  montoPagado: number
  mpPrefId?: string
  clienteId: number
  instanciaId: number
  instancia?: ClaseInstancia
  cliente?: Usuario
  pagos?: Pago[]
  asistencia?: Asistencia
  createdAt: string
}

export interface Pago {
  id: number
  monto: number
  metodo: MetodoPago
  tipo: TipoPago
  referencia?: string
  reservaId: number
  createdAt: string
}

export interface PagoAbono {
  id: number
  clienteId: number
  cantidadClases: number
  monto: number
  metodo: MetodoPago
  referencia?: string
  mpPaymentId?: string
  createdAt: string
}

export interface Asistencia {
  id: number
  presente: boolean
  registradoPor?: number
  reservaId: number
  createdAt: string
}

export interface ColaEspera {
  id: number
  posicion: number
  expiraEn?: string
  instanciaId: number
  clienteId: number
  cliente?: Pick<Usuario, 'id' | 'nombre' | 'apellido' | 'email' | 'tipoCliente'>
  instancia?: ClaseInstancia
}

export interface AuthUser {
  id: number
  nombre: string
  apellido: string
  email: string
  rol: Rol
  tipoCliente?: TipoCliente
  clasesDisponibles?: number
  sancionado?: boolean
}

export interface LoginResponse {
  token: string
  usuario: AuthUser
}

export interface TwoFARequired {
  requires2FA: true
  userId: number
}

export interface ApiResponse<T> {
  success: boolean
  data?: T
  message?: string
  error?: string
}

// Respuesta de POST /reservas — varía según cliente y cupo
export type CrearReservaResult =
  | { posicionCola: number }
  | (Reserva & { initPoint?: string })

export interface AgendaMensual {
  id: number
  mes: number
  anio: number
}

export interface ClaseRecurrente {
  id: number
  diaSemana: number
  hora: string
  zona: ZonaClase
  cupoMaximo: number
  duracion: number
  precio: number
  profesorId: number
  profesor?: Profesor
}

// ── Dashboard / Reportes ──────────────────────────────────────────────────────

export interface ClaseHoy {
  id:              number
  hora:            string
  zona:            ZonaClase
  profesor:        string
  cupoMaximo:      number
  reservasActivas: number
  enCola:          number
}

export interface ActividadReciente {
  tipo:        'RESERVA' | 'PAGO' | 'CANCELACION' | 'ABONO'
  descripcion: string
  cliente:     string
  fecha:       string
  monto?:      number
}

export interface DashboardStats {
  clientesActivos:          number
  clientesAbonados:         number
  clientesSancionados:      number
  ingresosMesActual:        number
  ingresosMesAnterior:      number
  complementosPendientes:   number
  reservasPendientesPago:   number
  clasesHoy:                ClaseHoy[]
  actividadReciente:        ActividadReciente[]
  asistenciaPorDia:         { dia: string; reservas: number }[]
  popularidadPorZona:       { zona: ZonaClase; reservas: number; porcentaje: number }[]
  clasesConCupoCompleto:    number
  tasaCancelacion:          number
}
