"use client";

import React from "react";
import Link from "next/link";
import Image from "next/image";
import { features } from "@/data/features";
import {
  Brain,
  Briefcase,
  BarChart3,
  FileText,
  Mail,
  Target,
} from "lucide-react";

const iconMap = {
  brain:     Brain,
  briefcase: Briefcase,
  chart:     BarChart3,
  file:      FileText,
  mail:      Mail,
  target:    Target,
};

const HeroSection = () => {
  return (
    <section className="w-full bg-black pt-28 pb-8 px-6">

      {/* ── 3×2 FEATURE CARD GRID ── */}
      <div className="max-w-7xl mx-auto grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
        {features.map((feature, index) => {
          const Icon = iconMap[feature.icon];
          return (
            <Link key={index} href={feature.route} className="group block">
              <div className="relative h-[220px] md:h-[260px] overflow-hidden cursor-pointer rounded-xl">

                {/* Background image */}
                <div
                  className="absolute inset-0 bg-cover bg-center transition-transform duration-700 group-hover:scale-110"
                  style={{
                    backgroundImage: `url(${feature.image})`,
                  }}
                />

                {/* Dark gradient overlay */}
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/40 to-black/20 group-hover:from-black/70 transition-all duration-300" />

                {/* Cyan border glow on hover */}
                <div className="absolute inset-0 border-2 border-transparent group-hover:border-cyan-400/60 rounded-xl transition-all duration-300" />

                {/* Content */}
                <div className="absolute inset-0 p-5 flex flex-col justify-between">
                  {/* Icon badge */}
                  <div className="w-fit p-2 rounded-lg bg-black/40 border border-white/20 backdrop-blur-sm">
                    {Icon && <Icon className="h-5 w-5 text-cyan-300" />}
                  </div>

                  {/* Title + description */}
                  <div>
                    <h3 className="text-white font-bold text-lg leading-tight">
                      {feature.title}
                    </h3>
                    {feature.description && (
                      <p className="text-gray-300 text-xs mt-1 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                        {feature.description}
                      </p>
                    )}
                  </div>
                </div>

              </div>
            </Link>
          );
        })}
      </div>

      

    </section>
  );
};

export default HeroSection;
