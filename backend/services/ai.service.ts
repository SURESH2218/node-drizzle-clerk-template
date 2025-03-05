import { GoogleGenerativeAI } from "@google/generative-ai";
import { specializations } from "../models/schema";
import { db } from "../db/db";
import APIErrorResponse from "../lib/APIErrorResponse";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY as string);

export const categorizePost = async (title: string, content: string) => {
  try {
    // Get all specializations
    const allSpecializations = await db
      .select({
        id: specializations.id,
        name: specializations.name,
      })
      .from(specializations);

    // Create prompt for Gemini
    const prompt = `
      Given the following post title and content, determine which category it best fits into.
      Available categories are: ${allSpecializations
        .map((s) => s.name)
        .join(", ")}
      
      Post Title: ${title}
      Post Content: ${content}
      
      Return only the name of the most appropriate category from the list above.
    `;

    // Get Gemini model - using the correct model name from documentation
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

    // Generate response
    const result = await model.generateContent(prompt);
    const category = result.response.text().trim();

    // Find matching specialization
    const matchedSpecialization = allSpecializations.find(
      (s) => s.name.toLowerCase() === category.toLowerCase()
    );

    if (!matchedSpecialization) {
      throw new APIErrorResponse(400, "Unable to categorize post");
    }

    return matchedSpecialization.id;
  } catch (error) {
    console.error("AI Categorization Error:", error);
    throw new APIErrorResponse(500, "Failed to categorize post");
  }
};
