import Image from "next/image";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { checkUser } from "@/lib/checkUser";

export default async function WelcomePage() {
  const user = await checkUser();

  return (
    <div className="min-h-screen grid grid-cols-1 md:grid-cols-2">

      {/* LEFT IMAGE */}
      <div className="relative hidden md:block h-screen">
        <Image
          src="/public/images/features/onboarding.jpeg"
          alt="AI Career Coach"
          fill
          className="object-cover"
          priority
        />
        <div className="absolute inset-0 bg-black/40" />
      </div>

      {/* RIGHT CONTENT */}
      <div className="flex flex-col justify-center px-8 md:px-16 bg-black text-white">
        
        {/* Greeting */}
        {user && (
          <p className="text-white text-2xl  writing-vertical">
            👋 Hello, {user.name}
          </p>
        )}

        <h1 className="text-4xl font-bold mb-4 gradient-title">
            Welcome to Your AI Career Coach 🤖
        </h1>

        <p className="text-gray-400 mb-8 max-w-md">
          Let’s understand your background and goals to build a personalized career roadmap for you
        </p>

        <Link href="/welcome-form">
          <Button size="lg" className="w-fit">
            Start Onboarding (&lt; 2 mins)
          </Button>
        </Link>
      </div>
    </div>
  );
}