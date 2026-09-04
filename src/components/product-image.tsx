import Image from "next/image";

/**
 * Product image with a deterministic colored placeholder when no licensed
 * photography is available yet. (The brief requires licensed/client-supplied
 * imagery — no stock photos — so products ship with placeholders until real
 * photos are uploaded via Cloudinary.)
 *
 * Must be rendered inside a `relative` container that sets the aspect ratio.
 */
export function ProductImage({
  url,
  alt,
  title,
  sizes,
  priority,
}: {
  url?: string | null;
  alt?: string | null;
  title: string;
  sizes?: string;
  priority?: boolean;
}) {
  if (url) {
    return (
      <Image
        src={url}
        alt={alt ?? title}
        fill
        sizes={sizes ?? "(max-width: 768px) 50vw, 25vw"}
        className="object-cover"
        priority={priority}
      />
    );
  }

  let hash = 0;
  for (let i = 0; i < title.length; i++) hash = (hash * 31 + title.charCodeAt(i)) % 360;
  const initials = title
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase();

  return (
    <div
      aria-label={alt ?? title}
      className="flex h-full w-full items-center justify-center"
      style={{
        background: `linear-gradient(135deg, hsl(${hash} 38% 90%), hsl(${(hash + 40) % 360} 42% 82%))`,
      }}
    >
      <span className="text-2xl font-semibold" style={{ color: `hsl(${hash} 45% 32%)` }}>
        {initials}
      </span>
    </div>
  );
}
