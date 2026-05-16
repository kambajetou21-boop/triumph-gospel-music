import type { Config, Context } from "@netlify/functions";
import { getStore } from "@netlify/blobs";

export default async (req: Request, context: Context) => {
  const key = context.params?.key;
  if (!key) return new Response("Missing key", { status: 400 });

  const decodedKey = decodeURIComponent(key);
  const store = getStore("music");

  const metadata = await store.getMetadata(decodedKey);
  if (!metadata) return new Response("Track not found", { status: 404 });

  const blob = await store.get(decodedKey, { type: "arrayBuffer" });
  if (!blob) return new Response("Track not found", { status: 404 });

  const contentType =
    (metadata.metadata as Record<string, string>)?.contentType || "audio/mpeg";

  return new Response(blob, {
    headers: {
      "Content-Type": contentType,
      "Accept-Ranges": "bytes",
      "Cache-Control": "public, max-age=3600",
    },
  });
};

export const config: Config = {
  path: "/api/stream/:key",
};
