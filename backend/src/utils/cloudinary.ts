import { v2 as cloudinary } from "cloudinary";
import { env } from "../config/env";

cloudinary.config({
  cloud_name: env.cloudinary.cloudName,
  api_key:    env.cloudinary.apiKey,
  api_secret: env.cloudinary.apiSecret,
  secure:     true,
});
/**
 * Sube un buffer de imagen a Cloudinary.
 * - Convierte automáticamente a webp
 * - Redimensiona a 400×400 (crop centrado en cara si la detecta)
 * - Retorna la URL pública de la imagen resultante
 */
export function subirImagenCloudinary(
  buffer: Buffer,
  publicId: string
): Promise<string> {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        folder:     "kinescius/profesores",
        public_id:  publicId,
        overwrite:  true,
        invalidate: true,
        transformation: [
          { width: 400, height: 400, crop: "fill", gravity: "face" },
          { fetch_format: "webp", quality: "auto:good" },
        ],
      },
      (error, result) => {
        if (error || !result) return reject(error ?? new Error("Cloudinary upload failed"));
        resolve(result.secure_url);
      }
    );
    stream.end(buffer);
  });
}
