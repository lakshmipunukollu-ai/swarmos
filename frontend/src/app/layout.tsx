'use client'
import './globals.css'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useState, useEffect } from 'react'

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const [dark, setDark] = useState(true)

  useEffect(() => {
    const saved = localStorage.getItem('theme')
    const isDark = saved ? saved === 'dark' : true
    setDark(isDark)
    document.documentElement.classList.toggle('dark', isDark)
  }, [])

  const toggleTheme = () => {
    const next = !dark
    setDark(next)
    document.documentElement.classList.toggle('dark', next)
    localStorage.setItem('theme', next ? 'dark' : 'light')
  }

  const nav = [
    { href: '/', label: 'Dashboard' },
    { href: '/intake', label: 'Add project' },
    { href: '/quiz', label: 'Quiz' },
  ]

  return (
    <html lang="en" className="dark">
      <head>
        <title>SwarmOS</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;700&display=swap" rel="stylesheet" />
      </head>
      <body>
        <header style={{ borderBottom: '1px solid var(--border)', padding: '12px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 24 }}>
            <span style={{ fontSize: 18, fontWeight: 700, letterSpacing: 2 }}>
              SWARM<span style={{ color: 'var(--green)' }}>OS</span>
            </span>
            <nav style={{ display: 'flex', gap: 4 }}>
              {nav.map(n => (
                <Link key={n.href} href={n.href} style={{
                  padding: '5px 12px', fontSize: 12, borderRadius: 20,
                  textDecoration: 'none', letterSpacing: 1, textTransform: 'uppercase',
                  background: pathname === n.href ? 'var(--text)' : 'transparent',
                  color: pathname === n.href ? 'var(--bg)' : 'var(--muted)',
                  border: '1px solid var(--border)',
                }}>
                  {n.label}
                </Link>
              ))}
            </nav>
          </div>
          <button onClick={toggleTheme} style={{
            background: 'transparent', border: '1px solid var(--border)',
            borderRadius: 20, padding: '5px 12px', fontSize: 11,
            color: 'var(--muted)', cursor: 'pointer', letterSpacing: 1,
          }}>
            {dark ? 'Light' : 'Dark'}
          </button>
        </header>
        <main style={{ padding: '24px 20px', maxWidth: 1200, margin: '0 auto' }}>
          {children}
        </main>
      </body>
    </html>
  )
}
