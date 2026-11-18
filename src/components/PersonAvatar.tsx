/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useState } from 'react';

interface PersonAvatarProps {
  photoUrl?: string;
  name: string;
  sizeClass?: string;
  roundedClass?: string;
  bgClass?: string;
  iconClass?: string;
  borderClass?: string;
  className?: string;
}

export const isSafeAvatarUrl = (url?: string): string | undefined => {
  if (!url) return undefined;
  const trimmed = url.trim();
  if (!trimmed) return undefined;
  if (/^(https?:\/\/|\/|data:image\/)/i.test(trimmed)) {
    return trimmed;
  }
  return undefined;
};

export const PersonAvatar: React.FC<PersonAvatarProps> = ({
  photoUrl,
  name,
  sizeClass = 'w-20 h-20',
  roundedClass = 'rounded-full',
  bgClass = 'bg-gradient-to-br from-emerald-100 to-stone-200',
  iconClass = 'text-emerald-800/75',
  borderClass = 'border-2 border-emerald-700/20',
  className = '',
}) => {
  const safeUrl = isSafeAvatarUrl(photoUrl);
  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    setHasError(false);
  }, [safeUrl]);

  const showImage = Boolean(safeUrl) && !hasError;

  return (
    <div
      className={`${sizeClass} ${roundedClass} ${bgClass} ${borderClass} flex items-center justify-center shrink-0 overflow-hidden select-none ${className}`}
      aria-label={name}
    >
      {showImage ? (
        <img
          src={safeUrl}
          alt={name}
          className="w-full h-full object-cover"
          referrerPolicy="no-referrer"
          onError={() => setHasError(true)}
        />
      ) : (
        <svg
          viewBox="0 0 64 64"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className={`w-[68%] h-[68%] ${iconClass}`}
          aria-hidden="true"
        >
          <circle cx="32" cy="22" r="12" fill="currentColor" />
          <path
            d="M12 56C12 43.8497 20.9543 36 32 36C43.0457 36 52 43.8497 52 56"
            fill="currentColor"
          />
        </svg>
      )}
    </div>
  );
};
