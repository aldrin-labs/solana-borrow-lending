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
          <label className="block text-text-secondary text-sm font-medium">
            {label}
          </label>
          {tooltip && (
            <Tooltip content={tooltip} position="top">
              <div className="w-4 h-4 rounded-full bg-gray-300 text-white text-xs flex items-center justify-center cursor-help">
                ?
              </div>
            </Tooltip>
          )}
        </div>
      )}
      
      <div className="token-selector interactive" onClick={toggleDropdown}>
        <div className="flex items-center">
          <TokenIcon token={selectedToken} size="sm" />
          <span className="ml-2 font-medium text-text-primary">{selectedToken}</span>
        </div>
        <svg
          xmlns="http://www.w3.org/2000/svg"
          className={`h-5 w-5 text-text-secondary transition-transform duration-200 ${isOpen ? "rotate-180" : ""}`}
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
        <div className="absolute z-10 mt-1 w-full bg-white border border-border rounded-lg shadow-lg max-h-60 overflow-auto animate-slide-down">
          {tokens.map((token) => (
            <div
              key={token}
              className="flex items-center px-4 py-3 hover:bg-gray-50 cursor-pointer transition-colors duration-200 first:rounded-t-lg last:rounded-b-lg"
              onClick={() => handleSelect(token)}
            >
              <TokenIcon token={token} size="sm" />
              <span className="ml-2 font-medium text-text-primary">{token}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
