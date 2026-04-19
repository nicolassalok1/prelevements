import { describe, it, expect, vi } from 'vitest'
import userEvent from '@testing-library/user-event'
import { screen } from '@testing-library/react'
import { AuthPage } from '../AuthPage'
import { renderWithProviders, buildFakeAuth } from '../../test/helpers'

describe('AuthPage — login (default) mode', () => {
  it('renders login form with brand', () => {
    renderWithProviders(<AuthPage />)
    expect(screen.getByText('ANRAC')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Se connecter/i })).toBeInTheDocument()
  })

  it('submits signIn with email + password', async () => {
    const auth = buildFakeAuth()
    const user = userEvent.setup()
    renderWithProviders(<AuthPage />, { auth })

    await user.type(screen.getByPlaceholderText(/email@exemple/i), 'x@y.com')
    await user.type(screen.getByPlaceholderText('••••••••'), 'secret123')
    await user.click(screen.getByRole('button', { name: /Se connecter/i }))

    expect(auth.signIn).toHaveBeenCalledWith('x@y.com', 'secret123')
  })

  it('surfaces signIn errors from the API', async () => {
    const auth = buildFakeAuth({
      signIn: vi.fn().mockResolvedValue({ error: 'Identifiants invalides' }),
    })
    const user = userEvent.setup()
    renderWithProviders(<AuthPage />, { auth })

    await user.type(screen.getByPlaceholderText(/email@exemple/i), 'x@y.com')
    await user.type(screen.getByPlaceholderText('••••••••'), 'secret123')
    await user.click(screen.getByRole('button', { name: /Se connecter/i }))

    expect(await screen.findByText('Identifiants invalides')).toBeInTheDocument()
  })
})

describe('AuthPage — signup mode', () => {
  it('switches to signup when "S\'inscrire" is clicked', async () => {
    const user = userEvent.setup()
    renderWithProviders(<AuthPage />)

    await user.click(screen.getByRole('button', { name: /S'inscrire/i }))
    expect(screen.getByRole('button', { name: /Créer le compte/i })).toBeInTheDocument()
    expect(screen.getByPlaceholderText('Jean Dupont')).toBeInTheDocument()
  })

  it('rejects mismatched passwords without calling signUp', async () => {
    const auth = buildFakeAuth()
    const user = userEvent.setup()
    renderWithProviders(<AuthPage />, { auth })

    await user.click(screen.getByRole('button', { name: /S'inscrire/i }))
    await user.type(screen.getByPlaceholderText('Jean Dupont'), 'John')
    await user.type(screen.getByPlaceholderText(/email@exemple/i), 'x@y.com')
    const [pw, confirm] = screen.getAllByPlaceholderText('••••••••')
    await user.type(pw, 'secret123')
    await user.type(confirm, 'different')
    await user.click(screen.getByRole('button', { name: /Créer le compte/i }))

    expect(auth.signUp).not.toHaveBeenCalled()
    expect(await screen.findByText(/correspondent pas/i)).toBeInTheDocument()
  })

  it('submits signUp on valid form', async () => {
    const auth = buildFakeAuth()
    const user = userEvent.setup()
    renderWithProviders(<AuthPage />, { auth })

    await user.click(screen.getByRole('button', { name: /S'inscrire/i }))
    await user.type(screen.getByPlaceholderText('Jean Dupont'), 'John')
    await user.type(screen.getByPlaceholderText(/email@exemple/i), 'j@d.com')
    const [pw, confirm] = screen.getAllByPlaceholderText('••••••••')
    await user.type(pw, 'secret123')
    await user.type(confirm, 'secret123')
    await user.click(screen.getByRole('button', { name: /Créer le compte/i }))

    expect(auth.signUp).toHaveBeenCalledWith('j@d.com', 'secret123', 'John')
  })

  it('surfaces signUp errors', async () => {
    const auth = buildFakeAuth({
      signUp: vi.fn().mockResolvedValue({ error: 'Un compte existe déjà avec cet email.' }),
    })
    const user = userEvent.setup()
    renderWithProviders(<AuthPage />, { auth })

    await user.click(screen.getByRole('button', { name: /S'inscrire/i }))
    await user.type(screen.getByPlaceholderText('Jean Dupont'), 'John')
    await user.type(screen.getByPlaceholderText(/email@exemple/i), 'x@y.com')
    const [pw, confirm] = screen.getAllByPlaceholderText('••••••••')
    await user.type(pw, 'secret123')
    await user.type(confirm, 'secret123')
    await user.click(screen.getByRole('button', { name: /Créer le compte/i }))

    expect(await screen.findByText(/compte existe déjà/i)).toBeInTheDocument()
  })
})

describe('AuthPage — forgot password mode', () => {
  it('calls resetPassword', async () => {
    const auth = buildFakeAuth()
    const user = userEvent.setup()
    renderWithProviders(<AuthPage />, { auth })

    await user.click(screen.getByRole('button', { name: /Mot de passe oublié/i }))
    await user.type(screen.getByPlaceholderText(/email@exemple/i), 'x@y.com')
    await user.click(screen.getByRole('button', { name: /Envoyer le lien/i }))

    expect(auth.resetPassword).toHaveBeenCalledWith('x@y.com')
    expect(await screen.findByText(/réinitialisation envoyé/i)).toBeInTheDocument()
  })

  it('returns to login when back link clicked', async () => {
    const user = userEvent.setup()
    renderWithProviders(<AuthPage />)
    await user.click(screen.getByRole('button', { name: /Mot de passe oublié/i }))
    await user.click(screen.getByRole('button', { name: /Retour à la connexion/i }))
    expect(screen.getByRole('button', { name: /Se connecter/i })).toBeInTheDocument()
  })
})
