"use client";
import React from "react";

export function CoinIcon() {
  return (
    <svg
      width="40"
      height="40"
      viewBox="0 0 256 417"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className="mx-auto"
    >
      <path fill="#2563EB" d="M127.9,0L124.7,11.2V274.6l3.2,3.3l127.9-68.8L127.9,0z" />
      <path fill="#3B82F6" d="M127.9,0L0,209.1l127.9,68.8V0z" />
      <path fill="#60A5FA" d="M127.9,311.3l-2.3,2.3V414.8l2.3,2.2l128.1-76.1L127.9,311.3z" />
      <path fill="#3B82F6" d="M127.9,414.8V311.3L256,239.7L127.9,414.8z" />
      <path fill="#1D4ED8" d="M127.9,277.9l127.9-68.8l-127.9-59.6V277.9z" />
      <path fill="#2563EB" d="M0,209.1l127.9,68.8V218.3L0,209.1z" />
    </svg>
  );
}

export function LightningIcon() {
  return (
    <svg
      width="42"
      height="42"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="mx-auto"
    >
      <path d="M13 2L3 14h9l-1 8 9-12h-9l2-8z" />
    </svg>
  );
}

export function ChartIcon() {
  return (
    <svg
      width="42"
      height="42"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="mx-auto"
    >
      <polyline points="4 16 8 12 12 16 16 10 20 14" />
      <polyline points="4 20 20 20" />
    </svg>
  );
}

export function SentimentIcon() {
  return (
    <svg
      width="26"
      height="26"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="mx-auto"
    >
      <circle cx="12" cy="12" r="10" />
      <path d="M8 14s1.5 2 4 2 4-2 4-2" />
      <line x1="9" y1="9" x2="9.01" y2="9" />
      <line x1="15" y1="9" x2="15.01" y2="9" />
    </svg>
  );
}

export function InsightIcon() {
  return (
    <svg
      width="42"
      height="42"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="mx-auto"
    >
      <circle cx="11" cy="11" r="8" />
      <line x1="21" y1="21" x2="16.65" y2="16.65" />
    </svg>
  );
}

export function ToolIcon() {
  return (
    <svg
      width="42"
      height="42"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="mx-auto"
    >
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 01-2.83 2.83l-.06-.06a1.65 1.65 0 00-1.82-.33" />
    </svg>
  );
}

// Restored GearIcon export (kept for other uses)
export function GearIcon() {
  return (
    <svg
      width="42"
      height="42"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="mx-auto"
    >
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 01-2.83 2.83l-.06-.06a1.65 1.65 0 00-1.82-.33" />
      <path d="M4.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06a1.65 1.65 0 001.82.33" />
      <path d="M19.4 9a1.65 1.65 0 01.33 1.82l.06.06a2 2 0 00-2.83 2.83l-.06-.06a1.65 1.65 0 01-1.82-.33" />
      <path d="M4.6 15a1.65 1.65 0 01-.33-1.82l-.06-.06a2 2 0 002.83-2.83l.06.06a1.65 1.65 0 011.82.33" />
    </svg>
  );
}

// New RocketIcon for v1 and v2 (alternative to GearIcon)
export function RocketIcon() {
  return (
    <svg
      width="42"
      height="42"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="mx-auto"
    >
      {/* A simple rocket shape */}
      <path d="M12 2L15 8L12 10L9 8z" />
      <path d="M12 10v10" />
      <path d="M9 16l3-2 3 2" />
    </svg>
  );
}

// New GroupIcon for Community Kick-Off
export function GroupIcon() {
  return (
    <svg
      width="42"
      height="42"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="mx-auto"
    >
      <path d="M17 21v-2a4 4 0 00-3-3.87" />
      <path d="M7 21v-2a4 4 0 013-3.87" />
      <circle cx="12" cy="7" r="4" />
    </svg>
  );
}

