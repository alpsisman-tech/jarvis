"use client";

import React, { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { PageTitle } from "@/components/ui";
import JarvisChat from "@/components/JarvisChat";

function JarvisInner() {
  const params = useSearchParams();
  const q = params.get("q") ?? undefined;
  return <JarvisChat tall initialQuery={q} />;
}

export default function JarvisPage() {
  return (
    <div>
      <PageTitle
        title="Jarvis"
        sub="Your agent — full access to health, training, runs, nutrition, weather and project data, with the tools to act on it"
      />
      <Suspense fallback={null}>
        <JarvisInner />
      </Suspense>
    </div>
  );
}
