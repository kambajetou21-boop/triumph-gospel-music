import type { Config, Context } from "@netlify/functions";
import { getUser } from "@netlify/identity";
import { db } from "../../db/index.js";
import { artists } from "../../db/schema.js";
import { eq } from "drizzle-orm";

export default async (req: Request, context: Context) => {
  if (req.method === "GET") {
    const id = context.params?.id;
    if (id) {
      const [artist] = await db.select().from(artists).where(eq(artists.id, parseInt(id)));
      if (!artist) return new Response("Artist not found", { status: 404 });
      return Response.json(artist);
    }
    const all = await db.select().from(artists);
    return Response.json(all);
  }

  if (req.method === "POST") {
    const user = await getUser();
    if (!user) return new Response("Unauthorized", { status: 401 });

    const body = await req.json();
    const existing = await db.select().from(artists).where(eq(artists.identityId, user.id));

    if (existing.length > 0) {
      const [updated] = await db
        .update(artists)
        .set({
          name: body.name,
          genre: body.genre || "",
          bio: body.bio || "",
          imageUrl: body.imageUrl || "",
        })
        .where(eq(artists.identityId, user.id))
        .returning();
      return Response.json(updated);
    }

    const [created] = await db
      .insert(artists)
      .values({
        identityId: user.id,
        name: body.name,
        genre: body.genre || "",
        bio: body.bio || "",
        imageUrl: body.imageUrl || "",
      })
      .returning();
    return Response.json(created, { status: 201 });
  }

  return new Response("Method not allowed", { status: 405 });
};

export const config: Config = {
  path: ["/api/artists", "/api/artists/:id"],
};
