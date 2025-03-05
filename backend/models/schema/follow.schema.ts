import { pgTable, integer, timestamp, primaryKey } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { users } from "./user.schema";

export const follows = pgTable(
  "follows",
  {
    followerId: integer("follower_id")
      .references(() => users.id)
      .notNull(),
    followingId: integer("following_id")
      .references(() => users.id)
      .notNull(),
    createdAt: timestamp("created_at").defaultNow(),
  },
  (table) => {
    return {
      uniqueFollow: primaryKey(table.followerId, table.followingId),
    };
  }
);

export const followsRelations = relations(follows, ({ one }) => ({
  follower: one(users, {
    fields: [follows.followerId],
    references: [users.id],
    relationName: "following",
  }),
  following: one(users, {
    fields: [follows.followingId],
    references: [users.id],
    relationName: "followers",
  }),
}));
