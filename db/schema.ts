import { pgTable, serial, text, timestamp, integer, boolean } from "drizzle-orm/pg-core";

export const artists = pgTable("artists", {
  id: serial().primaryKey(),
  identityId: text("identity_id").notNull().unique(),
  name: text().notNull(),
  genre: text().default(""),
  bio: text().default(""),
  imageUrl: text("image_url").default(""),
  stripeAccountId: text("stripe_account_id"),
  stripeOnboarded: boolean("stripe_onboarded").default(false),
  createdAt: timestamp("created_at").defaultNow(),
});

export const tracks = pgTable("tracks", {
  id: serial().primaryKey(),
  artistId: integer("artist_id").notNull().references(() => artists.id),
  title: text().notNull(),
  genre: text().default(""),
  coverUrl: text("cover_url").default(""),
  blobKey: text("blob_key").notNull(),
  duration: integer().default(0),
  createdAt: timestamp("created_at").defaultNow(),
});

export const streams = pgTable("streams", {
  id: serial().primaryKey(),
  trackId: integer("track_id").notNull().references(() => tracks.id),
  listenerId: text("listener_id"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const subscriptions = pgTable("subscriptions", {
  id: serial().primaryKey(),
  identityId: text("identity_id").notNull().unique(),
  stripeCustomerId: text("stripe_customer_id"),
  stripeSubscriptionId: text("stripe_subscription_id"),
  status: text().default("inactive"),
  currentPeriodEnd: timestamp("current_period_end"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const payouts = pgTable("payouts", {
  id: serial().primaryKey(),
  artistId: integer("artist_id").notNull().references(() => artists.id),
  amount: integer().notNull(),
  status: text().default("pending"),
  stripeTransferId: text("stripe_transfer_id"),
  createdAt: timestamp("created_at").defaultNow(),
});
