"use server";

import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/prisma";
import { groq } from "@/lib/groq";

export async function getJobListings() {
  const { userId } = await auth();
  if (!userId) throw new Error("Unauthorized");

  const user = await db.user.findUnique({
    where: { clerkUserId: userId },
    select: {
      targetRole: true,
      experience: true,
      skills: true,
      industry: true,
      targetLevel: true,
      role: true,
    },
  });

  if (!user?.targetRole) {
    throw new Error("Please set a target role in your profile to see job listings.");
  }

  const prompt = `Generate a list of realistic current job openings for a "${user.targetRole}".
Candidate profile:
- Experience: ${user.experience ?? 2} years
- Current role: ${user.role || "Not specified"}
- Skills: ${(user.skills || []).slice(0, 8).join(", ") || "General"}
- Level: ${user.targetLevel || "Mid-level"}
- Industry: ${user.industry || "Technology"}

Generate exactly 12 jobs:
- 6 jobs in India (use cities: Bangalore, Mumbai, Hyderabad, Pune, Delhi NCR, Chennai)
- 6 jobs internationally (use: San Francisco USA, London UK, Berlin Germany, Toronto Canada, Singapore, Sydney Australia)

Return ONLY a valid JSON array, no extra text or markdown. Use this exact structure:
[
  {
    "id": "1",
    "title": "exact job title",
    "company": "real well-known company name",
    "location": "City, Country",
    "region": "India",
    "salary": "₹20-30 LPA",
    "type": "Full-time",
    "experience": "2-4 years",
    "skills": ["skill1", "skill2", "skill3", "skill4"],
    "description": "Two-sentence job description highlighting key responsibilities.",
    "posted": "2 days ago",
    "applyUrl": "https://careers.company.com"
  }
]

Rules:
- "region" must be exactly "India" or "International"
- For India: salary in LPA (₹X-Y LPA), use companies like TCS, Infosys, Wipro, Google India, Microsoft India, Amazon India, Flipkart, Swiggy, Zomato, PhonePe, Razorpay, Freshworks, Zoho, etc.
- For International: salary in USD/GBP/EUR, use companies like Google, Meta, Amazon, Microsoft, Apple, Netflix, Stripe, Shopify, Spotify, etc.
- "type" must be one of: Full-time, Remote, Hybrid
- "posted" should vary: 1 day ago, 2 days ago, 3 days ago, 1 week ago, 2 weeks ago
- Skills should match the role requirements
- applyUrl should be the real careers page of the company`;

  try {
   const completion = await groq.chat.completions.create({
  model: "llama-3.3-70b-versatile",
  messages: [{ role: "user", content: prompt }],
});

const text = completion.choices[0].message.content;
    const cleaned = text.replace(/```(?:json)?\n?/g, "").trim();
    const jobs = JSON.parse(cleaned);
    return {
      jobs,
      profile: {
        targetRole: user.targetRole,
        experience:  user.experience,
        targetLevel: user.targetLevel,
      },
    };
  } catch (error) {
    console.error("Job generation error:", error);
    throw new Error("Failed to fetch job listings. Please try again.");
  }
}
