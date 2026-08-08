"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import { siteConfig } from "../../../site.config";

type Mode = "login" | "register" | "recover";
type Challenge = { question: string; token: string };

export default function CustomerAccessPage() {
  const [mode, setMode] = useState<Mode>("login");
  const [challenge, setChallenge] = useState<Challenge | null>(null);
  const [answer, setAnswer] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [recoveryCode, setRecoveryCode] = useState("");

  async function refreshChallenge() {
    setAnswer("");
    const response = await fetch("/api/customer/challenge", { cache: "no-store" });
    const data = (await response.json()) as Challenge & { error?: string };
    if (!response.ok) throw new Error(data.error ?? "Verification is unavailable.");
    setChallenge(data);
  }

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      void refreshChallenge().catch((caught) => setError(caught instanceof Error ? caught.message : "Verification is unavailable."));
    });
    return () => window.cancelAnimationFrame(frame);
  }, [mode]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!challenge) return;
    setBusy(true);
    setError("");
    setRecoveryCode("");
    const form = new FormData(event.currentTarget);
    const base = {
      username: String(form.get("username") ?? ""),
      challengeToken: challenge.token,
      challengeAnswer: answer,
    };
    const payload =
      mode === "register"
        ? {
            ...base,
            password: String(form.get("password") ?? ""),
            displayName: String(form.get("displayName") ?? ""),
            companyName: String(form.get("companyName") ?? ""),
            countryCode: String(form.get("countryCode") ?? ""),
            locale: String(form.get("locale") ?? "en"),
            privacyConsent: form.get("privacyConsent") === "on",
          }
        : mode === "recover"
          ? {
              ...base,
              recoveryCode: String(form.get("recoveryCode") ?? ""),
              newPassword: String(form.get("newPassword") ?? ""),
            }
          : { ...base, password: String(form.get("password") ?? "") };
    try {
      const response = await fetch(`/api/customer/auth/${mode}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = (await response.json()) as { error?: string; recoveryCode?: string };
      if (!response.ok) throw new Error(data.error ?? "Please try again.");
      if (data.recoveryCode) {
        setRecoveryCode(data.recoveryCode);
      } else {
        window.location.assign("/customer/feedback");
      }
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Please try again.");
      await refreshChallenge().catch(() => undefined);
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="customer-access-page">
      <header className="customer-simple-header">
        <Link className="brand" href="/">
          <img src="/logo-mark.svg" alt="" width={44} height={44} />
          <span><strong>{siteConfig.brandName}</strong><small>Biosciences</small></span>
        </Link>
        <Link href="/">Back to website</Link>
      </header>
      <section className="customer-access-shell">
        <div className="customer-access-intro">
          <p className="section-tag">CUSTOMER ACCESS</p>
          <h1>Your order feedback, in one light account.</h1>
          <p>Create an account without email verification. Link a real order later with the one-time code supplied by your sales contact.</p>
          <ul>
            <li>Only linked, delivered orders can receive customer feedback.</li>
            <li>Submissions are reviewed before publication.</li>
            <li>No medical, dosing, or efficacy claims are published.</li>
          </ul>
        </div>
        <div className="customer-access-card">
          <div className="customer-access-tabs" role="tablist">
            <button type="button" className={mode === "login" ? "active" : ""} onClick={() => setMode("login")}>Sign in</button>
            <button type="button" className={mode === "register" ? "active" : ""} onClick={() => setMode("register")}>Register</button>
            <button type="button" className={mode === "recover" ? "active" : ""} onClick={() => setMode("recover")}>Recover</button>
          </div>
          {recoveryCode ? (
            <div className="customer-recovery-result">
              <p className="section-tag">SAVE ONCE</p>
              <h2>Your recovery code</h2>
              <code>{recoveryCode}</code>
              <p>This code is shown once. Store it privately; the site does not send recovery email.</p>
              <button type="button" onClick={() => window.location.assign("/customer/feedback")}>Continue to customer area</button>
            </div>
          ) : (
            <form onSubmit={submit}>
              <label><span>Username</span><input name="username" autoComplete="username" minLength={3} maxLength={32} required /></label>
              {mode === "register" && (
                <>
                  <label><span>Display name</span><input name="displayName" maxLength={80} /></label>
                  <label><span>Company / organization</span><input name="companyName" maxLength={120} /></label>
                  <div className="customer-form-row">
                    <label><span>Country</span><select name="countryCode"><option value="US">United States</option><option value="CA">Canada</option><option value="BR">Brazil</option><option value="MX">Mexico</option></select></label>
                    <label><span>Language</span><select name="locale"><option value="en">English</option><option value="pt">Português</option><option value="es">Español</option><option value="fr">Français</option><option value="zh">中文</option></select></label>
                  </div>
                </>
              )}
              {mode === "recover" ? (
                <>
                  <label><span>Recovery code</span><input name="recoveryCode" autoComplete="off" required /></label>
                  <label><span>New password</span><input name="newPassword" type="password" autoComplete="new-password" minLength={10} maxLength={72} required /></label>
                </>
              ) : (
                <label><span>Password</span><input name="password" type="password" autoComplete={mode === "login" ? "current-password" : "new-password"} minLength={10} maxLength={72} required /></label>
              )}
              <label className="customer-challenge"><span>Verification: {challenge?.question ?? "…"}</span><input inputMode="numeric" value={answer} onChange={(event) => setAnswer(event.target.value)} required /></label>
              {mode === "register" && <label className="customer-consent"><input type="checkbox" name="privacyConsent" required /><span>I accept the privacy notice and account record retention.</span></label>}
              {error && <p className="customer-error" role="alert">{error}</p>}
              <button className="customer-submit" type="submit" disabled={busy || !challenge}>{busy ? "Please wait…" : mode === "login" ? "Sign in" : mode === "register" ? "Create account" : "Reset password"}</button>
            </form>
          )}
        </div>
      </section>
    </main>
  );
}
