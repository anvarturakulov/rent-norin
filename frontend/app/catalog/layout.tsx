import type { Metadata } from 'next';
import { theme } from '@/app/theme/theme';

export const metadata: Metadata = {
  title: `Каталог | ${theme.instanceName}`,
  description: 'Готовая продукция — каталог',
  openGraph: {
    title: `Каталог | ${theme.instanceName}`,
    description: 'Готовая продукция',
  },
};

export default function CatalogLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
