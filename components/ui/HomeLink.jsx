"use client";

import { usePathname } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Home } from "lucide-react";

export default function HomeLink() {
  const pathname = usePathname();

  if (pathname === "/") return null;

  return (
    <Link href="/">
      <Button variant="outline" className="hidden md:inline-flex items-center gap-2">
        <Home className="h-4 w-4" />
        Go to Home
      </Button>
      <Button variant="ghost" className="md:hidden w-10 h-10 p-0">
        <Home className="h-4 w-4" />
      </Button>
    </Link>
  );
}