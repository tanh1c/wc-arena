import type { ReactNode } from 'react';

export const LEGACY_PAGE_HEADER_CLASS_NAME = 'flex items-center justify-between border-b-4 border-main px-4 md:px-6 py-4 bg-card z-30 sticky top-0 shrink-0 gap-4';

type LegacyPageHeaderProps = {
  children: ReactNode;
  className?: string;
};

export default function LegacyPageHeader({ children, className = '' }: LegacyPageHeaderProps) {
  return (
    <header className={`${LEGACY_PAGE_HEADER_CLASS_NAME} ${className}`.trim()}>
      {children}
    </header>
  );
}
