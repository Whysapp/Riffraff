import dynamic from 'next/dynamic';

const MusicTabGenerator = dynamic(() => import('@/components/MusicTabGenerator'), { ssr: false });

export default function Page() {
  return <MusicTabGenerator />;
}

