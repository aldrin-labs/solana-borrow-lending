import { FC } from "react";

interface TokenIconProps {
  token: string;
  size?: "sm" | "md" | "lg" | number;
}

export const TokenIcon: FC<TokenIconProps> = ({ token, size = "md" }) => {
  // Map of token symbols to their colors
  const tokenColors: Record<string, string> = {
    SOL: "#9945FF",
    USDC: "#2775CA",
    ETH: "#627EEA",
    BTC: "#F7931A",
    USDT: "#26A17B",
    // Add more tokens as needed
  };

  // Determine size styling
  let sizeClass: string;
  let style: React.CSSProperties = {};

  if (typeof size === "number") {
    style.width = `${size}px`;
    style.height = `${size}px`;
    style.fontSize = `${Math.max(10, size * 0.4)}px`;
    sizeClass = "flex items-center justify-center font-bold text-white shadow-md";
  } else {
    const sizeClasses = {
      sm: "w-6 h-6 text-xs",
      md: "w-8 h-8 text-sm",
      lg: "w-10 h-10 text-base",
    };
    sizeClass = `${sizeClasses[size]} flex items-center justify-center font-bold text-white shadow-md`;
  }

  // Use the token color if available, otherwise use a default color
  const bgColor = tokenColors[token] || "#6E8AFA";

  const iconStyle = {
    ...style,
    background: `linear-gradient(135deg, ${bgColor}, ${adjustColor(bgColor, -20)})`,
    border: "1px solid rgba(255, 255, 255, 0.1)",
  };

  return (
    <div
      className={`${sizeClass} rounded-full`}
      style={iconStyle}
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
