"use client";

import React from "react";

/**
 * Iconic Salvador Dalí mask vector emblem (Money Heist / La Casa de Papel signature).
 * High-precision SVG with subtle gradients and lighting.
 */
export function DaliMask({
  className = "w-8 h-8",
  glow = false,
}: {
  className?: string;
  glow?: boolean;
}) {
  return (
    <div className={`relative inline-flex items-center justify-center shrink-0 ${className}`}>
      {glow && (
        <div className="absolute inset-0 bg-red-600/30 blur-xl rounded-full scale-125 pointer-events-none" />
      )}
      <svg
        viewBox="0 0 100 120"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="w-full h-full drop-shadow-[0_2px_8px_rgba(224,38,31,0.4)]"
      >
        <defs>
          <linearGradient id="daliRedGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#ff453a" />
            <stop offset="50%" stopColor="#e0261f" />
            <stop offset="100%" stopColor="#9a1310" />
          </linearGradient>
          <linearGradient id="daliGoldGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#f5d485" />
            <stop offset="100%" stopColor="#c59837" />
          </linearGradient>
          <linearGradient id="daliFaceGrad" x1="50%" y1="0%" x2="50%" y2="100%">
            <stop offset="0%" stopColor="#f7f3ea" />
            <stop offset="100%" stopColor="#ded5c0" />
          </linearGradient>
        </defs>

        {/* Hood silhouette */}
        <path
          d="M50 4C24 4 10 24 10 52C10 82 22 108 50 116C78 108 90 82 90 52C90 24 76 4 50 4Z"
          fill="url(#daliRedGrad)"
        />

        {/* Mask face contour */}
        <path
          d="M50 16C32 16 23 30 23 52C23 76 34 98 50 104C66 98 77 76 77 52C77 30 68 16 50 16Z"
          fill="url(#daliFaceGrad)"
        />

        {/* Eye sockets / shadows */}
        <ellipse cx="38" cy="48" rx="8" ry="5.5" fill="#181418" />
        <ellipse cx="62" cy="48" rx="8" ry="5.5" fill="#181418" />
        
        {/* Intense gaze eyes */}
        <circle cx="38" cy="48" r="2.8" fill="#f5f0e6" />
        <circle cx="62" cy="48" r="2.8" fill="#f5f0e6" />
        <circle cx="38" cy="48" r="1.4" fill="#000000" />
        <circle cx="62" cy="48" r="1.4" fill="#000000" />

        {/* Arched dramatic brows */}
        <path
          d="M28 41C33 37 42 39 46 43"
          stroke="#181418"
          strokeWidth="3.2"
          strokeLinecap="round"
        />
        <path
          d="M72 41C67 37 58 39 54 43"
          stroke="#181418"
          strokeWidth="3.2"
          strokeLinecap="round"
        />

        {/* Sharp prominent nose */}
        <path
          d="M50 44L47 67L53 67Z"
          fill="#cbbfa6"
        />
        <path
          d="M45 68C48 70 52 70 55 68"
          stroke="#9a8d74"
          strokeWidth="1.8"
          strokeLinecap="round"
        />

        {/* Signature upward-curled mustache */}
        <path
          d="M50 76C44 75 32 74 25 61C24 59 26 58 28 60C34 67 44 69 50 73C56 69 66 67 72 60C74 58 76 59 75 61C68 74 56 75 50 76Z"
          fill="#181418"
        />

        {/* Subtle smirk mouth */}
        <path
          d="M43 83C47 85 53 85 57 83"
          stroke="#181418"
          strokeWidth="2.2"
          strokeLinecap="round"
        />

        {/* Chiseled chin contour */}
        <path
          d="M44 95C48 97 52 97 56 95"
          stroke="#cbbfa6"
          strokeWidth="2"
          strokeLinecap="round"
        />
      </svg>
    </div>
  );
}
