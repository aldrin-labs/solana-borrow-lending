import { FC } from 'react';

interface TokenIconProps {
  token: string;
  size?: 'sm' | 'md' | 'lg';
}

export const TokenIcon: FC<TokenIconProps> = ({ token, size = 'md' }) => {
  // Map of token symbols to their colors
  const tokenColors: Record<string, string> = {
    SOL: '#9945FF',
    USDC: '#2775CA',
    ETH: '#627EEA',
    BTC: '#F7931A',
    // Add more tokens as needed
  };

  // Determine size class
  const sizeClass = {
    sm: 'w-6 h-6 text-xs',
    md: 'w-8 h-8 text-sm',
    lg: 'w-10 h-10 text-base',
  }[size];

  // Use the token color if available, otherwise use a default color
  const bgColor = tokenColors[token] || '#6E8AFA';

  return (
    <div
      className={`${sizeClass} rounded-full flex items-center justify-center font-bold text-white`}
      style={{ backgroundColor: bgColor }}
    >
      {token.substring(0, 1)}
    </div>
  );
};