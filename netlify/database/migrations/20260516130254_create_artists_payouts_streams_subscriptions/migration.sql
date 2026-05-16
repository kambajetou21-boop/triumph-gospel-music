CREATE TABLE "artists" (
	"id" serial PRIMARY KEY,
	"identity_id" text NOT NULL UNIQUE,
	"name" text NOT NULL,
	"genre" text DEFAULT '',
	"bio" text DEFAULT '',
	"image_url" text DEFAULT '',
	"stripe_account_id" text,
	"stripe_onboarded" boolean DEFAULT false,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "payouts" (
	"id" serial PRIMARY KEY,
	"artist_id" integer NOT NULL,
	"amount" integer NOT NULL,
	"status" text DEFAULT 'pending',
	"stripe_transfer_id" text,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "streams" (
	"id" serial PRIMARY KEY,
	"track_id" integer NOT NULL,
	"listener_id" text,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "subscriptions" (
	"id" serial PRIMARY KEY,
	"identity_id" text NOT NULL UNIQUE,
	"stripe_customer_id" text,
	"stripe_subscription_id" text,
	"status" text DEFAULT 'inactive',
	"current_period_end" timestamp,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "tracks" (
	"id" serial PRIMARY KEY,
	"artist_id" integer NOT NULL,
	"title" text NOT NULL,
	"genre" text DEFAULT '',
	"cover_url" text DEFAULT '',
	"blob_key" text NOT NULL,
	"duration" integer DEFAULT 0,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE "payouts" ADD CONSTRAINT "payouts_artist_id_artists_id_fkey" FOREIGN KEY ("artist_id") REFERENCES "artists"("id");--> statement-breakpoint
ALTER TABLE "streams" ADD CONSTRAINT "streams_track_id_tracks_id_fkey" FOREIGN KEY ("track_id") REFERENCES "tracks"("id");--> statement-breakpoint
ALTER TABLE "tracks" ADD CONSTRAINT "tracks_artist_id_artists_id_fkey" FOREIGN KEY ("artist_id") REFERENCES "artists"("id");