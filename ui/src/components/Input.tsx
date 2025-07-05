import { FC, InputHTMLAttributes } from "react";
import { Tooltip } from "./Tooltip";

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  fullWidth?: boolean;
  tooltip?: string;
  icon?: React.ReactNode;
}

export const Input: FC<InputProps> = ({
  label,
  error,
  fullWidth = false,
  tooltip,
  icon,
  className = "",
  ...props
}) => {
  const inputElement = (
    <div className={`relative ${fullWidth ? "w-full" : ""}`}>
      {icon && (
        <div className="absolute left-3 top-1/2 transform -translate-y-1/2 text-text-muted">
          {icon}
        </div>
      )}
      <input
        className={`
          input 
          ${error ? "border-error focus:ring-error focus:border-error" : ""} 
          ${fullWidth ? "w-full" : ""} 
          ${icon ? "pl-10" : ""}
          ${className}
        `}
        {...props}
      />
    </div>
  );

  return (
    <div className={`space-y-2 ${fullWidth ? "w-full" : ""}`}>
      {label && (
        <div className="flex items-center space-x-2">
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
      
      {inputElement}
      
      {error && (
        <p className="text-error text-sm animate-slide-down">{error}</p>
      )}
    </div>
  );
};
