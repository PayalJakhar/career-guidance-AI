import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/prisma";
import { redirect } from "next/navigation";

export default async function ProfilePage() {
  const { userId } = await auth();

  if (!userId) redirect("/");

  const user = await db.user.findUnique({
    where: { clerkUserId: userId },
  });

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-neutral-950 text-neutral-400">
        Profile not found
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-neutral-950 text-white px-6 py-10">
      <div className="max-w-5xl mx-auto space-y-6">

        {/* PAGE TITLE */}
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Profile</h1>
          <p className="text-sm text-neutral-500 mt-1">
            Your professional details at a glance
          </p>
        </div>

        {/* MAIN GRID */}
        <div className="grid grid-cols-1 lg:grid-cols-[260px_1fr] gap-5">

          {/* LEFT PROFILE CARD */}
          <div className="rounded-2xl border border-neutral-800 bg-neutral-900/40 p-6 flex flex-col items-center text-center">

            {/* Avatar with gradient ring */}
            <div className="p-[3px] rounded-full bg-gradient-to-br from-indigo-500 via-violet-500 to-cyan-400 mb-4">
              <div className="h-24 w-24 rounded-full bg-[#1a1a2e] flex items-center justify-center text-2xl font-bold text-indigo-300">
                {user.name?.[0]?.toUpperCase()}
              </div>
            </div>

            <h2 className="text-base font-semibold">{user.name}</h2>
            <p className="text-xs text-neutral-500 mt-1">{user.email}</p>

            <div className="w-full h-px bg-neutral-800 my-5" />

            {/* Stats */}
            <div className="w-full space-y-3 text-left">
              {[
                { label: "Role", value: user.role },
                { label: "Experience", value: user.experience },
                { label: "Target Role", value: user.targetRole },
              ].map(({ label, value }) => (
                <div key={label} className="flex items-center justify-between">
                  <span className="text-xs text-neutral-500">{label}</span>
                  <span className="text-xs text-neutral-300 font-medium">{value}</span>
                </div>
              ))}
            </div>

            {user.city && (
              <p className="mt-5 text-xs text-neutral-600">
                📍 {user.city}, {user.state}
              </p>
            )}
          </div>

          {/* RIGHT PANEL */}
          <div className="space-y-5">

            {/* Career Details */}
            <div className="rounded-2xl border border-neutral-800 bg-neutral-900/30 p-6">
              <h3 className="text-xs font-medium text-indigo-400 uppercase tracking-widest mb-5">
                Career Details
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5 text-sm">
                {[
                  { label: "Current Role", value: user.role },
                  { label: "Experience", value: user.experience },
                  { label: "Target Role", value: user.targetRole },
                ].map(({ label, value }) => (
                  <div key={label}>
                    <p className="text-neutral-500 text-xs mb-1">{label}</p>
                    <p className="text-neutral-200">{value}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Skills */}
            {user.skills?.length > 0 && (
              <div className="rounded-2xl border border-neutral-800 bg-neutral-900/30 p-6">
                <h3 className="text-xs font-medium text-indigo-400 uppercase tracking-widest mb-5">
                  Skills
                </h3>
                <div className="flex flex-wrap gap-2">
                  {user.skills.map((skill) => (
                    <span
                      key={skill}
                      className="text-xs px-3 py-1.5 rounded-full bg-indigo-950/60 text-indigo-300 border border-indigo-900/60 font-medium"
                    >
                      {skill}
                    </span>
                  ))}
                </div>
              </div>
            )}

          </div>
        </div>
      </div>
    </div>
  );
}