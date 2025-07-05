import { FC } from "react";

interface CardProps {
  children: React.ReactNode;
  className?: string;
  glassEffect?: boolean;
  interactive?: boolean;
}

export const Card: FC<CardProps> = ({
  children,
  className = "",
  glassEffect = false,
  interactive = false,
}) => {
  return (
    <div className={`
      card 
      ${glassEffect ? "glass" : ""} 
      ${interactive ? "interactive hover-lift" : ""}
      ${className}
    `}>
      {children}
    </div>
  );
};
