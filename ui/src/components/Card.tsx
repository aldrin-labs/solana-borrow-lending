import { FC } from "react";

interface CardProps {
  children: React.ReactNode;
  className?: string;
  glassEffect?: boolean;
}

export const Card: FC<CardProps> = ({
  children,
  className = "",
  glassEffect = false,
}) => {
  return (
    <div className={`card ${glassEffect ? "glass-card" : ""} ${className}`}>
      {children}
    </div>
  );
};
