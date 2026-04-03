// Augmentación del tipo Request de Express.
// Se extiende "express-serve-static-core" porque es el módulo interno
// donde Express define la interfaz Request real.
// El "export {}" al final convierte el archivo en un módulo,
// lo cual es necesario para que el "declare module" funcione.
declare module "express-serve-static-core" {
  interface Request {
    user?: {
      id: number;
      email: string;
      rol: "ADMIN" | "PROFESOR" | "CLIENTE";
      tipoCliente: "ABONADO" | "NO_ABONADO";
    };
  }
}

export {};
