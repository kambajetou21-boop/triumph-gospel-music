import type { Config, Context } from "@netlify/functions";
import { getUser } from "@netlify/identity";
import { getStore } from "@netlify/blobs";
import { db } from "../../db/index.js";
import { tracks, artists } from "../../db/schema.js";
import { eq, desc } from "drizzle-orm";

export default async (req: Request, context: Context) => {
  if (req.method === "GET") {
    const allTracks = await db
      .select({
        id: tracks.id,
        artistId: tracks.artistId,
        title: tracks.title,
        genre: tracks.genre,
        coverUrl: tracks.coverUrl,
        blobKey: tracks.blobKey,
        duration: tracks.duration,
        createdAt: tracks.createdAt,
        artistName: artists.name,
      })
      .from(tracks)
      .leftJoin(artists, eq(tracks.artistId, artists.id))
      .orderBy(desc(tracks.createdAt));
    return Response.json(allTracks);
  }

  if (req.method === "POST") {
    const user = await getUser();
    if (!user) return new Response("Unauthorized", { status: 401 });

    const [artist] = await db
      .select()
      .from(artists)
      .where(eq(artists.identityId, user.id));
    if (!artist) return new Response("Create an artist profile first", { status: 400 });

    const formData = await req.formData();
    const audioFile = formData.get("audio") as File;
    if (!audioFile) return new Response("No audio file provided", { status: 400 });

    const title = formData.get("title") as string;
    if (!title) return new Response("Title is required", { status: 400 });

    const genre = (formData.get("genre") as string) || "";
    const coverUrl = (formData.get("coverUrl") as string) || "";
    const duration = parseInt((formData.get("duration") as string) || "0") || 0;

    const blobKey = `track_${artist.id}_${Date.now()}_${audioFile.name.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
    const store = getStore("music");
    const buffer = await audioFile.arrayBuffer();
    await store.set(blobKey, new Uint8Array(buffer), {
      metadata: {
        contentType: audioFile.type || "audio/mpeg",
        artistId: String(artist.id),
        title,
      },
    });

    const [track] = await db
      .insert(tracks)
      .values({
        artistId: artist.id,
        title,
        genre,
        coverUrl,
        blobKey,
        duration,
      })
      .returning();

    return Response.json({ ...track, artistName: artist.name }, { status: 201 });
  }

  return new Response("Method not allowed", { status: 405 });
};

export const config: Config = {
  path: "/api/tracks",
};
