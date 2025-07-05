import { FC, useState } from "react";
import { TokenIcon } from "./TokenIcon";
import { Tooltip } from "./Tooltip";

interface TokenSelectorProps {
  tokens: string[];
  selectedToken: string;
  onSelect: (token: string) => void;
  label?: string;
  tooltip?: string;
}

export const TokenSelector: FC<TokenSelectorProps> = ({
  tokens,
  selectedToken,
  onSelect,
  label,
  tooltip,
}) => {
  const [isOpen, setIsOpen] = useState(false);

  const toggleDropdown = () => {
    setIsOpen(!isOpen);
  };

  const handleSelect = (token: string) => {
    onSelect(token);
    setIsOpen(false);
  };

  return (
    <div className="relative">
      {label && (
        <div className="flex items-center space-x-2 mb-2">
          <label 
            className="block text-sm font-medium"
            style={{ color: 'var(--theme-textSecondary)' }}
          >
            {label}
          </label>
          {tooltip && (
            <Tooltip content={tooltip} position="top">
              <div 
                className="w-4 h-4 rounded-full text-white text-xs flex items-center justify-center cursor-help"
                style={{ backgroundColor: 'var(--theme-textMuted)' }}
              >
                ?
              </div>
            </Tooltip>
          )}
        </div>
      )}
      
      <div className="token-selector interactive" onClick={toggleDropdown}>
        <div className="flex items-center">
          <TokenIcon token={selectedToken} size="sm" />
          <span 
            className="ml-2 font-medium"
            style={{ color: 'var(--theme-textPrimary)' }}
          >
            {selectedToken}
          </span>
        </div>
        <svg
          xmlns="http://www.w3.org/2000/svg"
          className={`h-5 w-5 transition-transform duration-200 ${isOpen ? "rotate-180" : ""}`}
          style={{ color: 'var(--theme-textSecondary)' }}
          viewBox="0 0 20 20"
          fill="currentColor"
        >
          <path
            fillRule="evenodd"
            d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z"
            clipRule="evenodd"
          />
        </svg>
      </div>

      {isOpen && (
        <div 
          className="absolute z-10 mt-1 w-full border rounded-lg max-h-60 overflow-auto animate-slide-down"
          style={{
            backgroundColor: 'var(--theme-card)',
            borderColor: 'var(--theme-border)',
            boxShadow: 'var(--theme-shadow-lg)',
          }}
        >
          {tokens.map((token) => (
            <div
              key={token}
              className="flex items-center px-4 py-3 cursor-pointer transition-colors duration-200 first:rounded-t-lg last:rounded-b-lg token-dropdown-item"
              onClick={() => handleSelect(token)}
            >
              <TokenIcon token={token} size="sm" />
              <span 
                className="ml-2 font-medium"
                style={{ color: 'var(--theme-textPrimary)' }}
              >
                {token}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
