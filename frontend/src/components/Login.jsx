import { LockKeyhole, ShieldCheck, Zap } from 'lucide-react';
import { useState } from 'react';

export function Login({ onLogin, busy }) {
  const [errors, setErrors] = useState({});

  async function submit(event) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const credentials = {
      email: form.get('email'),
      password: form.get('password')
    };
    const nextErrors = {};
    if (!String(credentials.email || '').includes('@')) nextErrors.email = 'Enter a valid email address.';
    if (!credentials.password) nextErrors.password = 'Password is required.';
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length) return;
    await onLogin(credentials);
  }

  return (
    <main className="auth-page">
      <section className="auth-copy">
        <p className="eyebrow">Secure store operations</p>
        <h1>ProductOps Console</h1>
        <p className="lede">
          Manage product search, inventory, pricing, and catalog changes from a protected React client backed by a scalable API.
        </p>
        <div className="feature-list">
          <span><ShieldCheck size={18} /> JWT protected</span>
          <span><Zap size={18} /> Redis cached</span>
          <span><LockKeyhole size={18} /> Rate limited</span>
        </div>
      </section>

      <form className="login-card glass-card" onSubmit={submit} noValidate>
        <div>
          <p className="eyebrow">Reviewer login</p>
          <h2>Admin sign in</h2>
        </div>
        <label>
          Email
          <input name="email" type="email" defaultValue="admin@example.com" aria-invalid={Boolean(errors.email)} />
          {errors.email && <span className="field-error">{errors.email}</span>}
        </label>
        <label>
          Password
          <input name="password" type="password" defaultValue="ChangeMe123!" aria-invalid={Boolean(errors.password)} />
          {errors.password && <span className="field-error">{errors.password}</span>}
        </label>
        <button type="submit" disabled={busy}>{busy ? 'Signing in...' : 'Sign in'}</button>
      </form>
    </main>
  );
}
