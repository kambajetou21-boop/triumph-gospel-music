import type { Config, Context } from "@netlify/functions";
import { db } from "../../db/index.js";
import { subscriptions, artists } from "../../db/schema.js";
import { eq } from "drizzle-orm";
import Stripe from "stripe";

function getStripe() {
  const key = Netlify.env.get("STRIPE_SECRET_KEY");
  if (!key) throw new Error("STRIPE_SECRET_KEY not configured");
  return new Stripe(key);
}

export default async (req: Request, context: Context) => {
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  const stripe = getStripe();
  const webhookSecret = Netlify.env.get("STRIPE_WEBHOOK_SECRET");
  const sig = req.headers.get("stripe-signature");

  if (!sig || !webhookSecret) {
    return new Response("Missing signature or webhook secret", { status: 400 });
  }

  let event: Stripe.Event;
  try {
    const body = await req.text();
    event = stripe.webhooks.constructEvent(body, sig, webhookSecret);
  } catch {
    return new Response("Invalid signature", { status: 400 });
  }

  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object as Stripe.Checkout.Session;
      if (session.mode === "subscription" && session.metadata?.identityId) {
        const identityId = session.metadata.identityId;
        const subscriptionId = session.subscription as string;

        const sub = await stripe.subscriptions.retrieve(subscriptionId);
        await db
          .update(subscriptions)
          .set({
            stripeSubscriptionId: subscriptionId,
            status: "active",
            currentPeriodEnd: new Date(sub.current_period_end * 1000),
          })
          .where(eq(subscriptions.identityId, identityId));
      }
      break;
    }

    case "customer.subscription.updated": {
      const sub = event.data.object as Stripe.Subscription;
      const customerId = sub.customer as string;

      const [existing] = await db
        .select()
        .from(subscriptions)
        .where(eq(subscriptions.stripeCustomerId, customerId));

      if (existing) {
        await db
          .update(subscriptions)
          .set({
            status: sub.status === "active" ? "active" : sub.status,
            currentPeriodEnd: new Date(sub.current_period_end * 1000),
          })
          .where(eq(subscriptions.stripeCustomerId, customerId));
      }
      break;
    }

    case "customer.subscription.deleted": {
      const sub = event.data.object as Stripe.Subscription;
      const customerId = sub.customer as string;

      await db
        .update(subscriptions)
        .set({ status: "canceled" })
        .where(eq(subscriptions.stripeCustomerId, customerId));
      break;
    }

    case "account.updated": {
      const account = event.data.object as Stripe.Account;
      if (account.charges_enabled && account.details_submitted) {
        await db
          .update(artists)
          .set({ stripeOnboarded: true })
          .where(eq(artists.stripeAccountId, account.id));
      }
      break;
    }
  }

  return Response.json({ received: true });
};

export const config: Config = {
  path: "/api/stripe-webhook",
};
