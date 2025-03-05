import {
  pgTable,
  serial,
  varchar,
  text,
  timestamp,
  integer,
  primaryKey,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { users } from "./user.schema";
import { posts } from "./post.schema";

// Specializations table
export const specializations = pgTable("specializations", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 100 }).notNull().unique(),
  description: text("description"),
  createdAt: timestamp("created_at").defaultNow(),
});

// Junction table for user specializations (many-to-many)
export const userSpecializations = pgTable(
  "user_specializations",
  {
    userId: integer("user_id").references(() => users.id),
    specializationId: integer("specialization_id").references(
      () => specializations.id
    ),
    createdAt: timestamp("created_at").defaultNow(),
  },
  (table) => {
    return {
      pk: primaryKey(table.userId, table.specializationId),
    };
  }
);

// Relations
export const specializationsRelations = relations(
  specializations,
  ({ many }) => ({
    users: many(userSpecializations),
    posts: many(posts),
  })
);

export const userSpecializationsRelations = relations(
  userSpecializations,
  ({ one }) => ({
    user: one(users, {
      fields: [userSpecializations.userId],
      references: [users.id],
    }),
    specialization: one(specializations, {
      fields: [userSpecializations.specializationId],
      references: [specializations.id],
    }),
  })
);
