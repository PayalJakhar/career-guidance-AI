import { db } from "@/lib/prisma";
import { inngest } from "./client";
import { groq } from "@/lib/groq";
import { computeRuleBasedGap } from "@/lib/ml/skill-rules";
import { buildVocabulary, tokenize, vectorize, cosineUnit } from "@/lib/ml/tfidf";



// ── Shared pipeline logic (used by both event-triggered and cron runs) ────────

async function runPipelineForUser(user, step) {
  // Step 2: Extract skills from resume text via Gemini
  const extractedSkills = await step.run(
    `extract-resume-skills-${user.id}`,
    async () => {
      if (!user.resume?.content) return [];
      const prompt = `Extract technical and professional skills from this resume. Return ONLY a JSON array of skill name strings, nothing else.\n\nResume:\n${user.resume.content.slice(0, 3000)}`;
      try {
        const res = await model.generateContent(prompt);
        const text = res.response.candidates[0].content.parts[0].text || "[]";
        return JSON.parse(text.replace(/```(?:json)?\n?/g, "").trim());
      } catch {
        return [];
      }
    }
  );

  // Step 3: Rule-based skill gap (combined profile + resume skills)
  const combinedSkills = [...new Set([...(user.skills || []), ...extractedSkills])];
  const gapResult = await step.run(`compute-rule-based-gap-${user.id}`, async () => {
    return computeRuleBasedGap(combinedSkills, user.targetRole);
  });

  // Step 4: TF-IDF course recommendations
  const topCourses = await step.run(`recommend-courses-tfidf-${user.id}`, async () => {
    const allCourses = await db.course.findMany({ take: 100 });
    if (!allCourses.length) return [];

    const missingSkills = gapResult.missingSkills.length
      ? gapResult.missingSkills
      : [user.targetRole];

    const queryText = `${user.targetRole} ${missingSkills.join(" ")}`;
    const courseTexts = allCourses.map(
      (c) => `${c.title} ${c.description} ${c.skills.join(" ")}`
    );
    const { vocab, idf, tokenized } = buildVocabulary(courseTexts);
    const courseVectors = tokenized.map((t) => vectorize(t, vocab, idf));
    const qVec = vectorize(tokenize(queryText), vocab, idf);

    return allCourses
      .map((c, i) => ({
        title: c.title,
        score: Math.round(cosineUnit(qVec, courseVectors[i]) * 100),
      }))
      .sort((a, b) => b.score - a.score)
      .slice(0, 5);
  });

  // Step 5: Generate personalized AI career insight
  const insight = await step.run(`generate-career-insight-${user.id}`, async () => {
    const missingList = gapResult.missingSkills.slice(0, 5).join(", ") || "none identified";
    const courseList  = topCourses.slice(0, 3).map((c) => c.title).join(", ");
    const prompt = `You are a career coach. Write a concise 3-sentence personalized career insight for this user.

Target Role: ${user.targetRole}
Current Role: ${user.role || "Not specified"}
Skill Match: ${gapResult.similarityScore}%
Missing Skills: ${missingList}
Top Recommended Courses: ${courseList}

Be specific, actionable, and encouraging. Focus on the gap and the most important next step.`;
    try {
      const res = await model.generateContent(prompt);
      return res.response.candidates[0].content.parts[0].text?.trim() || "";
    } catch {
      return "";
    }
  });

  // Step 6: Persist results to DB
  await step.run(`save-pipeline-results-${user.id}`, async () => {
    await db.user.update({
      where: { id: user.id },
      data: {
        pipelineInsight: insight || null,
        pipelineRanAt:   new Date(),
      },
    });
  });

  return {
    matchedRole:          gapResult.matchedRole,
    similarityScore:      gapResult.similarityScore,
    missingSkillsCount:   gapResult.missingSkills.length,
    extractedSkillsCount: extractedSkills.length,
    topCourses,
    insightGenerated:     !!insight,
  };
}

// ── 1. Event-triggered pipeline (fires on profile completion) ─────────────────

export const runCareerPipeline = inngest.createFunction(
  { name: "Career Pipeline Agent", id: "career-pipeline" },
  { event: "user/profile.completed" },
  async ({ event, step }) => {
    const { clerkUserId } = event.data;

    const user = await step.run("fetch-user-profile", async () => {
      return await db.user.findUnique({
        where: { clerkUserId },
        select: {
          id: true,
          clerkUserId: true,
          skills: true,
          targetRole: true,
          targetLevel: true,
          role: true,
          industry: true,
          resume: { select: { content: true } },
        },
      });
    });

    if (!user || !user.targetRole) {
      return { status: "skipped", reason: "incomplete profile" };
    }

    const result = await runPipelineForUser(user, step);
    return { status: "completed", clerkUserId, ...result };
  }
);

// ── 2. Weekly cron pipeline (every Monday 9am UTC — runs for ALL users) ───────

export const weeklyCareerPipeline = inngest.createFunction(
  { name: "Weekly Career Pipeline", id: "weekly-career-pipeline" },
  { cron: "0 9 * * 1" },
  async ({ step }) => {
    const users = await step.run("fetch-eligible-users", async () => {
      return await db.user.findMany({
        where: { targetRole: { not: null }, isOnboarded: true },
        select: {
          id: true,
          clerkUserId: true,
          skills: true,
          targetRole: true,
          role: true,
          resume: { select: { content: true } },
        },
      });
    });

    if (!users.length) return { triggered: 0 };

    // Fan out — send one pipeline event per user so each runs independently
    for (const u of users) {
      await step.sendEvent(`trigger-pipeline-${u.clerkUserId}`, {
        name: "user/profile.completed",
        data: { clerkUserId: u.clerkUserId },
      });
    }

    return { triggered: users.length };
  }
);

// ── 3. Industry insights cron (unchanged) ────────────────────────────────────

export const generateIndustryInsights = inngest.createFunction(
  { name: "Generate Industry Insights" },
  { cron: "0 0 * * 0" },
  async ({ event, step }) => {
    const industries = await step.run("Fetch industries", async () => {
      return await db.industryInsight.findMany({
        select: { industry: true },
      });
    });

    for (const { industry } of industries) {
      const prompt = `
          Analyze the current state of the ${industry} industry and provide insights in ONLY the following JSON format without any additional notes or explanations:
          {
            "salaryRanges": [
              { "role": "string", "min": number, "max": number, "median": number, "location": "string" }
            ],
            "growthRate": number,
            "demandLevel": "High" | "Medium" | "Low",
            "topSkills": ["skill1", "skill2"],
            "marketOutlook": "Positive" | "Neutral" | "Negative",
            "keyTrends": ["trend1", "trend2"],
            "recommendedSkills": ["skill1", "skill2"]
          }

          IMPORTANT: Return ONLY the JSON. No additional text, notes, or markdown formatting.
          Include at least 5 common roles for salary ranges.
          Growth rate should be a percentage.
          Include at least 5 skills and trends.
        `;

      const res = await step.ai.wrap(
        "gemini",
        async (p) => {
          return await model.generateContent(p);
        },
        prompt
      );

      const text = res.response.candidates[0].content.parts[0].text || "";
      const cleanedText = text.replace(/```(?:json)?\n?/g, "").trim();
      const insights = JSON.parse(cleanedText);

      await step.run(`Update ${industry} insights`, async () => {
        await db.industryInsight.update({
          where: { industry },
          data: {
            ...insights,
            lastUpdated: new Date(),
            nextUpdate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
          },
        });
      });
    }
  }
);
