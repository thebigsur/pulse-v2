import { Html, Head, Main, NextScript } from 'next/document';

export default function Document() {
  return (
    <Html lang="en">
      <Head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400;0,500;0,600;1,400&family=Instrument+Sans:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet" />
        <meta name="description" content="The Pulse v2 — LinkedIn Client Acquisition Engine" />
        <link rel="icon" href="/favicon.ico" />
      </Head>
      <body style={{ margin: 0, background: '#09090A' }}>
        <Main />
        <NextScript />
      </body>
    </Html>
  );
}
