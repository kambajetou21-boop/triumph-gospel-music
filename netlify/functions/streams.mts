import type { Config, Context } from "@netlify/functions";
import { getUser } from "@netlify/identity";
import { db } from "../../db/index.js";
import { streams, tracks, artists } from "../../db/schema.js";
import { eq, sql, and, gte } from "drizzle-orm";

export default async (req: Request, context: Context) => {
  if (req.method === "GET") {
    const user = await getUser();
    if (!user) return new Response("Unauthorized", { status: 401 });

    const [artist] = await db
      .select()
      .from(artists)
      .where(eq(artists.identityId, user.id));
    if (!artist) return Response.json({ totalStreams: 0, last30Days: 0, byTrack: [] });

    const artistTracks = await db
      .select({ id: tracks.id, title: tracks.title })
      .from(tracks)
      .where(eq(tracks.artistId, artist.id));

    if (artistTracks.length === 0) {
      return Response.json({ totalStreams: 0, last30Days: 0, byTrack: [] });
    }

    const trackIds = artistTracks.map((t) => t.id);

    const totalResult = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(streams)
      .where(sql`${streams.trackId} = ANY(${trackIds})`);
    const totalStreams = totalResult[0]?.count || 0;

    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const recentResult = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(streams)
      .where(
        and(
          sql`${streams.trackId} = ANY(${trackIds})`,
          gte(streams.createdAt, thirtyDaysAgo)
        )
      );
    const last30Days = recentResult[0]?.count || 0;

    const byTrackResult = await db
      .select({
        trackId: streams.trackId,
        count: sql<number>`count(*)::int`,
      })
      .from(streams)
      .where(sql`${streams.trackId} = ANY(${trackIds})`)
      .groupBy(streams.trackId);

    const trackMap = new Map(artistTracks.map((t) => [t.id, t.title]));
    const byTrack = byTrackResult.map((r) => ({
      title: trackMap.get(r.trackId) || "Unknown",
      count: r.count,
    }));

    return Response.json({ totalStreams, last30Days, byTrack });
  }

  if (req.method === "POST") {
    const body = await req.json();
    const trackId = body.trackId;
    if (!trackId) return new Response("trackId required", { status: 400 });

    const user = await getUser();
    await db.insert(streams).values({
      trackId,
      listenerId: user?.id || null,
    });

    return Response.json({ ok: true });
  }

  return new Response("Method not allowed", { status: 405 });
};

export const config: Config = {
  path: "/api/streams",
};
