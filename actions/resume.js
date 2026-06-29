"use server";

import { db } from "@/lib/prisma";
import { auth } from "@clerk/nextjs/server";
import { groq } from "@/lib/groq";
import { revalidatePath } from "next/cache";



export async function saveResume(content) {
  const { userId } = await auth();
  if (!userId) throw new Error("Unauthorized");

  const user = await db.user.findUnique({
    where: { clerkUserId: userId },
  });

  if (!user) throw new Error("User not found");

  try {
    const resume = await db.resume.upsert({
      where: {
        userId: user.id,
      },
      update: {
        content,
      },
      create: {
        userId: user.id,
        content,
      },
    });

    revalidatePath("/resume");
    return resume;
  } catch (error) {
    console.error("Error saving resume:", error);
    throw new Error("Failed to save resume");
  }
}

export async function getResume() {
  const { userId } = await auth();
  if (!userId) throw new Error("Unauthorized");

  const user = await db.user.findUnique({
    where: { clerkUserId: userId },
  });

  if (!user) throw new Error("User not found");

  return await db.resume.findUnique({
    where: {
      userId: user.id,
    },
  });
}

export async function improveWithAI({ current, type }) {
  const { userId } = await auth();
  if (!userId) throw new Error("Unauthorized");

  const user = await db.user.findUnique({
    where: { clerkUserId: userId },
    include: {
      industryInsight: true,
    },
  });

  if (!user) throw new Error("User not found");

  const prompt = `
  You are an expert resume writer. Your job is to improve the PHRASING and LANGUAGE of the user's ${type} description — NOT to add, invent, or assume any new information.

  STRICT RULES:
  1. Only use facts, details, and context that are explicitly present in the user's input.
  2. Do NOT invent metrics, percentages, technologies, tools, team sizes, company names, or outcomes that are not mentioned.
  3. If the input is vague or short (e.g. "I worked on cloud"), improve only the language and structure — do not fill in specifics.
  4. Use strong action verbs and professional language.
  5. Keep the output concise — roughly the same length or slightly longer than the input.
  6. Output only the improved description as plain text. No explanations, no preamble.

  User's original text: "${current}"
`;

  try {
    const completion = await groq.chat.completions.create({
  model: "llama-3.3-70b-versatile",
  messages: [{ role: "user", content: prompt }],
});

const improvedContent = completion.choices[0].message.content.trim();
    return improvedContent;
  } catch (error) {
    console.error("Error improving content:", error);
    throw new Error("Failed to improve content");
  }
}
