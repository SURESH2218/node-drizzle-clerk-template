CREATE TABLE "view_states" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"post_id" integer NOT NULL,
	"view_status" text DEFAULT 'unseen' NOT NULL,
	"read_percentage" integer DEFAULT 0,
	"first_viewed_at" timestamp NOT NULL,
	"last_viewed_at" timestamp NOT NULL,
	"total_view_duration" integer DEFAULT 0,
	"last_scroll_position" integer DEFAULT 0,
	"max_scroll_position" integer DEFAULT 0,
	"has_liked" boolean DEFAULT false,
	"has_commented" boolean DEFAULT false,
	"has_shared" boolean DEFAULT false,
	"has_saved" boolean DEFAULT false,
	"interaction_history" jsonb DEFAULT '[]'::jsonb,
	"device_type" text,
	"viewport_height" integer,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "view_states" ADD CONSTRAINT "view_states_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "view_states" ADD CONSTRAINT "view_states_post_id_posts_id_fk" FOREIGN KEY ("post_id") REFERENCES "public"."posts"("id") ON DELETE no action ON UPDATE no action;