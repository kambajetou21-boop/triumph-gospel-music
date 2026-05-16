import type { Config, Context } from "@netlify/functions";
import { getUser } from "@netlify/identity";
import { db } from "../../db/index.js";
import { subscriptions } from "../../db/schema.js";
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

  if (req.method === "GET") {
    const [sub] = await db
      .select()
      .from(subscriptions)
      .where(eq(subscriptions.identityId, user.id));

    if (!sub || sub.status !== "active") {
      return Response.json({ subscribed: false });
    }
    return Response.json({
      subscribed: true,
      status: sub.status,
      currentPeriodEnd: sub.currentPeriodEnd,
    });
  }

  if (req.method === "POST") {
    const [existing] = await db
      .select()
      .from(subscriptions)
      .where(eq(subscriptions.identityId, user.id));

    if (existing && existing.status === "active") {
      return Response.json({ alreadySubscribed: true });
    }

    const stripe = getStripe();
    const priceId = Netlify.env.get("STRIPE_PRICE_ID");
    if (!priceId) return new Response("STRIPE_PRICE_ID not configured", { status: 500 });

    const siteUrl = Netlify.env.get("URL") || "https://triumphgospelmusi.netlify.app";

    let customerId = existing?.stripeCustomerId;
    if (!customerId) {
      const customer = await stripe.customers.create({ email: user.email });
      customerId = customer.id;
    }

    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      mode: "subscription",
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${siteUrl}/#/subscribe?success=true`,
      cancel_url: `${siteUrl}/#/subscribe?canceled=true`,
      metadata: { identityId: user.id },
    });

    if (!existing) {
      await db.insert(subscriptions).values({
        identityId: user.id,
        stripeCustomerId: customerId,
        status: "pending",
      });
    } else if (!existing.stripeCustomerId) {
      await db
        .update(subscriptions)
        .set({ stripeCustomerId: customerId })
        .where(eq(subscriptions.identityId, user.id));
    }

    return Response.json({ url: session.url });
  }

  return new Response("Method not allowed", { status: 405 });
};

export const config: Config = {
  path: "/api/subscribe",
};
