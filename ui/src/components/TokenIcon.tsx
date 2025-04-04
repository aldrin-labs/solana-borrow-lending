import { FC } from "react";

interface TokenIconProps {
  token: string;
  size?: "sm" | "md" | "lg";
}

export const TokenIcon: FC<TokenIconProps> = ({ token, size = "md" }) => {
  // Map of token symbols to their colors
  const tokenColors: Record<string, string> = {
    SOL: "#9945FF",
    USDC: "#2775CA",
    ETH: "#627EEA",
    BTC: "#F7931A",
    // Add more tokens as needed
  };

  // Determine size class
  const sizeClass = {
    sm: "w-6 h-6 text-xs",
    md: "w-8 h-8 text-sm",
    lg: "w-10 h-10 text-base",
  }[size];

  // Use the token color if available, otherwise use a default color
  const bgColor = tokenColors[token] || "#6E8AFA";

  return (
    <div
      className={`${sizeClass} rounded-full flex items-center justify-center font-bold text-white shadow-md`}
      style={{
        background: `linear-gradient(135deg, ${bgColor}, ${adjustColor(bgColor, -20)})`,
        border: "1px solid rgba(255, 255, 255, 0.1)",
      }}
    >
      {token.substring(0, 1)}
    </div>
  );
};

// Helper function to darken/lighten a color
function adjustColor(color: string, amount: number): string {
  // Remove the leading # if it exists
  color = color.replace(/^#/, "");

  // Parse the color
  let r = parseInt(color.substring(0, 2), 16);
  let g = parseInt(color.substring(2, 4), 16);
  let b = parseInt(color.substring(4, 6), 16);

  // Adjust the color
  r = Math.max(0, Math.min(255, r + amount));
  g = Math.max(0, Math.min(255, g + amount));
  b = Math.max(0, Math.min(255, b + amount));

  // Convert back to hex
  return `#${r.toString(16).padStart(2, "0")}${g.toString(16).padStart(2, "0")}${b.toString(16).padStart(2, "0")}`;
}
