import React from "react";

const SHIRT_COLORS = [
  "#EF4444", "#3B82F6", "#10B981", "#F59E0B", "#8B5CF6",
  "#EC4899", "#14B8A6", "#F97316", "#6366F1", "#84CC16",
  "#06B6D4", "#D946EF", "#22C55E", "#EAB308", "#A855F7",
];

const SHORTS_COLORS = [
  "#1E3A5F", "#1F2937", "#374151", "#4B5563", "#111827",
  "#0F172A", "#172554", "#312E81", "#3F1642", "#2C1810",
];

function hashString(str: string): number {
  let h = 0;
  for (let i = 0; i < str.length; i++) {
    h = ((h << 5) - h + str.charCodeAt(i)) | 0;
  }
  return Math.abs(h);
}

function getColors(userId: string) {
  const h = hashString(userId);
  return {
    shirt: SHIRT_COLORS[h % SHIRT_COLORS.length],
    shorts: SHORTS_COLORS[h % SHORTS_COLORS.length],
    skinTone: ["#F5D0C5", "#E8BEAC", "#D4A574", "#C68642", "#8D5524"][h % 5],
    hair: ["#2D1B0E", "#4A3B2A", "#A67B5B", "#D4A574", "#1C1C1C", "#8B6914"][h % 6],
  };
}

export interface PlayerAvatarProps {
  userId: string;
  gender?: "male" | "female" | null;
  size?: number;
  className?: string;
  hasBall?: boolean;
}

export const PlayerAvatar: React.FC<PlayerAvatarProps> = ({
  userId,
  gender = "male",
  size = 40,
  className = "",
  hasBall = false,
}) => {
  const colors = getColors(userId);
  const isFemale = gender === "female";
  const s = size;
  const scale = s / 40;

  return (
    <svg
      width={s}
      height={s + (hasBall ? 6 * scale : 0)}
      viewBox={`0 0 40 ${40 + (hasBall ? 6 : 0)}`}
      className={className}
      style={{ display: "block" }}
    >
      {/* Ground shadow */}
      <ellipse cx="20" cy="38" rx="10" ry="1.5" fill="rgba(0,0,0,0.15)" />

      {/* Legs */}
      <rect x="14" y="28" width="4" height="9" rx="1.5" fill={colors.skinTone} />
      <rect x="22" y="28" width="4" height="9" rx="1.5" fill={colors.skinTone} />

      {/* Shorts */}
      <path
        d={`M${12} ${26} L${28} ${26} L${27} ${31} L${23} ${31} L${22} ${28} L${18} ${28} L${17} ${31} L${13} ${31} Z`}
        fill={colors.shorts}
      />

      {/* Shirt / Body */}
      <rect x="12" y="16" width="16" height="12" rx="3" fill={colors.shirt} />
      {/* Shirt collar */}
      <path d="M17 16 Q20 19 23 16" fill="none" stroke="rgba(255,255,255,0.4)" strokeWidth="1" />
      {/* Shirt sleeves */}
      <rect x="9" y="16" width="4" height="6" rx="2" fill={colors.shirt} />
      <rect x="27" y="16" width="4" height="6" rx="2" fill={colors.shirt} />
      {/* Arms */}
      <rect x="9" y="20" width="3" height="7" rx="1.5" fill={colors.skinTone} />
      <rect x="28" y="20" width="3" height="7" rx="1.5" fill={colors.skinTone} />

      {/* Head */}
      <circle cx="20" cy="11" r="6" fill={colors.skinTone} />

      {/* Hair */}
      {isFemale ? (
        <>
          {/* Long hair back */}
          <path
            d={`M14 9 Q20 2 26 9 Q28 14 27 18 Q20 20 13 18 Q12 14 14 9`}
            fill={colors.hair}
          />
          {/* Hair bangs */}
          <path d="M15 7 Q20 4 25 7" fill="none" stroke={colors.hair} strokeWidth="2.5" strokeLinecap="round" />
        </>
      ) : (
        <>
          {/* Short hair */}
          <path
            d={`M14 9 Q20 3 26 9 Q27 12 26 13 Q20 11 14 13 Q13 12 14 9`}
            fill={colors.hair}
          />
        </>
      )}

      {/* Face — eyes */}
      <circle cx="17.5" cy="11.5" r="1" fill="#1a1a1a" />
      <circle cx="22.5" cy="11.5" r="1" fill="#1a1a1a" />
      {/* Smile */}
      <path d="M18 14 Q20 15.5 22 14" fill="none" stroke="#1a1a1a" strokeWidth="0.8" strokeLinecap="round" />

      {/* Number on shirt */}
      <text
        x="20"
        y="24"
        textAnchor="middle"
        fontSize="5"
        fontWeight="bold"
        fill="rgba(255,255,255,0.85)"
        fontFamily="Arial, sans-serif"
      >
        {(hashString(userId) % 99) + 1}
      </text>

      {/* Soccer ball */}
      {hasBall && (
        <g transform="translate(30, 34)">
          <circle cx="0" cy="0" r="3.5" fill="white" stroke="#1a1a1a" strokeWidth="0.8" />
          <path d="M-1.5 -1 L0 -2.5 L1.5 -1 L1 1 L-1 1 Z" fill="#1a1a1a" />
          <line x1="-2.5" y1="0" x2="-1.5" y2="-1" stroke="#1a1a1a" strokeWidth="0.5" />
          <line x1="2.5" y1="0" x2="1.5" y2="-1" stroke="#1a1a1a" strokeWidth="0.5" />
          <line x1="0" y1="2.5" x2="1" y2="1" stroke="#1a1a1a" strokeWidth="0.5" />
        </g>
      )}
    </svg>
  );
};

export default PlayerAvatar;
