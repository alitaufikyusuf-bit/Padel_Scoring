import * as React from "react";

export function PadelSticker({ className = "" }: { className?: string }) {
  return (
    <div
      className={`mx-auto flex w-full max-w-lg flex-col items-center justify-center select-none pointer-events-none py-6 px-4 ${className}`}
      aria-hidden="true"
    >
      <svg
        viewBox="0 0 540 220"
        className="w-full h-auto"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        {/* ============================================================
            MODEL B: AMBIENT PADEL WATERMARK (LINE-ART + NEON ACCENT)
            ============================================================ */}

        {/* 1. PERSPECTIVE PADEL COURT LINES & NET (Background) */}
        <g
          stroke="var(--nb-ink)"
          strokeOpacity="0.16"
          strokeWidth="2"
          strokeLinecap="round"
        >
          {/* Isometric Court Baseline & Service Box */}
          <line x1="70" y1="180" x2="470" y2="180" />
          <line x1="120" y1="135" x2="420" y2="135" strokeDasharray="6 6" />
          <line x1="270" y1="135" x2="270" y2="180" strokeWidth="2.5" />
          <line x1="70" y1="180" x2="120" y2="135" />
          <line x1="470" y1="180" x2="420" y2="135" />

          {/* Net Mesh Pattern in Center */}
          <line x1="160" y1="120" x2="380" y2="120" strokeWidth="3" />
          <line x1="160" y1="130" x2="380" y2="130" strokeWidth="1.5" strokeDasharray="4 4" />
          <line x1="170" y1="118" x2="170" y2="132" />
          <line x1="200" y1="118" x2="200" y2="132" />
          <line x1="230" y1="118" x2="230" y2="132" />
          <line x1="270" y1="118" x2="270" y2="132" strokeWidth="2.5" />
          <line x1="310" y1="118" x2="310" y2="132" />
          <line x1="340" y1="118" x2="340" y2="132" />
          <line x1="370" y1="118" x2="370" y2="132" />
        </g>

        {/* 2. BALL TRAJECTORY & SPEED MOTION TRAILS */}
        <g stroke="var(--nb-ink)" strokeOpacity="0.28" strokeLinecap="round">
          {/* Arched Bounce Path */}
          <path
            d="M 170 170 Q 220 50, 310 70"
            strokeWidth="2.5"
            strokeDasharray="6 6"
          />
          {/* Impact ripples at bounce spot */}
          <ellipse cx="170" cy="170" rx="14" ry="4" strokeWidth="2" fill="none" />
          <ellipse cx="170" cy="170" rx="24" ry="7" strokeWidth="1.5" strokeDasharray="3 3" fill="none" />

          {/* Action speed lines behind ball */}
          <line x1="265" y1="88" x2="295" y2="76" strokeWidth="2.5" />
          <line x1="260" y1="76" x2="292" y2="68" strokeWidth="3" />
          <line x1="268" y1="62" x2="298" y2="60" strokeWidth="2" />
        </g>

        {/* 3. CROSSED PADEL RACKETS (Refined Neo-Brutalist Line-Art) */}
        {/* Left Racket (Angle: -28 deg) */}
        <g
          transform="translate(230, 130) rotate(-28) translate(-230, -130)"
          stroke="var(--nb-ink)"
          strokeOpacity="0.35"
        >
          {/* Handle */}
          <rect
            x="222"
            y="110"
            width="16"
            height="70"
            rx="3"
            strokeWidth="2.5"
            fill="var(--nb-card-2)"
            fillOpacity="0.5"
          />
          {/* Grip Tape Lines */}
          <line x1="222" y1="125" x2="238" y2="120" strokeWidth="2" />
          <line x1="222" y1="140" x2="238" y2="135" strokeWidth="2" />
          <line x1="222" y1="155" x2="238" y2="150" strokeWidth="2" />
          <line x1="222" y1="170" x2="238" y2="165" strokeWidth="2" />
          {/* Wrist Cord */}
          <path
            d="M 230 180 C 230 192, 218 196, 214 188"
            strokeWidth="2"
            fill="none"
          />

          {/* Racket Head */}
          <path
            d="M 200 35 C 230 28, 260 35, 268 65 C 274 92, 256 112, 242 116 L 218 116 C 204 112, 186 92, 192 65 C 195 50, 200 35, 200 35 Z"
            strokeWidth="3"
            fill="var(--nb-card)"
            fillOpacity="0.3"
          />
          {/* Throat Cutout */}
          <polygon points="225,112 235,112 230,100" strokeWidth="2" fill="none" />

          {/* Perforated Padel Holes Grid */}
          <g fill="var(--nb-ink)" fillOpacity="0.32" stroke="none">
            <circle cx="230" cy="50" r="2.5" />
            <circle cx="230" cy="62" r="2.5" />
            <circle cx="230" cy="74" r="2.5" />
            <circle cx="230" cy="86" r="2.5" />
            <circle cx="218" cy="56" r="2.5" />
            <circle cx="218" cy="68" r="2.5" />
            <circle cx="218" cy="80" r="2.5" />
            <circle cx="242" cy="56" r="2.5" />
            <circle cx="242" cy="68" r="2.5" />
            <circle cx="242" cy="80" r="2.5" />
            <circle cx="206" cy="64" r="2.5" />
            <circle cx="206" cy="76" r="2.5" />
            <circle cx="254" cy="64" r="2.5" />
            <circle cx="254" cy="76" r="2.5" />
          </g>
        </g>

        {/* Right Racket (Angle: +28 deg) */}
        <g
          transform="translate(230, 130) rotate(28) translate(-230, -130)"
          stroke="var(--nb-ink)"
          strokeOpacity="0.35"
        >
          {/* Handle */}
          <rect
            x="222"
            y="110"
            width="16"
            height="70"
            rx="3"
            strokeWidth="2.5"
            fill="var(--nb-card-2)"
            fillOpacity="0.5"
          />
          {/* Grip Tape Lines */}
          <line x1="222" y1="125" x2="238" y2="120" strokeWidth="2" />
          <line x1="222" y1="140" x2="238" y2="135" strokeWidth="2" />
          <line x1="222" y1="155" x2="238" y2="150" strokeWidth="2" />
          <line x1="222" y1="170" x2="238" y2="165" strokeWidth="2" />
          {/* Wrist Cord */}
          <path
            d="M 230 180 C 230 192, 242 196, 246 188"
            strokeWidth="2"
            fill="none"
          />

          {/* Racket Head */}
          <path
            d="M 200 35 C 230 28, 260 35, 268 65 C 274 92, 256 112, 242 116 L 218 116 C 204 112, 186 92, 192 65 C 195 50, 200 35, 200 35 Z"
            strokeWidth="3"
            fill="var(--nb-card)"
            fillOpacity="0.3"
          />
          {/* Throat Cutout */}
          <polygon points="225,112 235,112 230,100" strokeWidth="2" fill="none" />

          {/* Perforated Padel Holes Grid */}
          <g fill="var(--nb-ink)" fillOpacity="0.32" stroke="none">
            <circle cx="230" cy="50" r="2.5" />
            <circle cx="230" cy="62" r="2.5" />
            <circle cx="230" cy="74" r="2.5" />
            <circle cx="230" cy="86" r="2.5" />
            <circle cx="218" cy="56" r="2.5" />
            <circle cx="218" cy="68" r="2.5" />
            <circle cx="218" cy="80" r="2.5" />
            <circle cx="242" cy="56" r="2.5" />
            <circle cx="242" cy="68" r="2.5" />
            <circle cx="242" cy="80" r="2.5" />
            <circle cx="206" cy="64" r="2.5" />
            <circle cx="206" cy="76" r="2.5" />
            <circle cx="254" cy="64" r="2.5" />
            <circle cx="254" cy="76" r="2.5" />
          </g>
        </g>

        {/* 4. VIBRANT HERO PADEL BALL (Acid Lime Accent) */}
        <g transform="translate(325, 65)">
          {/* Solid Brutalist Shadow */}
          <circle cx="2" cy="2" r="20" fill="var(--nb-ink)" fillOpacity="0.2" />

          {/* Neon Ball Body */}
          <circle
            cx="0"
            cy="0"
            r="20"
            fill="var(--nb-accent)"
            stroke="var(--nb-line)"
            strokeWidth="3"
          />
          {/* Padel / Tennis Seams */}
          <path
            d="M -13 -13 C -5 -6, -5 6, -13 13"
            stroke="var(--nb-line)"
            strokeWidth="2.5"
            strokeLinecap="round"
            fill="none"
          />
          <path
            d="M 13 -13 C 5 -6, 5 6, 13 13"
            stroke="var(--nb-line)"
            strokeWidth="2.5"
            strokeLinecap="round"
            fill="none"
          />
        </g>

        {/* 5. RETRO BRUTALIST ACCENT SPARKLES (✦) */}
        <g fill="var(--nb-ink)" fillOpacity="0.22" stroke="none">
          {/* Top Left Sparkle */}
          <path d="M 110 50 Q 110 60 100 60 Q 110 60 110 70 Q 110 60 120 60 Q 110 60 110 50 Z" />
          {/* Right Sparkle */}
          <path d="M 430 90 Q 430 98 422 98 Q 430 98 430 106 Q 430 98 438 98 Q 430 98 430 90 Z" />
          {/* Cross accents */}
          <rect x="80" y="110" width="8" height="2" />
          <rect x="83" y="107" width="2" height="8" />
          <rect x="450" y="150" width="8" height="2" />
          <rect x="453" y="147" width="2" height="8" />
        </g>

        {/* 6. TYPOGRAPHIC SLOGAN (Clean Neo-Brutalist Lettering) */}
        <g transform="translate(270, 204)">
          {/* Subtle line dividers on left & right */}
          <line
            x1="-170"
            y1="-4"
            x2="-105"
            y2="-4"
            stroke="var(--nb-ink)"
            strokeOpacity="0.2"
            strokeWidth="2"
          />
          <line
            x1="105"
            y1="-4"
            x2="170"
            y2="-4"
            stroke="var(--nb-ink)"
            strokeOpacity="0.2"
            strokeWidth="2"
          />

          <text
            x="0"
            y="0"
            textAnchor="middle"
            fill="var(--nb-ink)"
            fillOpacity="0.4"
            className="select-none uppercase font-extrabold"
            style={{
              fontFamily: "var(--font-sans)",
              fontSize: "11px",
              fontWeight: 800,
              letterSpacing: "0.28em",
            }}
          >
            SERVE · RALLY · SMASH
          </text>
        </g>
      </svg>
    </div>
  );
}
