import { v2 as cloudinaryV2 } from 'cloudinary';
import type { Response } from 'express';
import type { AuthRequest } from '../types';

cloudinaryV2.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

export async function getSignature(req: AuthRequest, res: Response): Promise<void> {
  try {
    if (
      !process.env.CLOUDINARY_CLOUD_NAME ||
      !process.env.CLOUDINARY_API_KEY ||
      !process.env.CLOUDINARY_API_SECRET
    ) {
      res.status(500).json({ error: 'Cloudinary no configurado en el servidor' });
      return;
    }

    const { folder, public_id, upload_preset } = req.body ?? {};
    const timestamp = Math.floor(Date.now() / 1000);
    const params: Record<string, unknown> = { timestamp };
    if (folder) params.folder = folder;
    params.upload_preset =
      upload_preset ?? process.env.CLOUDINARY_UPLOAD_PRESET ?? 'ml_default';
    if (public_id) params.public_id = public_id;

    const signature = cloudinaryV2.utils.api_sign_request(
      params as Record<string, string | number>,
      cloudinaryV2.config().api_secret!,
    );

    res.json({
      cloudName: cloudinaryV2.config().cloud_name,
      apiKey: cloudinaryV2.config().api_key,
      signature,
      timestamp,
      folder: (params.folder as string) ?? null,
      uploadPreset: params.upload_preset as string,
      publicId: public_id ?? null,
    });
  } catch (err) {
    console.error('Cloudinary signature error', err);
    res.status(500).json({ error: 'Error generando firma Cloudinary' });
  }
}

export async function renamePublicId(
  oldPublicId: string,
  newPublicId: string,
): Promise<{ secure_url?: string; public_id?: string }> {
  return cloudinaryV2.uploader.rename(oldPublicId, newPublicId, {
    overwrite: true,
    invalidate: true,
  });
}

export { cloudinaryV2 as cloudinaryInstance };
