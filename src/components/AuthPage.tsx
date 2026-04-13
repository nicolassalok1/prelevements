import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../contexts/AuthContext'
import { changeLanguage } from '../i18n'

const LANGS = [
  { code: 'fr', label: 'FR' },
  { code: 'en', label: 'EN' },
] as const

type AuthMode = 'login' | 'signup' | 'forgot'

export function AuthPage() {
  const { t, i18n } = useTranslation()
  const { signIn, signUp, resetPassword } = useAuth()
  const [mode, setMode] = useState<AuthMode>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [fullName, setFullName] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const reset = () => {
    setError(null)
    setSuccess(null)
    setPassword('')
    setConfirmPassword('')
  }

  const switchMode = (m: AuthMode) => {
    reset()
    setMode(m)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setSuccess(null)
    setSubmitting(true)

    try {
      if (mode === 'forgot') {
        const { error } = await resetPassword(email)
        if (error) setError(error)
        else setSuccess(t('auth.success_forgot'))
      } else if (mode === 'signup') {
        if (password !== confirmPassword) {
          setError(t('auth.error_password_match'))
          setSubmitting(false)
          return
        }
        if (password.length < 6) {
          setError(t('auth.error_password_length'))
          setSubmitting(false)
          return
        }
        const { error } = await signUp(email, password, fullName)
        if (error) setError(error)
        else {
          setSuccess(t('auth.success_signup'))
          setTimeout(() => { switchMode('login') }, 2000)
        }
      } else {
        const { error } = await signIn(email, password)
        if (error) setError(error)
      }
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="min-h-screen bg-[var(--color-bg)] flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        {/* Language selector */}
        <div className="flex justify-center gap-1 mb-6">
          {LANGS.map((lang) => (
            <button
              key={lang.code}
              onClick={() => changeLanguage(lang.code)}
              className={`font-mono text-[11px] px-3 py-1 border cursor-pointer transition-all
                ${i18n.language === lang.code
                  ? 'border-[var(--color-amber)] text-[var(--color-amber)] bg-[var(--color-amber)]/10'
                  : 'border-[var(--color-border)] text-[var(--color-muted)] hover:border-[var(--color-olive-lit)] hover:text-[var(--color-olive-lit)]'
                }`}
            >
              {lang.label}
            </button>
          ))}
        </div>

        {/* Logo / Title */}
        <div className="text-center mb-8">
          <div className="text-3xl font-bold tracking-widest text-[var(--color-olive-lit)] font-[var(--font-mono)]">
            {t('app.brand')}
          </div>
          <div className="text-[var(--color-muted)] text-sm mt-1 tracking-wider uppercase">
            {t('app.subtitle')}
          </div>
        </div>

        {/* Card */}
        <div className="bg-[var(--color-panel)] border border-[var(--color-border)] p-8">
          <h2 className="text-lg font-semibold tracking-wider uppercase text-[var(--color-text)] mb-6">
            {mode === 'login' && t('auth.login')}
            {mode === 'signup' && t('auth.signup')}
            {mode === 'forgot' && t('auth.forgot')}
          </h2>

          <form onSubmit={handleSubmit} className="space-y-4">
            {mode === 'signup' && (
              <div>
                <label className="block text-[var(--color-muted)] text-xs uppercase tracking-wider mb-1">
                  {t('auth.fullName')}
                </label>
                <input
                  type="text"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  required
                  className="w-full bg-[var(--color-bg)] border border-[var(--color-border)] text-[var(--color-text)] px-3 py-2 text-sm font-[var(--font-mono)] focus:border-[var(--color-olive)] focus:outline-none transition-colors"
                  placeholder="Jean Dupont"
                />
              </div>
            )}

            <div>
              <label className="block text-[var(--color-muted)] text-xs uppercase tracking-wider mb-1">
                {t('auth.email')}
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="w-full bg-[var(--color-bg)] border border-[var(--color-border)] text-[var(--color-text)] px-3 py-2 text-sm font-[var(--font-mono)] focus:border-[var(--color-olive)] focus:outline-none transition-colors"
                placeholder="email@exemple.com"
              />
            </div>

            {mode !== 'forgot' && (
              <div>
                <label className="block text-[var(--color-muted)] text-xs uppercase tracking-wider mb-1">
                  {t('auth.password')}
                </label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={6}
                  className="w-full bg-[var(--color-bg)] border border-[var(--color-border)] text-[var(--color-text)] px-3 py-2 text-sm font-[var(--font-mono)] focus:border-[var(--color-olive)] focus:outline-none transition-colors"
                  placeholder="••••••••"
                />
              </div>
            )}

            {mode === 'signup' && (
              <div>
                <label className="block text-[var(--color-muted)] text-xs uppercase tracking-wider mb-1">
                  {t('auth.confirmPassword')}
                </label>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  minLength={6}
                  className="w-full bg-[var(--color-bg)] border border-[var(--color-border)] text-[var(--color-text)] px-3 py-2 text-sm font-[var(--font-mono)] focus:border-[var(--color-olive)] focus:outline-none transition-colors"
                  placeholder="••••••••"
                />
              </div>
            )}

            {error && (
              <div className="text-[var(--color-red)] text-xs border border-[var(--color-red)] bg-[var(--color-red)]/10 px-3 py-2">
                {error}
              </div>
            )}

            {success && (
              <div className="text-[var(--color-olive-lit)] text-xs border border-[var(--color-olive)] bg-[var(--color-olive)]/10 px-3 py-2">
                {success}
              </div>
            )}

            <button
              type="submit"
              disabled={submitting}
              className="btn-active w-full py-2.5 text-sm tracking-wider disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {submitting ? (
                <span className="inline-block animate-pulse">...</span>
              ) : mode === 'login' ? (
                t('auth.submit_login')
              ) : mode === 'signup' ? (
                t('auth.submit_signup')
              ) : (
                t('auth.submit_forgot')
              )}
            </button>
          </form>

          {/* Links */}
          <div className="mt-6 space-y-2 text-center">
            {mode === 'login' && (
              <>
                <button
                  onClick={() => switchMode('forgot')}
                  className="block w-full text-[var(--color-muted)] text-xs hover:text-[var(--color-amber)] transition-colors"
                >
                  {t('auth.forgot_link')}
                </button>
                <button
                  onClick={() => switchMode('signup')}
                  className="block w-full text-[var(--color-muted)] text-xs hover:text-[var(--color-olive-lit)] transition-colors"
                >
                  {t('auth.no_account')} <span className="text-[var(--color-olive-lit)]">{t('auth.signup_link')}</span>
                </button>
              </>
            )}
            {mode === 'signup' && (
              <button
                onClick={() => switchMode('login')}
                className="block w-full text-[var(--color-muted)] text-xs hover:text-[var(--color-olive-lit)] transition-colors"
              >
                {t('auth.has_account')} <span className="text-[var(--color-olive-lit)]">{t('auth.login_link')}</span>
              </button>
            )}
            {mode === 'forgot' && (
              <button
                onClick={() => switchMode('login')}
                className="block w-full text-[var(--color-muted)] text-xs hover:text-[var(--color-olive-lit)] transition-colors"
              >
                {t('auth.back_login')}
              </button>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="text-center mt-6 text-[var(--color-muted)] text-[10px] tracking-wider uppercase">
          {t('app.footer')}
        </div>
      </div>
    </div>
  )
}
