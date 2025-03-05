import { db } from "../db/db";
import { Webhook } from "svix";
import { eq } from "drizzle-orm";
import { users } from "../models/schema";
import { Request, Response } from "express";
import asyncHandler from "../utils/asynHandler";
import APIErrorResponse from "../lib/APIErrorResponse";
import APISuccessResponse from "../lib/APISuccessResponse";

export const handleClerkWebhook = asyncHandler(
  async (req: Request, res: Response) => {
    try {
      console.log("Webhook endpoint hit");
      const WEBHOOK_SECRET = process.env.CLERK_WEBHOOK_SECRET;
      console.log(WEBHOOK_SECRET);

      if (!WEBHOOK_SECRET) {
        throw new APIErrorResponse(500, "Missing Clerk webhook secret");
      }

      const svix_id = req.headers["svix-id"] as string;
      const svix_timestamp = req.headers["svix-timestamp"] as string;
      const svix_signature = req.headers["svix-signature"] as string;

      console.log(svix_id, svix_timestamp, svix_signature);

      if (!svix_id || !svix_timestamp || !svix_signature) {
        throw new APIErrorResponse(400, "Missing svix headers");
      }

      const wh = new Webhook(WEBHOOK_SECRET);

      let payload;
      if (typeof req.body === "string") {
        payload = JSON.parse(req.body);
      } else if (Buffer.isBuffer(req.body)) {
        payload = JSON.parse(req.body.toString("utf8"));
      } else {
        payload = req.body;
      }

      let evt: any = wh.verify(JSON.stringify(payload), {
        "svix-id": svix_id,
        "svix-timestamp": svix_timestamp,
        "svix-signature": svix_signature,
      });

      console.log("Webhook event:", evt.type, evt.data);

      switch (evt.type) {
        case "user.created":
          const userData = evt.data;
          const email = userData.email_addresses?.[0]?.email_address;
          const firstName = userData.first_name;
          const lastName = userData.last_name || "";
          const clerkId = userData.id;
          const profileImage = userData.image_url;

          try {
            const existingUser = await db
              .select()
              .from(users)
              .where(eq(users.email, email))
              .execute();

            if (existingUser.length > 0) {
              console.log(`User with email ${email} already exists.`);
              return null;
            }

            const newUser = await db.insert(users).values({
              clerkId,
              email,
              firstName,
              lastName,
              profileImage,
              isOnboarded: false,
            });

            console.log("User created", newUser);
          } catch (error) {
            console.log(error);
          }
          break;

        case "user.updated":
          const updatedData = evt.data;
          const updatedEmail = updatedData.email_addresses?.[0]?.email_address;
          const updatedFirstName = updatedData.first_name;
          const updatedLastName = updatedData.last_name;
          const updatedClerkId = updatedData.id;
          const updatedProfileImage = updatedData.image_url;
          await db
            .update(users)
            .set({
              email: updatedEmail,
              firstName: updatedFirstName,
              lastName: updatedLastName,
              profileImage: updatedProfileImage,
            })
            .where(eq(users.clerkId, updatedClerkId));
          break;

        case "user.deleted":
          const deletedUserId = evt.data.id;
          await db.delete(users).where(eq(users.clerkId, deletedUserId));
          break;

        default:
          console.log(`Unhandled webhook event type: ${evt.type}`);
      }

      return res
        .status(200)
        .json(
          new APISuccessResponse(
            200,
            { success: true },
            "Webhook processed successfully"
          )
        );
    } catch (error) {
      throw new APIErrorResponse(500, "Webhook processing failed");
    }
  }
);
