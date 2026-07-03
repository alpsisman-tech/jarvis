"use client";

// Hand-drawn 24px stroke icon set — consistent weight, round caps, no deps.

import React from "react";

export interface IconProps {
  size?: number;
  color?: string;
  strokeWidth?: number;
}

function Svg({ size = 22, color = "currentColor", strokeWidth = 1.8, children }: IconProps & { children: React.ReactNode }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color}
      strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" style={{ display: "block", flexShrink: 0 }}>
      {children}
    </svg>
  );
}

export const IconSun = (p: IconProps) => (
  <Svg {...p}>
    <circle cx="12" cy="12" r="4" />
    <path d="M12 2.5v2.2M12 19.3v2.2M2.5 12h2.2M19.3 12h2.2M5 5l1.6 1.6M17.4 17.4 19 19M5 19l1.6-1.6M17.4 6.6 19 5" />
  </Svg>
);

export const IconHeart = (p: IconProps) => (
  <Svg {...p}>
    <path d="M12 20.5 4.7 13a5 5 0 0 1 0-7 4.8 4.8 0 0 1 6.9 0l.4.5.4-.5a4.8 4.8 0 0 1 6.9 0 5 5 0 0 1 0 7L12 20.5z" />
    <path d="M7.5 12h2l1.2-2.4 2 4.2 1.3-2.3h2.5" />
  </Svg>
);

export const IconDumbbell = (p: IconProps) => (
  <Svg {...p}>
    <rect x="4.2" y="8" width="3.4" height="8" rx="1.2" />
    <rect x="16.4" y="8" width="3.4" height="8" rx="1.2" />
    <path d="M7.6 12h8.8" />
    <path d="M2 10.4v3.2M22 10.4v3.2" />
  </Svg>
);

export const IconBolt = (p: IconProps) => (
  <Svg {...p}>
    <path d="M13 2.5 4.5 13.5H11l-1 8L18.5 10H12l1-7.5z" />
  </Svg>
);

export const IconApple = (p: IconProps) => (
  <Svg {...p}>
    <path d="M12 7.8C8.8 6.3 6 8.6 6 12c0 3.4 2.4 8 4.8 8 .8 0 1.2-.4 1.2-.4s.4.4 1.2.4c2.4 0 4.8-4.6 4.8-8 0-3.4-2.8-5.7-6-4.2z" />
    <path d="M12 7.8c0-2 1-3.4 2.8-4.3" />
  </Svg>
);

export const IconCode = (p: IconProps) => (
  <Svg {...p}>
    <path d="m15.5 6.5 6 5.5-6 5.5M8.5 6.5 2.5 12l6 5.5" />
  </Svg>
);

export const IconSliders = (p: IconProps) => (
  <Svg {...p}>
    <path d="M3 7.5h18M3 12h18M3 16.5h18" opacity="0" />
    <path d="M3 7.5h11M18.5 7.5H21M3 12h4M11.5 12H21M3 16.5h13M20.5 16.5H21" />
    <circle cx="16" cy="7.5" r="2" />
    <circle cx="9" cy="12" r="2" />
    <circle cx="18" cy="16.5" r="2" />
  </Svg>
);

export const IconDots = (p: IconProps) => (
  <Svg {...p}>
    <circle cx="5" cy="12" r="1.1" fill="currentColor" stroke="none" />
    <circle cx="12" cy="12" r="1.1" fill="currentColor" stroke="none" />
    <circle cx="19" cy="12" r="1.1" fill="currentColor" stroke="none" />
  </Svg>
);

export const IconSpark = (p: IconProps) => (
  <Svg {...p}>
    <path d="M12 3.5c.7 3.8 2.7 5.8 6.5 6.5-3.8.7-5.8 2.7-6.5 6.5-.7-3.8-2.7-5.8-6.5-6.5 3.8-.7 5.8-2.7 6.5-6.5z" />
    <path d="M18.5 15.5c.3 1.6 1.1 2.4 2.7 2.7-1.6.3-2.4 1.1-2.7 2.7-.3-1.6-1.1-2.4-2.7-2.7 1.6-.3 2.4-1.1 2.7-2.7z" />
  </Svg>
);

export const IconX = (p: IconProps) => (
  <Svg {...p}>
    <path d="M6 6l12 12M18 6 6 18" />
  </Svg>
);
