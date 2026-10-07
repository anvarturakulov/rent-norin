import type { Metadata } from 'next';
import { theme } from '@/app/theme/theme';

export const metadata: Metadata = {
  title: `Ускуна ижараси | ${theme.instanceName}`,
  description: 'Каталог инструментов для аренды',
  openGraph: {
    title: `Ускуна ижараси | ${theme.instanceName}`,
    description: 'Каталог инструментов для аренды',
  },
};

export default function ToolsCatalogLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
