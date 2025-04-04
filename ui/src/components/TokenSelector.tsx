import { FC, useState } from "react";
import { TokenIcon } from "./TokenIcon";

interface TokenSelectorProps {
  tokens: string[];
  selectedToken: string;
  onSelect: (token: string) => void;
  label?: string;
}

export const TokenSelector: FC<TokenSelectorProps> = ({
  tokens,
  selectedToken,
  onSelect,
  label,
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
        <label className="block text-text-secondary mb-2 text-sm font-medium">
          {label}
        </label>
      )}
      <div className="token-selector" onClick={toggleDropdown}>
        <div className="flex items-center">
          <TokenIcon token={selectedToken} size="sm" />
          <span className="ml-2 font-medium">{selectedToken}</span>
        </div>
        <svg
          xmlns="http://www.w3.org/2000/svg"
          className={`h-5 w-5 text-text-secondary transition-transform ${isOpen ? "rotate-180" : ""}`}
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
        <div className="absolute z-10 mt-1 w-full bg-surface border border-border rounded-md shadow-lg max-h-60 overflow-auto">
          {tokens.map((token) => (
            <div
              key={token}
              className="flex items-center px-4 py-2 hover:bg-background cursor-pointer"
              onClick={() => handleSelect(token)}
            >
              <TokenIcon token={token} size="sm" />
              <span className="ml-2 font-medium">{token}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
