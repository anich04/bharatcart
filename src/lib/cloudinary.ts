import { createHash } from "node:crypto";

/**
 * Cloudinary signed direct uploads.
 *
 * The browser uploads the file straight to Cloudinary using a short-lived
 * signature minted here. CLOUDINARY_API_SECRET stays server-only and is never
 * sent to the client; only the cloud name and api key (both public) are.
 */
const CLOUD_NAME = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME ?? "";
const API_KEY = process.env.CLOUDINARY_API_KEY ?? "";
const API_SECRET = process.env.CLOUDINARY_API_SECRET ?? "";
const BASE_FOLDER = process.env.CLOUDINARY_UPLOAD_FOLDER ?? "bharatcart";

export function isCloudinaryConfigured(): boolean {
  return Boolean(CLOUD_NAME && API_KEY && API_SECRET);
}

export function cloudinaryCloudName(): string {
  return CLOUD_NAME;
}

export function uploadFolder(kind: "products" | "reviews"): string {
  return `${BASE_FOLDER}/${kind}`;
}

/**
 * Cloudinary signature: all signed params sorted by key, joined as
 * `k=v&k=v`, with the API secret appended, hashed with SHA-1.
 */
export function signUploadParams(params: Record<string, string | number>): string {
  const toSign = Object.keys(params)
    .sort()
    .map((k) => `${k}=${params[k]}`)
    .join("&");
  return createHash("sha1")
    .update(toSign + API_SECRET)
    .digest("hex");
}

export function createUploadSignature(kind: "products" | "reviews") {
  const timestamp = Math.floor(Date.now() / 1000);
  const folder = uploadFolder(kind);
  const signature = signUploadParams({ folder, timestamp });

  return {
    cloudName: CLOUD_NAME,
    apiKey: API_KEY,
    timestamp,
    folder,
    signature,
    uploadUrl: `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/image/upload`,
  };
}
