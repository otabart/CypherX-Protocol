"use client";
import React from "react";

type HeroSectionProps = {
  title: string;
  subtitle?: string;
};

export default function HeroSection({ title, subtitle }: HeroSectionProps) {
  return (
    <section className="w-full h-32 md:h-48 bg-[#0052FF] flex flex-col items-center justify-center text-center text-white">
      <h1 className="text-2xl md:text-4xl font-extrabold">{title}</h1>
      {subtitle && (
        <p className="mt-2 text-sm md:text-lg font-normal">
          {subtitle}
        </p>
      )}
    </section>
  );
}



