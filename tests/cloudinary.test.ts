import { describe, it, expect, vi, afterEach } from "vitest";
import { createHash } from "node:crypto";

const SECRET = "test_api_secret";

async function loadModule(env: Record<string, string | undefined> = {}) {
  vi.resetModules();
  process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME = "demo-cloud";
  process.env.CLOUDINARY_API_KEY = "123456789";
  process.env.CLOUDINARY_API_SECRET = SECRET;
  process.env.CLOUDINARY_UPLOAD_FOLDER = "bharatcart";
  for (const [k, v] of Object.entries(env)) {
    if (v === undefined) delete process.env[k];
    else process.env[k] = v;
  }
  return import("@/lib/cloudinary");
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("Cloudinary upload signing", () => {
  it("signs params the way Cloudinary expects (sorted, secret appended, SHA-1)", async () => {
    const { signUploadParams } = await loadModule();

    const params = { timestamp: 1700000000, folder: "bharatcart/products" };
    const expected = createHash("sha1")
      .update("folder=bharatcart/products&timestamp=1700000000" + SECRET)
      .digest("hex");

    expect(signUploadParams(params)).toBe(expected);
  });

  it("produces a different signature when any param changes", async () => {
    const { signUploadParams } = await loadModule();

    const base = signUploadParams({ timestamp: 1700000000, folder: "bharatcart/products" });
    const otherFolder = signUploadParams({ timestamp: 1700000000, folder: "bharatcart/reviews" });
    const otherTime = signUploadParams({ timestamp: 1700000001, folder: "bharatcart/products" });

    expect(base).not.toBe(otherFolder);
    expect(base).not.toBe(otherTime);
  });

  it("never leaks the API secret in the signed payload", async () => {
    const { createUploadSignature } = await loadModule();
    const sig = createUploadSignature("products");

    const serialised = JSON.stringify(sig);
    expect(serialised).not.toContain(SECRET);
    // Only public values are handed to the browser.
    expect(sig.cloudName).toBe("demo-cloud");
    expect(sig.apiKey).toBe("123456789");
    expect(sig.folder).toBe("bharatcart/products");
    expect(sig.uploadUrl).toContain("demo-cloud");
  });

  it("scopes uploads to separate folders per kind", async () => {
    const { uploadFolder } = await loadModule();
    expect(uploadFolder("products")).toBe("bharatcart/products");
    expect(uploadFolder("reviews")).toBe("bharatcart/reviews");
  });

  it("reports unconfigured when the secret is missing", async () => {
    const { isCloudinaryConfigured } = await loadModule({ CLOUDINARY_API_SECRET: undefined });
    expect(isCloudinaryConfigured()).toBe(false);
  });
});
