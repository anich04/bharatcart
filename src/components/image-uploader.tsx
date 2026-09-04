"use client";

import { useState } from "react";
import Image from "next/image";
import { Upload, X } from "lucide-react";

/**
 * Uploads images straight to Cloudinary using a signature minted server-side.
 * Falls back to manual URL entry when Cloudinary isn't configured yet.
 */
export function ImageUploader({
  kind,
  urls,
  onChange,
  max = 10,
}: {
  kind: "products" | "reviews";
  urls: string[];
  onChange: (urls: string[]) => void;
  max?: number;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const uploadFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setBusy(true);
    setError(null);

    try {
      const sigRes = await fetch("/api/uploads/signature", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind }),
      });
      const sig = await sigRes.json();
      if (!sigRes.ok || !sig.ok) {
        setError(sig.error ?? "Could not start the upload.");
        return;
      }

      const uploaded: string[] = [];
      for (const file of Array.from(files).slice(0, max - urls.length)) {
        if (!file.type.startsWith("image/")) {
          setError("Only image files can be uploaded.");
          continue;
        }
        if (file.size > 10 * 1024 * 1024) {
          setError(`${file.name} is larger than 10 MB.`);
          continue;
        }

        const form = new FormData();
        form.append("file", file);
        form.append("api_key", sig.apiKey);
        form.append("timestamp", String(sig.timestamp));
        form.append("folder", sig.folder);
        form.append("signature", sig.signature);

        const res = await fetch(sig.uploadUrl, { method: "POST", body: form });
        const data = await res.json();
        if (res.ok && data.secure_url) {
          uploaded.push(data.secure_url as string);
        } else {
          setError(data?.error?.message ?? "Upload failed.");
        }
      }

      if (uploaded.length > 0) onChange([...urls, ...uploaded].slice(0, max));
    } catch {
      setError("Upload failed. Check your connection and try again.");
    } finally {
      setBusy(false);
    }
  };

  const removeAt = (i: number) => onChange(urls.filter((_, idx) => idx !== i));

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-3">
        <label className="border-input hover:bg-muted flex cursor-pointer items-center gap-2 rounded-md border px-3 py-2 text-sm">
          <Upload className="size-4" />
          {busy ? "Uploading…" : "Upload images"}
          <input
            type="file"
            accept="image/*"
            multiple
            disabled={busy || urls.length >= max}
            onChange={(e) => {
              uploadFiles(e.target.files);
              e.target.value = "";
            }}
            className="hidden"
          />
        </label>
        <span className="text-muted-foreground text-xs">
          {urls.length}/{max} images
        </span>
      </div>

      {error && (
        <p className="bg-destructive/10 text-destructive rounded-md px-3 py-2 text-xs">{error}</p>
      )}

      {urls.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {urls.map((url, i) => (
            <div
              key={`${url}-${i}`}
              className="border-border bg-muted relative size-20 overflow-hidden rounded-md border"
            >
              {/* Cloudinary URLs are allowed by next.config remotePatterns. */}
              <Image src={url} alt={`Image ${i + 1}`} fill sizes="80px" className="object-cover" />
              <button
                type="button"
                onClick={() => removeAt(i)}
                aria-label={`Remove image ${i + 1}`}
                className="bg-background/90 absolute top-0.5 right-0.5 rounded p-0.5"
              >
                <X className="size-3" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Manual entry keeps the form usable before Cloudinary is configured. */}
      <details>
        <summary className="text-muted-foreground cursor-pointer text-xs">
          Or paste image URLs
        </summary>
        <textarea
          value={urls.join("\n")}
          onChange={(e) =>
            onChange(
              e.target.value
                .split("\n")
                .map((u) => u.trim())
                .filter(Boolean)
                .slice(0, max),
            )
          }
          rows={3}
          placeholder="https://res.cloudinary.com/..."
          className="border-input bg-background mt-2 w-full rounded-md border px-3 py-2 text-xs"
        />
      </details>
    </div>
  );
}
