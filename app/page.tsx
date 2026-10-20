import { ChatShell } from '@/components/ChatShell';
import { RELEASE } from '@/lib/release';

export default function HomePage() {
  return <ChatShell edition={RELEASE.edition} editionLabel="Zenith" version={RELEASE.label} tagline="Asisten AI lokal untuk percakapan, riset, dan pengembangan terkontrol." />;
}
