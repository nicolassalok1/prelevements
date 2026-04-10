import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { useAppStore } from '../store/useAppStore'
import { useAuth } from '../contexts/AuthContext'
import { changeLanguage } from '../i18n'

const LANGS = [
  { code: 'fr', label: 'FR' },
  { code: 'en', label: 'EN' },
  { code: 'ar', label: 'عر' },
] as const

export function Header() {
  const { t, i18n } = useTranslation()
  const statusText = useAppStore((s) => s.statusText)
  const setHelpOpen = useAppStore((s) => s.setHelpOpen)
  const helpOpen = useAppStore((s) => s.helpOpen)
  const sidebarOpen = useAppStore((s) => s.sidebarOpen)
  const toggleSidebar = useAppStore((s) => s.toggleSidebar)
  const { user, signOut } = useAuth()
  const [online, setOnline] = useState(navigator.onLine)
  const [langOpen, setLangOpen] = useState(false)

  useEffect(() => {
    const on = () => setOnline(true)
    const off = () => setOnline(false)
    window.addEventListener('online', on)
    window.addEventListener('offline', off)
    return () => { window.removeEventListener('online', on); window.removeEventListener('offline', off) }
  }, [])

  // Close lang dropdown on outside click
  useEffect(() => {
    if (!langOpen) return
    const close = () => setLangOpen(false)
    window.addEventListener('click', close)
    return () => window.removeEventListener('click', close)
  }, [langOpen])

  const currentLang = LANGS.find((l) => l.code === i18n.language) ?? LANGS[0]

  return (
    <header className="col-span-full bg-panel border-b border-border flex items-center gap-2 md:gap-4 px-3 md:px-5 h-[48px] md:h-[52px]">
      <button
        onClick={toggleSidebar}
        className={`font-mono text-[13px] border w-9 h-9 md:w-7 md:h-7 flex items-center justify-center cursor-pointer transition-all shrink-0
          ${sidebarOpen ? 'border-olive-lit text-olive-lit bg-olive/10' : 'border-border text-muted hover:border-olive-lit hover:text-olive-lit'}`}
        title={sidebarOpen ? t('header.hide_tools') : t('header.show_tools')}
      >
        ☰
      </button>
      <div className="font-mono text-[11px] text-olive-lit tracking-[2px] border border-olive px-2 py-0.5 shrink-0">
        {t('app.brand')}
      </div>
      <h1 className="hidden md:block text-[15px] font-semibold tracking-[3px] uppercase text-text">
        {t('app.title')}
      </h1>
      <div className="flex-1" />
      <div className="font-mono text-[10px] md:text-[11px] flex items-center gap-2 md:gap-3">
        <div className={`flex items-center gap-1 px-1.5 md:px-2 py-0.5 border ${online ? 'border-olive text-olive-lit' : 'border-amber text-amber'}`}>
          <div className={`w-1.5 h-1.5 rounded-full ${online ? 'bg-olive-lit animate-[pulse_2s_infinite]' : 'bg-amber'}`} />
          <span className="hidden sm:inline">{online ? t('header.online') : t('header.offline')}</span>
        </div>
        <span className="text-muted hidden sm:inline">{statusText}</span>
      </div>
      {user && (
        <div className="flex items-center gap-1.5 md:gap-2">
          <span className="hidden sm:inline text-[10px] text-muted truncate max-w-[100px] md:max-w-[120px]" title={user.email}>
            {user.email}
          </span>

          {/* Language selector */}
          <div className="relative">
            <button
              onClick={(e) => { e.stopPropagation(); setLangOpen(!langOpen) }}
              className="font-mono text-[10px] text-muted border border-border px-1.5 md:px-2 py-0.5 cursor-pointer hover:border-amber hover:text-amber transition-all flex items-center gap-1 h-8 md:h-auto"
              title="Langue"
            >
              {currentLang.label}
              <span className="text-[8px]">▼</span>
            </button>
            {langOpen && (
              <div className="absolute top-full right-0 mt-1 bg-[var(--color-panel)] border border-[var(--color-border)] z-[1000] min-w-[80px] shadow-lg">
                {LANGS.map((lang) => (
                  <button
                    key={lang.code}
                    onClick={() => { changeLanguage(lang.code); setLangOpen(false) }}
                    className={`block w-full text-left px-3 py-2.5 md:py-1.5 text-[12px] md:text-[11px] font-mono cursor-pointer transition-colors
                      ${i18n.language === lang.code
                        ? 'text-[var(--color-amber)] bg-[var(--color-amber)]/10'
                        : 'text-[var(--color-text)] hover:bg-[var(--color-olive)]/10 hover:text-[var(--color-olive-lit)]'
                      }`}
                  >
                    {lang.label}
                  </button>
                ))}
              </div>
            )}
          </div>

          <button
            onClick={signOut}
            className="font-mono text-[10px] text-muted border border-border px-1.5 md:px-2 py-0.5 cursor-pointer hover:border-red hover:text-red transition-all h-8 md:h-auto"
            title={t('header.logout')}
          >
            ⏻
          </button>
        </div>
      )}
      <button
        onClick={() => setHelpOpen(!helpOpen)}
        className="font-mono text-[13px] text-muted border border-border w-9 h-9 md:w-7 md:h-7 flex items-center justify-center cursor-pointer hover:border-olive-lit hover:text-olive-lit transition-all shrink-0"
      >
        ?
      </button>
    </header>
  )
}
