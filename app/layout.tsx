export const metadata = {
  title: 'Video Factory',
  description: '用你的声音，把文档自动生成竖屏讲解视频'
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN">
      <body style={{ margin: 0, fontFamily: 'ui-sans-serif, system-ui, sans-serif', background: '#05070f' }}>{children}</body>
    </html>
  );
}
