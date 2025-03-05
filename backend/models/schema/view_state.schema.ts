import {
  integer,
  pgTable,
  timestamp,
  boolean,
  jsonb,
  text,
  serial,
} from "drizzle-orm/pg-core";
import { posts } from "./post.schema";
import { users } from "./user.schema";

export const viewStates = pgTable("view_states", {
  id: serial("id").primaryKey(),
  userId: integer("user_id")
    .references(() => users.id)
    .notNull(),
  postId: integer("post_id")
    .references(() => posts.id)
    .notNull(),

  // View Status
  viewStatus: text("view_status", {
    enum: ["unseen", "impression", "partial_view", "complete_view"],
  })
    .notNull()
    .default("unseen"),
  readPercentage: integer("read_percentage").default(0),

  // Timing
  firstViewedAt: timestamp("first_viewed_at").notNull(),
  lastViewedAt: timestamp("last_viewed_at").notNull(),
  totalViewDuration: integer("total_view_duration").default(0), // in seconds

  // Scroll Position
  lastScrollPosition: integer("last_scroll_position").default(0),
  maxScrollPosition: integer("max_scroll_position").default(0),

  // Interaction Flags
  hasLiked: boolean("has_liked").default(false),
  hasCommented: boolean("has_commented").default(false),
  hasShared: boolean("has_shared").default(false),
  hasSaved: boolean("has_saved").default(false),

  // Interaction Details
  interactionHistory: jsonb("interaction_history").default([]),

  // Device Info
  deviceType: text("device_type"),
  viewportHeight: integer("viewport_height"),

  // Metadata
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// Types for TypeScript
export type ViewState = typeof viewStates.$inferSelect;
export type NewViewState = typeof viewStates.$inferInsert;

// Interaction History Type
export interface InteractionEvent {
  type: "scroll" | "like" | "comment" | "share" | "save" | "view";
  timestamp: Date;
  data?: {
    scrollPosition?: number;
    viewDuration?: number;
    deviceType?: string;
  };
}