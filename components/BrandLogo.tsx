
import React from 'react';
import { Dog, ChefHat } from 'lucide-react';

interface BrandLogoProps {
  size?: 'normal' | 'large';
  className?: string;
}

const BrandLogo: React.FC<BrandLogoProps> = ({ size = 'normal', className = '' }) => {
  const isLarge = size === 'large';
  
  return (
    <div className={`relative flex items-center justify-center ${isLarge ? 'w-24 h-24' : 'w-10 h-10'} ${className}`}>
      {/* The Hyena (Dog) Base */}
      <div className={`absolute bottom-0 z-10 text-chef-900`}>
        <Dog className={`${isLarge ? 'w-16 h-16' : 'w-8 h-8'}`} />
      </div>
      
      {/* The Chef Hat (Slightly tilted on head) */}
      <div className={`absolute top-0 right-0 z-20 text-chef-600 -rotate-12 transform ${isLarge ? '-translate-x-5 -translate-y-1' : '-translate-x-1.5 -translate-y-1'}`}>
        <ChefHat className={`${isLarge ? 'w-12 h-12' : 'w-5 h-5'}`} />
      </div>
    </div>
  );
};

export default BrandLogo;
