import {
  pgTable,
  serial,
  text,
  varchar,
  timestamp,
  boolean,
  integer,
  primaryKey,
} from "drizzle-orm/pg-core";
import { posts } from "./post.schema";
import { comments } from "./comment.schema";
import { relations } from "drizzle-orm";
import { follows } from "./follow.schema";

// Your existing tables remain unchanged
export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  firstName: text("first_name").notNull(),
  lastName: text("last_name"),
  email: varchar("email", { length: 255 }).unique(),
  clerkId: varchar("clerk_id", { length: 255 }).notNull(),
  createdAt: timestamp("created_at").defaultNow(),
  profileImage: text("image_url"),
  isOnboarded: boolean("is_onboarded").default(false), // new field for onboarding status
});

export const images = pgTable("images", {
  id: serial("id").primaryKey(),
  url: text("url").notNull(),
  cloudinaryId: text("cloudinary_id").notNull(),
  userId: varchar("user_id", { length: 255 }).notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

// Update relations to include new entities
export const usersRelations = relations(users, ({ many }) => ({
  images: many(images),
  posts: many(posts),
  comments: many(comments),
  followers: many(follows, {
    fields: [users.id],
    references: [follows.followingId],
    relationName: "followers",
  }),
  following: many(follows, {
    fields: [users.id],
    references: [follows.followerId],
    relationName: "following",
  }),
}));

export const imagesRelations = relations(images, ({ one }) => ({
  user: one(users, {
    fields: [images.userId],
    references: [users.clerkId],
  }),
}));
