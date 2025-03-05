import { db } from "../db/db";
import { specializations } from "../models/schema";

const SPECIALIZATIONS = [
  {
    name: "Chemistry",
    description: "Chemical sciences and research in pharmaceutical domain",
  },
  {
    name: "Biology",
    description: "Biological sciences and research",
  },
  {
    name: "Pharmacy",
    description: "Pharmaceutical sciences and drug studies",
  },
  {
    name: "Drug Development",
    description: "Research and development of new drugs",
  },
  {
    name: "Clinical Trials",
    description: "Clinical research and trial studies",
  },
  {
    name: "Research Methodology",
    description: "Scientific research methods and practices",
  },
  {
    name: "Market Research",
    description: "Pharmaceutical market analysis and research",
  },
  {
    name: "Conference Updates",
    description: "Scientific conference and event information",
  },
  {
    name: "Job Opportunities",
    description: "Career opportunities in scientific field",
  },
];

async function seedSpecializations() {
  try {
    for (const spec of SPECIALIZATIONS) {
      await db
        .insert(specializations)
        .values(spec)
        .onConflictDoNothing({ target: specializations.name });
    }
    console.log("✅ Specializations seeded successfully");
  } catch (error) {
    console.error("❌ Error seeding specializations:", error);
    throw error;
  }
}

async function main() {
  try {
    await seedSpecializations();
  } catch (error) {
    console.error("Failed to seed database:", error);
    process.exit(1);
  }
}

main();
