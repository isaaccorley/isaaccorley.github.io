"use client";

import dynamic from "next/dynamic";

const DynamicGlobe = dynamic(
  () => import("@/components/spinning-globe").then((mod) => mod.SpinningGlobe),
  { ssr: false },
);

export function GlobeBackground() {
  return <DynamicGlobe />;
}
