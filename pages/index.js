import dynamic from 'next/dynamic';
import Head from 'next/head';

// Dynamic import with SSR disabled — PulseApp uses browser APIs (clipboard, window)
const PulseApp = dynamic(() => import('../components/PulseApp'), { ssr: false });

export default function Home() {
  return (
    <>
      <Head>
        <title>The Pulse v2</title>
      </Head>
      <PulseApp />
    </>
  );
}
