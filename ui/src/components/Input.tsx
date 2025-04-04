import { FC, InputHTMLAttributes } from "react";

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  fullWidth?: boolean;
}

export const Input: FC<InputProps> = ({
  label,
  error,
  fullWidth = false,
  className = "",
  ...props
}) => {
  return (
    <div className={`mb-4 ${fullWidth ? "w-full" : ""}`}>
      {label && (
        <label className="block text-text-secondary mb-2 text-sm font-medium">
          {label}
        </label>
      )}
      <input
        className={`input ${error ? "border-error focus:ring-error" : ""} ${fullWidth ? "w-full" : ""} ${className}`}
        {...props}
      />
      {error && <p className="mt-1 text-error text-xs">{error}</p>}
    </div>
  );
};
