export const metadata = {
  title: 'FindMyPain — Body Intelligence',
  description: 'AI-powered pain assessment. Select your pain points, speak with our AI, and generate a report for your doctor.',
}

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body style={{ margin: 0, padding: 0, background: '#040d1a' }}>
        {children}
      </body>
    </html>
  )
}
