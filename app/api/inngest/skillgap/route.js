import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/prisma";
import { groq } from "@/lib/groq";
import { computeRuleBasedGap } from "@/lib/ml/skill-rules";

// Initialize Gemini AI


export async function GET() {
  try {
  if (!process.env.GROQ_API_KEY) {
    console.error("GROQ_API_KEY is not set");

    return NextResponse.json(
      {
        error: "Configuration error",
        details: "GROQ_API_KEY not configured",
      },
      { status: 500 }
    );
  }

    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Fetch user data from database
    const user = await db.user.findUnique({
      where: { clerkUserId: userId },
      select: {
        role: true,
        experience: true,
        targetRole: true,
        targetLevel: true,
        skills: true,
      },
    });

    if (!user) {
      return NextResponse.json(
        {
          error: "User not found",
          message: "User profile not found in database",
        },
        { status: 404 }
      );
    }

    if (!user.role || !user.targetRole) {
      return NextResponse.json(
        {
          error: "Profile incomplete",
          message: "Please complete your profile with current and target roles",
        },
        { status: 400 }
      );
    }

    // Generate skill gap analysis using Gemini AI

    const prompt = `
You are a career development expert. Analyze the skill gap between the following roles:

Current Role: ${user.role}
Experience: ${user.experience ?? 0} years
Target Role: ${user.targetRole}
Target Level: ${user.targetLevel}

Provide a comprehensive skill gap analysis in the following JSON format (ONLY JSON, no markdown):
{
  "radarData": [
    {
      "skill": "Test Automation Frameworks (e.g., Selenium, Cypress)",
      "yourLevel": 3,
      "targetLevel": 8
    },
    {
      "skill": "Manual Testing",
      "yourLevel": 7,
      "targetLevel": 8
    },
    {
      "skill": "API Testing",
      "yourLevel": 4,
      "targetLevel": 7
    },
    {
      "skill": "CI/CD",
      "yourLevel": 2,
      "targetLevel": 6
    },
    {
      "skill": "Bug Tracking Tools (e.g., JIRA)",
      "yourLevel": 8,
      "targetLevel": 8
    }
  ],
  "skillsToDevelop": [
    {
      "name": "Test Automation Frameworks",
      "reason": "Critical gap - Target role requires strong automation skills"
    },
    {
      "name": "CI/CD Integration",
      "reason": "Important for modern QA workflows"
    },
    {
      "name": "API Testing",
      "reason": "Essential for backend quality assurance"
    }
  ],
  "strengths": [
    {
      "name": "Manual Testing",
      "description": "Strong foundation in manual testing processes"
    },
    {
      "name": "Bug Tracking",
      "description": "Excellent use of JIRA and defect management"
    }
  ],
  "learningRoadmap": [
    {
      "phase": "Month 1-2: Automation Fundamentals",
      "description": "Learn Selenium or Cypress basics, write simple test scripts",
      "resources": ["Selenium documentation", "Cypress.io tutorials", "Udemy courses"]
    },
    {
      "phase": "Month 3-4: API Testing",
      "description": "Master Postman, REST API testing, automated API tests",
      "resources": ["Postman learning center", "REST API testing course"]
    },
    {
      "phase": "Month 5-6: CI/CD Integration",
      "description": "Integrate tests into CI/CD pipelines using Jenkins or GitHub Actions",
      "resources": ["Jenkins documentation", "GitHub Actions tutorials"]
    }
  ],
  "summary": "You have a solid foundation in manual testing and bug tracking. To transition to ${user.targetRole}, focus on developing test automation skills (Selenium/Cypress), API testing capabilities, and CI/CD integration knowledge. Your experience with JIRA is a great asset. With 6 months of dedicated learning and practice, you can bridge this gap effectively."
}`;

    const completion = await groq.chat.completions.create({
  model: "llama-3.3-70b-versatile",
  messages: [
    {
      role: "user",
      content: prompt,
    },
  ],
});

const text = completion.choices[0].message.content;

    console.log("Gemini Response:", text); // Debug log

    // Parse the JSON response
    let skillGapAnalysis;
    
    try {
      // Clean the response: remove markdown code blocks and extra whitespace
      let cleanedText = text
        .replace(/```json\n?/g, "")
        .replace(/```\n?/g, "")
        .trim();

      // Try to extract JSON object from the response
      const jsonMatch = cleanedText.match(/\{[\s\S]*\}/);
      
      if (!jsonMatch) {
        throw new Error("No JSON object found in response");
      }

      skillGapAnalysis = JSON.parse(jsonMatch[0]);
    } catch (parseError) {
      console.error("JSON Parse Error:", parseError);
      console.error("Raw response:", text);
      throw new Error(`Failed to parse Gemini response: ${parseError.message}`);
    }

    const ruleBasedGap = computeRuleBasedGap(user.skills || [], user.targetRole || "");

    return NextResponse.json({
      userData: {
        role: user.role,
        experience: user.experience,
        targetRole: user.targetRole,
        targetLevel: user.targetLevel,
      },
      skillGapAnalysis,
      ruleBasedGap,
    });
  } catch (error) {
    console.error("Skill gap analysis error:", error);
    return NextResponse.json(
      {
        error: "Failed to generate skill gap analysis",
        details: error.message,
      },
      { status: 500 }
    );
  }
}