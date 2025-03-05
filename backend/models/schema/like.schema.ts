import { pgTable, integer, timestamp } from "drizzle-orm/pg-core";
import { users } from "./user.schema";
import { posts } from "./post.schema";
import { relations } from "drizzle-orm";

export const postLikes = pgTable("post_likes", {
  postId: integer("post_id")
    .notNull()
    .references(() => posts.id),
  userId: integer("user_id")
    .notNull()
    .references(() => users.id),
  createdAt: timestamp("created_at").defaultNow(),
});

export const postLikesRelations = relations(postLikes, ({ one }) => ({
  user: one(users, {
    fields: [postLikes.userId],
    references: [users.id],
  }),
  post: one(posts, {
    fields: [postLikes.postId],
    references: [posts.id],
  }),
}));
