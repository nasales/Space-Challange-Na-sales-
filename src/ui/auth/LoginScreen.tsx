// Account screen: optional email + password login (Supabase Auth, see src/shared/auth.ts).
// Drawn as a detective ID card pinned on a comic page, in the same print style as the menu.
// LOGIN ONLY: nothing is saved per player yet. Play never needs an account.
import { useEffect, useId, useRef, useState, type CSSProperties, type FormEvent } from 'react'
import {
  authConfigured,
  resetPassword,
  signIn,
  signOut,
  signUp,
  updatePassword,
  useSession,
} from '../../shared/auth'
import panelBg from '../assets/menu/panel-bg.svg'
import './LoginScreen.css'
import { L } from '../../shared/i18n'

interface LoginScreenProps {
  onBack: () => void
  /** Opened from a password reset email: ask for the new password once signed in. */
  recovery?: boolean
}

type Mode = 'signin' | 'signup' | 'reset'
type Notice = { kind: 'error' | 'success'; text: string } | null

const MIN_PASSWORD = 6
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

// Supabase messages are already English; a few get a friendlier wording.
function friendly(error: string): string {
  const e = error.toLowerCase()
  if (e.includes('invalid login credentials')) return L('Wrong email or password.', 'Email o contraseña incorrectos.')
  if (e.includes('email not confirmed'))
    return L('Confirm your email first: open the link we sent you.', 'Primero confirma tu email: abre el enlace que te enviamos.')
  if (e.includes('already registered'))
    return L('This email already has an account. Sign in instead.', 'Este email ya tiene una cuenta. Entra con ella.')
  if (e.includes('rate limit')) return L('Too many attempts. Wait a minute and try again.', 'Demasiados intentos. Espera un minuto y vuelve a probar.')
  if (e.includes('failed to fetch') || e.includes('network'))
    return L('No connection to the account server. Try again later.', 'No hay conexión con el servidor de cuentas. Prueba más tarde.')
  return error
}

function PasswordField({
  id,
  label,
  value,
  onChange,
  autoComplete,
}: {
  id: string
  label: string
  value: string
  onChange: (v: string) => void
  autoComplete: string
}) {
  const [show, setShow] = useState(false)
  return (
    <div className="login-field">
      <label className="login-field__label" htmlFor={id}>
        {label}
      </label>
      <div className="login-field__row">
        <input
          id={id}
          className="login-field__input"
          type={show ? 'text' : 'password'}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          autoComplete={autoComplete}
          minLength={MIN_PASSWORD}
          required
          aria-describedby={`${id}-hint`}
        />
        <button
          type="button"
          className="login-field__toggle"
          onClick={() => setShow((s) => !s)}
          aria-pressed={show}
          aria-controls={id}
        >
          {show ? L('Hide', 'Ocultar') : L('Show', 'Mostrar')}
        </button>
      </div>
      <span className="login-field__hint" id={`${id}-hint`}>
        {L(`At least ${MIN_PASSWORD} characters`, `Al menos ${MIN_PASSWORD} caracteres`)}
      </span>
    </div>
  )
}

export default function LoginScreen({ onBack, recovery = false }: LoginScreenProps) {
  const uid = useId()
  const { user, loading } = useSession(true)
  const [mode, setMode] = useState<Mode>('signin')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [changing, setChanging] = useState(recovery)
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState<Notice>(null)
  const emailRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onBack()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onBack])

  const switchMode = (next: Mode) => {
    setMode(next)
    setNotice(null)
    requestAnimationFrame(() => emailRef.current?.focus())
  }

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (busy) return
    const mail = email.trim()
    if (!EMAIL_RE.test(mail)) return setNotice({ kind: 'error', text: L('Enter a valid email address.', 'Escribe un email válido.') })
    if (mode !== 'reset' && password.length < MIN_PASSWORD)
      return setNotice({
        kind: 'error',
        text: L(`The password needs at least ${MIN_PASSWORD} characters.`, `La contraseña necesita al menos ${MIN_PASSWORD} caracteres.`),
      })
    setBusy(true)
    setNotice(null)
    if (mode === 'signin') {
      const r = await signIn(mail, password)
      if (r.error) setNotice({ kind: 'error', text: friendly(r.error) })
      else setPassword('')
    } else if (mode === 'signup') {
      const r = await signUp(mail, password)
      if (r.error) setNotice({ kind: 'error', text: friendly(r.error) })
      else {
        setPassword('')
        setNotice({
          kind: 'success',
          text: r.needsConfirmation
            ? L('Check your email to confirm your account, then sign in.', 'Revisa tu email para confirmar la cuenta y luego entra.')
            : L('Account created. You are signed in.', 'Cuenta creada. Ya has entrado.'),
        })
      }
    } else {
      const r = await resetPassword(mail)
      if (r.error) setNotice({ kind: 'error', text: friendly(r.error) })
      else
        setNotice({
          kind: 'success',
          text: L(
            'If this email has an account, a reset link is on its way. Check your inbox.',
            'Si este email tiene cuenta, te llegará un enlace para restablecerla. Revisa tu bandeja de entrada.',
          ),
        })
    }
    setBusy(false)
  }

  const onSignOut = async () => {
    setBusy(true)
    const r = await signOut()
    setBusy(false)
    setNotice(r.error ? { kind: 'error', text: friendly(r.error) } : { kind: 'success', text: L('Signed out.', 'Has salido.') })
  }

  const onNewPassword = async (e: FormEvent) => {
    e.preventDefault()
    if (busy) return
    if (newPassword.length < MIN_PASSWORD)
      return setNotice({
        kind: 'error',
        text: L(`The password needs at least ${MIN_PASSWORD} characters.`, `La contraseña necesita al menos ${MIN_PASSWORD} caracteres.`),
      })
    setBusy(true)
    const r = await updatePassword(newPassword)
    setBusy(false)
    if (r.error) return setNotice({ kind: 'error', text: friendly(r.error) })
    setNewPassword('')
    setChanging(false)
    setNotice({ kind: 'success', text: L('Password updated.', 'Contraseña actualizada.') })
  }

  const pageStyle = { '--panel-bg': `url("${panelBg}")` } as CSSProperties
  const titles: Record<Mode, string> = {
    signin: L('Sign in', 'Entrar'),
    signup: L('Create account', 'Crear cuenta'),
    reset: L('Reset password', 'Restablecer contraseña'),
  }

  let body
  if (!authConfigured) {
    body = (
      <p className="login-note">
        {L(
          'Accounts are not available in this build. You can still play every case without an account.',
          'Las cuentas no están disponibles en esta versión. Puedes jugar todos los casos sin cuenta.',
        )}
      </p>
    )
  } else if (loading) {
    body = (
      <p className="login-note" role="status">
        {L('Checking your badge…', 'Comprobando tu placa…')}
      </p>
    )
  } else if (user) {
    body = (
      <div className="login-signed">
        <p className="login-signed__label">{L('Signed in as', 'Has entrado como')}</p>
        <p className="login-signed__email">{user.email}</p>
        {changing ? (
          <form className="login-form" onSubmit={onNewPassword} noValidate>
            <PasswordField
              id={`${uid}-newpw`}
              label={L('New password', 'Nueva contraseña')}
              value={newPassword}
              onChange={setNewPassword}
              autoComplete="new-password"
            />
            <button type="submit" className="login-btn login-btn--main" disabled={busy}>
              {busy ? L('Saving…', 'Guardando…') : L('Save new password', 'Guardar la nueva contraseña')}
            </button>
          </form>
        ) : (
          <button type="button" className="login-link" onClick={() => setChanging(true)}>
            {L('Change password', 'Cambiar contraseña')}
          </button>
        )}
        <button type="button" className="login-btn login-btn--alt" onClick={onSignOut} disabled={busy}>
          {L('Sign out', 'Salir')}
        </button>
      </div>
    )
  } else {
    body = (
      <>
        {mode !== 'reset' && (
          <div className="login-tabs" role="tablist" aria-label={L('Account', 'Cuenta')}>
            {(['signin', 'signup'] as const).map((m) => (
              <button
                key={m}
                type="button"
                role="tab"
                id={`${uid}-tab-${m}`}
                className="login-tab"
                aria-selected={mode === m}
                aria-controls={`${uid}-panel`}
                tabIndex={mode === m ? 0 : -1}
                onClick={() => switchMode(m)}
                onKeyDown={(e) => {
                  if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
                    e.preventDefault()
                    const next = m === 'signin' ? 'signup' : 'signin'
                    setMode(next)
                    setNotice(null)
                    requestAnimationFrame(() => document.getElementById(`${uid}-tab-${next}`)?.focus())
                  }
                }}
              >
                {titles[m]}
              </button>
            ))}
          </div>
        )}
        <form
          id={`${uid}-panel`}
          className="login-form"
          role={mode === 'reset' ? undefined : 'tabpanel'}
          aria-labelledby={mode === 'reset' ? `${uid}-reset-title` : `${uid}-tab-${mode}`}
          onSubmit={onSubmit}
          noValidate
        >
          {mode === 'reset' && (
            <>
              <h2 className="login-form__title" id={`${uid}-reset-title`}>
                {L('Reset password', 'Restablecer contraseña')}
              </h2>
              <p className="login-form__intro">
                {L('We will email you a link to choose a new password.', 'Te enviaremos un enlace por email para elegir una contraseña nueva.')}
              </p>
            </>
          )}
          <div className="login-field">
            <label className="login-field__label" htmlFor={`${uid}-email`}>
              {L('Email', 'Email')}
            </label>
            <input
              ref={emailRef}
              id={`${uid}-email`}
              className="login-field__input"
              type="email"
              inputMode="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoFocus
            />
          </div>
          {mode !== 'reset' && (
            <PasswordField
              id={`${uid}-pw`}
              label={L('Password', 'Contraseña')}
              value={password}
              onChange={setPassword}
              autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
            />
          )}
          <button type="submit" className="login-btn login-btn--main" disabled={busy}>
            {busy ? L('One moment…', 'Un momento…') : mode === 'reset' ? L('Send reset link', 'Enviar enlace') : titles[mode]}
          </button>
          {mode === 'signin' && (
            <button type="button" className="login-link" onClick={() => switchMode('reset')}>
              {L('Forgot password?', '¿Has olvidado la contraseña?')}
            </button>
          )}
          {mode === 'reset' && (
            <button type="button" className="login-link" onClick={() => switchMode('signin')}>
              {L('Back to sign in', 'Volver a entrar')}
            </button>
          )}
        </form>
      </>
    )
  }

  return (
    <section className="login" aria-labelledby={`${uid}-title`}>
      <div className="login__page" style={pageStyle}>
        <button type="button" className="login-back" onClick={onBack} aria-label={L('Back to the menu (Escape)', 'Volver al menú (Escape)')}>
          <svg className="login-back__arrow" viewBox="0 0 32 24" aria-hidden="true" focusable="false">
            <path d="M13 3L3 12l10 9v-5.5h16v-7H13z" />
          </svg>
          <span className="login-back__word">{L('Back', 'Volver')}</span>
          <span className="login-back__key" aria-hidden="true">
            Esc
          </span>
        </button>

        <div className="login-card">
          <span className="login-card__pin" aria-hidden="true" />
          <h1 className="login-card__title" id={`${uid}-title`}>
            {L('Detective ID', 'Placa de detective')}
          </h1>
          <p className="login-card__tagline">{L('Optional. Play works without an account.', 'Opcional. Puedes jugar sin cuenta.')}</p>
          {body}
          <div className="login-notice" aria-live="polite">
            {notice && (
              <p className={`login-notice__box login-notice__box--${notice.kind}`}>{notice.text}</p>
            )}
          </div>
        </div>
      </div>
    </section>
  )
}
