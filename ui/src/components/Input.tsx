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
        <div 
          className="absolute left-3 top-1/2 transform -translate-y-1/2"
          style={{ color: 'var(--theme-textMuted)' }}
        >
          {icon}
        </div>
      )}
      <input
        className={`
          input 
          ${error ? "!border-error focus:!ring-error focus:!border-error" : ""} 
          ${fullWidth ? "w-full" : ""} 
          ${icon ? "pl-10" : ""}
          ${className}
        `}
        style={error ? {
          borderColor: 'var(--theme-error)',
          boxShadow: `0 0 0 3px color-mix(in srgb, var(--theme-error) 10%, transparent)`
        } : {}}
        {...props}
      />
    </div>
  );

  return (
    <div className={`space-y-2 ${fullWidth ? "w-full" : ""}`}>
      {label && (
        <div className="flex items-center space-x-2">
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
      
      {inputElement}
      
      {error && (
        <p 
          className="text-sm animate-slide-down"
          style={{ color: 'var(--theme-error)' }}
        >
          {error}
        </p>
      )}
    </div>
  );
};
