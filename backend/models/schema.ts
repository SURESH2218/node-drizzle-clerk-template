import { pgTable, serial, text, varchar, timestamp } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  firstName: text("first_name").notNull(),
  lastName: text("last_name").notNull(),
  email: varchar("email", { length: 255 }).unique(),
  clerkId: varchar("clerk_id", { length: 255 }).notNull(),
  createdAt: timestamp("created_at").defaultNow(),
  profileImage: text("image_url"),
});

export const images = pgTable("images", {
  id: serial("id").primaryKey(),
  url: text("url").notNull(),
  cloudinaryId: text("cloudinary_id").notNull(),
  userId: varchar("user_id", { length: 255 }).notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const usersRelations = relations(users, ({ many }) => ({
  images: many(images),
}));

export const imagesRelations = relations(images, ({ one }) => ({
  user: one(users, {
    fields: [images.userId],
    references: [users.clerkId],
  }),
}));
