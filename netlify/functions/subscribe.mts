import { getUser } from "@netlify/identity";
import { getDatabase } from "@netlify/database";
import type { Config, Context } from "@netlify/functions";

export default async (req: Request, context: Context) => {
  const user = await getUser();

  if (req.method === "GET") {
    if (!user) {
      return Response.json({ subscribed: false });
    }

    const db = getDatabase();
    const result = await db.sql`
      SELECT id, status, plan, amount, created_at
      FROM subscriptions
      WHERE identity_id = ${user.id} AND status = 'active'
      LIMIT 1
    `;

    return Response.json({ subscribed: result.rows.length > 0 });
  }

  if (req.method === "POST") {
    if (!user) {
      return new Response("Unauthorized", { status: 401 });
    }

    const db = getDatabase();
    const existing = await db.sql`
      SELECT id FROM subscriptions
      WHERE identity_id = ${user.id} AND status = 'active'
      LIMIT 1
    `;

    if (existing.rows.length > 0) {
      return Response.json({ alreadySubscribed: true });
    }

    await db.sql`
      INSERT INTO subscriptions (identity_id, email, status, plan, amount)
      VALUES (${user.id}, ${user.email}, 'active', 'premium', 499)
      ON CONFLICT (identity_id) DO UPDATE
      SET status = 'active', updated_at = NOW()
    `;

    const siteUrl = context.site.url || new URL(req.url).origin;
    return Response.json({ url: `${siteUrl}/#/subscribe?success=true` });
  }

  return new Response("Method not allowed", { status: 405 });
};

export const config: Config = {
  path: "/api/subscribe",
};
