"use client";

export default function CamelLoading({ size = "md" }: { size?: "sm" | "md" | "lg" }) {
  const scale = size === "sm" ? 0.6 : size === "lg" ? 1.4 : 1;

  return (
    <div className="flex items-center gap-3">
      <div className="camel-walk" style={{ transform: `scale(${scale})` }}>
        <svg
          width="56"
          height="40"
          viewBox="0 0 56 40"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          {/* Body */}
          <ellipse cx="28" cy="16" rx="16" ry="10" fill="#c41230" className="camel-bob" />
          {/* Hump */}
          <ellipse cx="24" cy="8" rx="6" ry="5" fill="#9e0e27" />
          <ellipse cx="32" cy="9" rx="5" ry="4" fill="#9e0e27" />
          {/* Head */}
          <g className="camel-bob">
            <ellipse cx="46" cy="10" rx="5" ry="4" fill="#c41230" />
            {/* Eye */}
            <circle cx="48" cy="9" r="1.2" fill="white" />
            <circle cx="48.3" cy="8.8" r="0.6" fill="#1a1a1a" />
            {/* Mouth */}
            <path d="M50 11.5 Q52 12 50 13" stroke="#9e0e27" strokeWidth="0.8" fill="none" />
          </g>
          {/* Neck */}
          <path d="M38 14 Q42 8 46 10" stroke="#c41230" strokeWidth="4" fill="none" />
          {/* Tail */}
          <path d="M12 14 Q8 10 6 12" stroke="#9e0e27" strokeWidth="2" fill="none" strokeLinecap="round" />
          {/* Front legs */}
          <g className="camel-leg-left">
            <line x1="34" y1="24" x2="36" y2="36" stroke="#9e0e27" strokeWidth="2.5" strokeLinecap="round" />
            <ellipse cx="36" cy="37" rx="2" ry="1" fill="#9e0e27" />
          </g>
          <g className="camel-leg-right">
            <line x1="38" y1="24" x2="40" y2="36" stroke="#9e0e27" strokeWidth="2.5" strokeLinecap="round" />
            <ellipse cx="40" cy="37" rx="2" ry="1" fill="#9e0e27" />
          </g>
          {/* Back legs */}
          <g className="camel-leg-right">
            <line x1="20" y1="24" x2="18" y2="36" stroke="#9e0e27" strokeWidth="2.5" strokeLinecap="round" />
            <ellipse cx="18" cy="37" rx="2" ry="1" fill="#9e0e27" />
          </g>
          <g className="camel-leg-left">
            <line x1="24" y1="24" x2="22" y2="36" stroke="#9e0e27" strokeWidth="2.5" strokeLinecap="round" />
            <ellipse cx="22" cy="37" rx="2" ry="1" fill="#9e0e27" />
          </g>
        </svg>
      </div>
      <div className="flex items-center gap-1">
        <span className="typing-dot inline-block w-2 h-2 rounded-full bg-cueb-red" />
        <span className="typing-dot inline-block w-2 h-2 rounded-full bg-cueb-red" />
        <span className="typing-dot inline-block w-2 h-2 rounded-full bg-cueb-red" />
      </div>
    </div>
  );
}
