import { useState, type FormEvent } from "react";
import { Navigate, useNavigate } from "react-router-dom";

import { useAuth } from "../auth/AuthProvider";
import { LoadingScreen } from "../components/LoadingScreen";
import { ApiError } from "../services/api";

function roleHome(role: "PROGRAM_OFFICER" | "REVIEWER") { return role === "PROGRAM_OFFICER" ? "/program" : "/reviewer"; }

export function LoginPage() {
  const { user, login, isLoading } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  if (isLoading) return <LoadingScreen />;
  if (user) return <Navigate to={roleHome(user.role)} replace />;

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const signedInUser = await login(email, password);
      navigate(roleHome(signedInUser.role), { replace: true });
    } catch (cause) {
      setError(cause instanceof ApiError ? cause.message : "Unable to sign in. Please try again.");
    } finally { setSubmitting(false); }
  };

  return <main className="login-page">
    <section className="login-intro">
      <p className="eyebrow">Grant Review System</p>
      <h1>Good decisions start with a clear view.</h1>
      <p>Sign in to manage grants, coordinate reviews, and keep decisions moving with confidence.</p>
    </section>
    <section className="login-card" aria-labelledby="login-title">
      <div className="brand compact"><span className="brand-mark">GR</span><span>Grant Review</span></div>
      <p className="eyebrow">Secure access</p>
      <h2 id="login-title">Welcome back</h2>
      <p className="muted">Use your Program Officer or Reviewer account.</p>
      <form onSubmit={submit}>
        <label>Email<input type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} required /></label>
        <label>Password<input type="password" autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} required /></label>
        {error && <p className="form-error" role="alert">{error}</p>}
        <button className="primary-button" type="submit" disabled={submitting}>{submitting ? "Signing in..." : "Sign in"}</button>
      </form>
    </section>
  </main>;
}
