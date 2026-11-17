import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Club Insights · Reclub',
  description: 'A clear, considered view of your club’s players, sessions and attendance.',
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}
