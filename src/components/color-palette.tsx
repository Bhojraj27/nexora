"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { Check, Copy } from "lucide-react";

interface ColorSwatch {
  name: string;
  cssVar: string;
  hex: { light: string; dark: string };
}

const COLOR_GROUPS: { title: string; colors: ColorSwatch[] }[] = [
  {
    title: "Core",
    colors: [
      { name: "Background", cssVar: "--background", hex: { light: "#f8fafc", dark: "#09090b" } },
      { name: "Surface", cssVar: "--surface", hex: { light: "#ffffff", dark: "#111113" } },
      { name: "Surface Secondary", cssVar: "--surface-secondary", hex: { light: "#f1f5f9", dark: "#18181b" } },
      { name: "Surface Tertiary", cssVar: "--surface-tertiary", hex: { light: "#e2e8f0", dark: "#1f1f23" } },
      { name: "Border", cssVar: "--border", hex: { light: "#e2e8f0", dark: "#27272a" } },
      { name: "Border Strong", cssVar: "--border-strong", hex: { light: "#cbd5e1", dark: "#3f3f46" } },
    ],
  },
  {
    title: "Typography",
    colors: [
      { name: "Text Primary", cssVar: "--text-primary", hex: { light: "#0f172a", dark: "#fafafa" } },
      { name: "Text Secondary", cssVar: "--text-secondary", hex: { light: "#64748b", dark: "#a1a1aa" } },
      { name: "Text Muted", cssVar: "--text-muted", hex: { light: "#94a3b8", dark: "#71717a" } },
    ],
  },
  {
    title: "Accent",
    colors: [
      { name: "Accent", cssVar: "--accent", hex: { light: "#6366f1", dark: "#818cf8" } },
      { name: "Accent Hover", cssVar: "--accent-hover", hex: { light: "#4f46e5", dark: "#a5b4fc" } },
      { name: "Accent Secondary", cssVar: "--accent-secondary", hex: { light: "#8b5cf6", dark: "#a78bfa" } },
    ],
  },
  {
    title: "Semantic",
    colors: [
      { name: "Success", cssVar: "--success", hex: { light: "#10b981", dark: "#34d399" } },
      { name: "Warning", cssVar: "--warning", hex: { light: "#f59e0b", dark: "#fbbf24" } },
      { name: "Danger", cssVar: "--danger", hex: { light: "#ef4444", dark: "#f87171" } },
    ],
  },
];

function SwatchCard({ swatch, index, isDark }: { swatch: ColorSwatch; index: number; isDark: boolean }) {
  const [copied, setCopied] = useState(false);
  const hexValue = isDark ? swatch.hex.dark : swatch.hex.light;

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(hexValue);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Fallback for clipboard API not available
    }
  }, [hexValue]);

  return (
    <button
      onClick={handleCopy}
      className="color-swatch-card group"
      style={{
        animationDelay: `${index * 60}ms`,
      }}
      title={`Click to copy ${hexValue}`}
    >
      <div
        className="color-swatch-preview"
        style={{ backgroundColor: `var(${swatch.cssVar})` }}
      >
        <span className="color-swatch-copy-icon">
          {copied ? (
            <Check className="h-4 w-4 text-white" />
          ) : (
            <Copy className="h-4 w-4 text-white" />
          )}
        </span>
      </div>
      <div className="color-swatch-info">
        <span className="color-swatch-name">{swatch.name}</span>
        <span className="color-swatch-hex">
          {copied ? "Copied!" : hexValue}
        </span>
      </div>
    </button>
  );
}

export function ColorPalette() {
  const sectionRef = useRef<HTMLDivElement>(null);
  const [isVisible, setIsVisible] = useState(false);
  const [isDark, setIsDark] = useState(false);

  useEffect(() => {
    // Detect dark mode
    const checkDark = () => {
      setIsDark(document.documentElement.classList.contains("dark"));
    };
    checkDark();

    const observer = new MutationObserver(checkDark);
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class"],
    });

    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const el = sectionRef.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
          observer.disconnect();
        }
      },
      { threshold: 0.15 },
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  let swatchIndex = 0;

  return (
    <div ref={sectionRef} className={`color-palette-section ${isVisible ? "is-visible" : ""}`}>
      <div className="color-palette-header">
        <span className="color-palette-badge">Design System</span>
        <h2 className="color-palette-title">
          Interactive Color Palette
        </h2>
        <p className="color-palette-description">
          Explore our carefully curated color system. Click any swatch to copy its hex value.
          Colors adapt seamlessly between light and dark themes.
        </p>
      </div>

      <div className="color-palette-groups">
        {COLOR_GROUPS.map((group) => (
          <div key={group.title} className="color-palette-group">
            <h3 className="color-palette-group-title">{group.title}</h3>
            <div className="color-palette-grid">
              {group.colors.map((color) => {
                const idx = swatchIndex++;
                return (
                  <SwatchCard
                    key={color.cssVar}
                    swatch={color}
                    index={idx}
                    isDark={isDark}
                  />
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
