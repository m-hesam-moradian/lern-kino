import React from 'react';

export interface LogoProps {
  className?: string;
  size?: number;
}

/**
 * LernKino Minimalist Brand Logo
 * A sleek frosted-glass cinema frame enclosing a glowing play prism in Cyan (#00FFFF) & Grey.
 */
export default function Logo({ className = '', size = 36 }: LogoProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 48 48"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-label="LernKino Logo"
    >
      <defs>
        {/* Ambient Cyan Glow */}
        <filter id="cyanGlow" x="-20%" y="-20%" width="140%" height="140%">
          <feDropShadow dx="0" dy="0" stdDeviation="3" floodColor="#00FFFF" floodOpacity="0.45" />
        </filter>

        {/* Linear Gradient for Frame */}
        <linearGradient id="frameGrad" x1="0" y1="0" x2="48" y2="48" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#00FFFF" stopOpacity="0.9" />
          <stop offset="50%" stopColor="#38BDF8" stopOpacity="0.6" />
          <stop offset="100%" stopColor="#818CF8" stopOpacity="0.3" />
        </linearGradient>

        {/* Glass Fill for Cinema Slate */}
        <linearGradient id="glassFill" x1="6" y1="6" x2="42" y2="42" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#00FFFF" stopOpacity="0.15" />
          <stop offset="100%" stopColor="#0F172A" stopOpacity="0.35" />
        </linearGradient>

        {/* Vibrant Prism Fill */}
        <linearGradient id="prismGrad" x1="18" y1="14" x2="34" y2="24" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#00FFFF" />
          <stop offset="100%" stopColor="#06B6D4" />
        </linearGradient>
      </defs>

      {/* Outer Cinema Frame with Rounded Corners */}
      <rect
        x="5"
        y="5"
        width="38"
        height="38"
        rx="12"
        fill="url(#glassFill)"
        stroke="url(#frameGrad)"
        strokeWidth="2.5"
      />

      {/* Top Film Sprocket Dots */}
      <circle cx="12" cy="10" r="1.5" fill="#00FFFF" fillOpacity="0.7" />
      <circle cx="20" cy="10" r="1.5" fill="#00FFFF" fillOpacity="0.7" />
      <circle cx="28" cy="10" r="1.5" fill="#00FFFF" fillOpacity="0.7" />
      <circle cx="36" cy="10" r="1.5" fill="#00FFFF" fillOpacity="0.7" />

      {/* Bottom Film Sprocket Dots */}
      <circle cx="12" cy="38" r="1.5" fill="#00FFFF" fillOpacity="0.4" />
      <circle cx="20" cy="38" r="1.5" fill="#00FFFF" fillOpacity="0.4" />
      <circle cx="28" cy="38" r="1.5" fill="#00FFFF" fillOpacity="0.4" />
      <circle cx="36" cy="38" r="1.5" fill="#00FFFF" fillOpacity="0.4" />

      {/* Center Dynamic Play Prism */}
      <path
        d="M20 17.5C20 16.5 21.1 15.9 22 16.4L31 22.4C31.8 22.9 31.8 24.1 31 24.6L22 30.6C21.1 31.1 20 30.5 20 29.5V17.5Z"
        fill="url(#prismGrad)"
        filter="url(#cyanGlow)"
      />

      {/* Subtle Prism Highlight */}
      <path
        d="M21 18.5L29 23.5L21 28.5"
        stroke="#FFFFFF"
        strokeWidth="1"
        strokeLinecap="round"
        strokeOpacity="0.6"
      />
    </svg>
  );
}
