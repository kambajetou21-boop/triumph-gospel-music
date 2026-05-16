import type { Config, Context } from "@netlify/functions";
import { getUser } from "@netlify/identity";
import { db } from "../../db/index.js";
import { payouts, artists, streams, tracks } from "../../db/schema.js";
import { eq, sql, desc } from "drizzle-orm";
import Stripe from "stripe";

const RATE_PER_STREAM_CENTS = 0.4; // $0.004 per stream

function getStripe() {
  const key = Netlify.env.get("STRIPE_SECRET_KEY");
  if (!key) throw new Error("STRIPE_SECRET_KEY not configured");
  return new Stripe(key);
}

export default async (req: Request, context: Context) => {
  const user = await getUser();
  if (!user) return new Response("Unauthorized", { status: 401 });

  const [artist] = await db
    .select()
    .from(artists)
    .where(eq(artists.identityId, user.id));
  if (!artist) return Response.json({ payouts: [], pendingEarnings: 0, stripeConnected: false });

  if (req.method === "GET") {
    const artistTracks = await db
      .select({ id: tracks.id })
      .from(tracks)
      .where(eq(tracks.artistId, artist.id));

    let totalStreamCount = 0;
    if (artistTracks.length > 0) {
      const trackIds = artistTracks.map((t) => t.id);
      const result = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(streams)
        .where(sql`${streams.trackId} = ANY(${trackIds})`);
      totalStreamCount = result[0]?.count || 0;
    }

    const paidOut = await db
      .select({ total: sql<number>`coalesce(sum(${payouts.amount}), 0)::int` })
      .from(payouts)
      .where(eq(payouts.artistId, artist.id));
    const totalPaid = paidOut[0]?.total || 0;

    const totalEarned = Math.floor(totalStreamCount * RATE_PER_STREAM_CENTS);
    const pendingEarnings = Math.max(0, totalEarned - totalPaid);

    const payoutList = await db
      .select()
      .from(payouts)
      .where(eq(payouts.artistId, artist.id))
      .orderBy(desc(payouts.createdAt));

    return Response.json({
      payouts: payoutList,
      pendingEarnings,
      stripeConnected: artist.stripeOnboarded || false,
    });
  }

  if (req.method === "POST") {
    if (!artist.stripeAccountId || !artist.stripeOnboarded) {
      return new Response("Stripe Connect not set up", { status: 400 });
    }

    const artistTracks = await db
      .select({ id: tracks.id })
      .from(tracks)
      .where(eq(tracks.artistId, artist.id));

    let totalStreamCount = 0;
    if (artistTracks.length > 0) {
      const trackIds = artistTracks.map((t) => t.id);
      const result = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(streams)
        .where(sql`${streams.trackId} = ANY(${trackIds})`);
      totalStreamCount = result[0]?.count || 0;
    }

    const paidOut = await db
      .select({ total: sql<number>`coalesce(sum(${payouts.amount}), 0)::int` })
      .from(payouts)
      .where(eq(payouts.artistId, artist.id));
    const totalPaid = paidOut[0]?.total || 0;

    const totalEarned = Math.floor(totalStreamCount * RATE_PER_STREAM_CENTS);
    const pendingEarnings = Math.max(0, totalEarned - totalPaid);

    if (pendingEarnings < 100) {
      return new Response("Minimum payout is $1.00", { status: 400 });
    }

    const stripe = getStripe();

    try {
      const transfer = await stripe.transfers.create({
        amount: pendingEarnings,
        currency: "usd",
        destination: artist.stripeAccountId,
        description: `Triumph payout for ${artist.name}`,
      });

      const [payout] = await db
        .insert(payouts)
        .values({
          artistId: artist.id,
          amount: pendingEarnings,
          status: "completed",
          stripeTransferId: transfer.id,
        })
        .returning();

      return Response.json(payout);
    } catch (err: any) {
      const [payout] = await db
        .insert(payouts)
        .values({
          artistId: artist.id,
          amount: pendingEarnings,
          status: "failed",
        })
        .returning();

      return new Response(err.message || "Payout failed", { status: 500 });
    }
  }

  return new Response("Method not allowed", { status: 405 });
};

export const config: Config = {
  path: "/api/payouts",
};
