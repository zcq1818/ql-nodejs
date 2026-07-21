export const metadata = { title: 'Vercel 任务面板' };

export default function RootLayout({ children }) {
  return (
    <html lang="zh">
      <body
        style={{
          margin: 0,
          fontFamily: 'system-ui, -apple-system, sans-serif',
          background: '#0f1115',
          color: '#e6e6e6',
        }}
      >
        {children}
      </body>
    </html>
  );
}
