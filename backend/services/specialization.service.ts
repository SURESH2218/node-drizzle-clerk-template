// services/specialization.service.ts

import { db } from "../db/db";
import { specializations, userSpecializations, users } from "../models/schema";
import { eq, and, inArray } from "drizzle-orm";
import APIErrorResponse from "../lib/APIErrorResponse";

// Get all specializations
export const getAllSpecializations = async () => {
  const allSpecializations = await db
    .select()
    .from(specializations)
    .orderBy(specializations.name);

  return allSpecializations;
};

// Get user specializations
export const getUserSpecializations = async (userId: number) => {
  const userSpecs = await db
    .select({
      id: specializations.id,
      name: specializations.name,
      description: specializations.description,
    })
    .from(userSpecializations)
    .innerJoin(
      specializations,
      eq(userSpecializations.specializationId, specializations.id)
    )
    .where(eq(userSpecializations.userId, userId));

  return userSpecs;
};

// Set user specializations
export const setUserSpecializations = async (
  userId: number,
  specializationIds: number[]
) => {
  // Validate specializationIds
  const validSpecializations = await db
    .select()
    .from(specializations)
    .where(inArray(specializations.id, specializationIds));

  if (validSpecializations.length !== specializationIds.length) {
    throw new APIErrorResponse(400, "Invalid specialization IDs provided");
  }

  // Begin transaction
  try {
    await db.transaction(async (tx) => {
      // Delete existing specializations
      await tx
        .delete(userSpecializations)
        .where(eq(userSpecializations.userId, userId));

      // Insert new specializations
      for (const specId of specializationIds) {
        await tx.insert(userSpecializations).values({
          userId,
          specializationId: specId,
        });
      }

      // Update user onboarding status
      await tx
        .update(users)
        .set({ isOnboarded: true })
        .where(eq(users.id, userId));
    });

    return await getUserSpecializations(userId);
  } catch (error) {
    throw new APIErrorResponse(500, "Failed to set user specializations");
  }
};

// Check if user has completed specialization selection
export const hasUserCompletedOnboarding = async (userId: number) => {
  const user = await db
    .select({ isOnboarded: users.isOnboarded })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  return user[0]?.isOnboarded || false;
};
