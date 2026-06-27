import { NextResponse } from "next/server";
import { groq } from "@/lib/groq";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/prisma";
import { createRequire } from "module";

const require = createRequire(import.meta.url);


const ANALYSIS_PROMPT = (text, userProfile) => `
You are an expert resume reviewer and career coach. Analyze the following resume against the candidate's career goals below.

CANDIDATE'S CAREER PROFILE:
- Current Role: ${userProfile.currentRole || "Not specified"}
- Target Role: ${userProfile.targetRole || "Not specified"}
- Target Level: ${userProfile.targetLevel || "Not specified"}
- Industry: ${userProfile.industry || "Not specified"}
- Years of Experience: ${userProfile.experience ?? "Not specified"}
- Existing Skills: ${userProfile.skills?.length ? userProfile.skills.join(", ") : "Not specified"}

Use the candidate's Target Role, Target Level, and Industry to personalize every section of your analysis. Specifically:
- "missingSkills" must list skills required for the Target Role and Target Level that are NOT already in the resume
- "keywordSuggestions" must be keywords commonly scanned by ATS systems for the Target Role in the given Industry
- "improvements" should explicitly align the resume with the Target Role
- "sectionFeedback.experience" should call out mismatches between current experience and what's expected for the Target Role/Level

Return ONLY a valid JSON object (no markdown, no extra text) with this exact structure:

{
  "overallScore": <integer 0-100 — score the resume's readiness for the TARGET role, not the current role>,
  "scoreLabel": "<one of: Excellent | Good | Average | Needs Improvement>",
  "summary": "<2-3 sentence assessment mentioning the target role fit>",
  "targetRoleFit": "<1-2 sentence verdict on how ready the candidate is for ${userProfile.targetRole || "their target role"}>",
  "strengths": ["<specific strength relevant to the target role>", "<strength>", "<strength>"],
  "improvements": [
    { "area": "<area name>", "issue": "<what's wrong for the target role>", "suggestion": "<how to fix it>" }
  ],
  "missingSkills": ["<skill required for target role but missing>", "<skill>"],
  "atsOptimization": ["<ATS tip specific to target role>", "<tip>"],
  "sectionFeedback": {
    "contactInfo": "<feedback or 'Not found' if missing>",
    "summary": "<feedback on professional summary or 'Missing - strongly recommended'>",
    "experience": "<feedback aligned with target role/level expectations>",
    "education": "<feedback on education section>",
    "skills": "<feedback comparing skills to target role requirements>"
  },
  "formatAndStructure": "<feedback on overall format, length, readability, and structure>",
  "keywordSuggestions": ["<keyword for target role>", "<keyword>", "<keyword>"],
  "actionVerbs": {
    "used": ["<verb found in resume>"],
    "suggested": ["<strong action verb aligned with target role>"]
  },
  "quantificationScore": <integer 0-10 rating of how well achievements are quantified>,
  "quantificationTip": "<specific tip on adding numbers/metrics relevant to target role>"
}

Resume text to analyze:
${text}
`;

export async function POST(request) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const formData = await request.formData();
    const file = formData.get("resume");

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    const allowedTypes = [
      "application/pdf",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    ];

    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json(
        { error: "Unsupported file type. Please upload a PDF or DOCX file." },
        { status: 400 }
      );
    }

    const MAX_SIZE = 5 * 1024 * 1024; // 5MB
    if (file.size > MAX_SIZE) {
      return NextResponse.json(
        { error: "File too large. Maximum size is 5MB." },
        { status: 400 }
      );
    }

    const dbUser = await db.user.findUnique({
      where: { clerkUserId: userId },
      select: {
        role: true,
        targetRole: true,
        targetLevel: true,
        industry: true,
        experience: true,
        skills: true,
      },
    });

    const userProfile = {
      currentRole: dbUser?.role,
      targetRole: dbUser?.targetRole,
      targetLevel: dbUser?.targetLevel,
      industry: dbUser?.industry,
      experience: dbUser?.experience,
      skills: dbUser?.skills,
    };

    const buffer = Buffer.from(await file.arrayBuffer());
    let extractedText = "";

    if (file.type === "application/pdf") {
      const pdfParse = (await import("pdf-parse")).default;

      const data = await pdfParse(buffer);
      extractedText = data.text;
    } else {
      const mammoth = require("mammoth");
      const result = await mammoth.extractRawText({ buffer });
      extractedText = result.value;
    }

    if (!extractedText.trim()) {
      return NextResponse.json(
        { error: "Could not extract text from the file. Make sure the file is not scanned/image-based." },
        { status: 400 }
      );
    }

    const completion = await groq.chat.completions.create({
  model: "llama-3.3-70b-versatile",
  messages: [
    {
      role: "user",
      content: ANALYSIS_PROMPT(extractedText, userProfile),
    },
  ],
  temperature: 0.2,
});

const responseText = completion.choices[0].message.content.trim();

    let analysis;
    try {
      const jsonMatch =
        responseText.match(/```json\s*([\s\S]*?)\s*```/) ||
        responseText.match(/(\{[\s\S]*\})/);
      analysis = JSON.parse(jsonMatch ? jsonMatch[1] : responseText);
    } catch {
      return NextResponse.json(
        { error: "Failed to parse AI analysis. Please try again." },
        { status: 500 }
      );
    }

    return NextResponse.json({ analysis, userProfile });
  }  catch (error) {
    console.error("Resume upload/analysis error:", error);
    console.error("Stack:", error.stack);

    return NextResponse.json(
      {
        error: "Failed to analyze resume. Please try again.",
      },
      { status: 500 }
    );
  }
}
