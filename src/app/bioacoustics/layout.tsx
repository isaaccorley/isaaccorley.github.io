import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "AI Bioacoustics Analysis Toolkit",
  description: "AI-powered bioacoustics analysis toolkit with real-time species detection and audio processing",
  icons: {
    icon: '/bioacoustics/assets/logo.png',
  },
};

export default function BioacousticsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
