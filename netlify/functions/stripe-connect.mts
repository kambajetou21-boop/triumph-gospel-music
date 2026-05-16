import type { Config, Context } from "@netlify/functions";
import { getUser } from "@netlify/identity";
import { db } from "../../db/index.js";
import { artists } from "../../db/schema.js";
import { eq } from "drizzle-orm";
import Stripe from "stripe";

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
  if (!artist) return new Response("Create an artist profile first", { status: 400 });

  if (req.method === "GET") {
    return Response.json({
      connected: !!artist.stripeAccountId,
      onboarded: artist.stripeOnboarded || false,
    });
  }

  if (req.method === "POST") {
    if (artist.stripeOnboarded) {
      return Response.json({ alreadyOnboarded: true });
    }

    const stripe = getStripe();
    const siteUrl = Netlify.env.get("URL") || "https://triumphgospelmusi.netlify.app";

    let accountId = artist.stripeAccountId;

    if (!accountId) {
      const account = await stripe.accounts.create({
        type: "express",
        email: user.email,
        capabilities: {
          transfers: { requested: true },
        },
        metadata: { identityId: user.id, artistId: String(artist.id) },
      });
      accountId = account.id;

      await db
        .update(artists)
        .set({ stripeAccountId: accountId })
        .where(eq(artists.id, artist.id));
    }

    const accountLink = await stripe.accountLinks.create({
      account: accountId,
      refresh_url: `${siteUrl}/#/dashboard`,
      return_url: `${siteUrl}/#/dashboard`,
      type: "account_onboarding",
    });

    return Response.json({ url: accountLink.url });
  }

  return new Response("Method not allowed", { status: 405 });
};

export const config: Config = {
  path: "/api/stripe-connect",
};
