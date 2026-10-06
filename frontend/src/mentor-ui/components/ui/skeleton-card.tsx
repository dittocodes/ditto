
import React from 'react';
import { Card } from "@/components/ui/card";

interface SkeletonCardProps {
  height?: string;
  className?: string;
}

const SkeletonCard = ({ height = "h-full", className = "" }: SkeletonCardProps) => {
  return (
    <Card className={`bg-white/90 backdrop-blur-sm border-0 shadow-lg ${height} ${className} animate-pulse overflow-hidden`}>
      <div className="p-6">
        <div className="flex justify-between items-center mb-4">
          <div className="h-6 bg-gray-200 rounded w-1/3 animate-pulse"></div>
          <div className="h-10 w-10 rounded-full bg-gray-200 animate-pulse"></div>
        </div>
        <div className="h-10 bg-gray-200 rounded w-2/3 mb-4 animate-pulse"></div>
        <div className="h-4 bg-gray-200 rounded w-5/6 mb-4 animate-pulse"></div>
        <div className="flex items-center justify-center h-[200px]">
          <div className="h-40 w-40 rounded-full border-8 border-gray-200 flex items-center justify-center">
            <div className="h-28 w-28 rounded-full bg-gray-200"></div>
          </div>
        </div>
      </div>
    </Card>
  );
};

export default SkeletonCard;
