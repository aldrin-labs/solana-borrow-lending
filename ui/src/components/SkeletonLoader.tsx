"use client";

import { FC } from "react";

interface SkeletonLoaderProps {
  type: "text" | "title" | "card" | "table-row" | "custom";
  width?: string;
  height?: string;
  count?: number;
  className?: string;
}

export const SkeletonLoader: FC<SkeletonLoaderProps> = ({
  type,
  width,
  height,
  count = 1,
  className = "",
}) => {
  const getSkeletonClass = () => {
    switch (type) {
      case "text":
        return "skeleton skeleton-text";
      case "title":
        return "skeleton skeleton-title";
      case "card":
        return "skeleton skeleton-card";
      case "table-row":
        return "skeleton skeleton-table-row";
      case "custom":
        return "skeleton";
      default:
        return "skeleton";
    }
  };

  const style = {
    ...(width && { width }),
    ...(height && { height }),
  };

  return (
    <>
      {Array.from({ length: count }).map((_, index) => (
        <div
          key={index}
          className={`${getSkeletonClass()} ${className}`}
          style={style}
          aria-label="Loading..."
        />
      ))}
    </>
  );
};

// Specific skeleton components for common use cases
export const CardSkeleton: FC<{ className?: string }> = ({ className = "" }) => (
  <div className={`card ${className}`}>
    <SkeletonLoader type="title" width="60%" />
    <SkeletonLoader type="text" count={3} />
    <div className="mt-4 flex gap-2">
      <SkeletonLoader type="custom" width="80px" height="32px" />
      <SkeletonLoader type="custom" width="80px" height="32px" />
    </div>
  </div>
);

export const TableSkeleton: FC<{ rows?: number; className?: string }> = ({
  rows = 5,
  className = "",
}) => (
  <div className={`table-container ${className}`}>
    <div className="table-header py-3 px-4">
      <SkeletonLoader type="text" width="100px" />
    </div>
    {Array.from({ length: rows }).map((_, index) => (
      <div key={index} className="table-row">
        <SkeletonLoader type="table-row" />
      </div>
    ))}
  </div>
);

export const StatsSkeleton: FC<{ className?: string }> = ({ className = "" }) => (
  <div className={`stats-card ${className}`}>
    <SkeletonLoader type="text" width="120px" />
    <SkeletonLoader type="title" width="80px" />
    <SkeletonLoader type="text" width="60px" />
  </div>
);