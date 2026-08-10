"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import {
  htmlLang,
  isSiteLocale,
  LANGUAGE_OPTIONS,
  LOCALE_STORAGE_KEY,
  type SiteLocale,
} from "../../i18n";
import { siteConfig } from "../../../site.config";

type Mode = "login" | "register" | "recover";
type Challenge = { question: string; token: string };

const copy: Record<SiteLocale, {
  back: string;
  language: string;
  tag: string;
  title: string;
  intro: string;
  bullets: [string, string, string];
  tabs: Record<Mode, string>;
  saveOnce: string;
  recoveryTitle: string;
  recoveryNote: string;
  continue: string;
  username: string;
  displayName: string;
  company: string;
  country: string;
  accountLanguage: string;
  recoveryCode: string;
  newPassword: string;
  password: string;
  verification: string;
  consent: string;
  wait: string;
  submit: Record<Mode, string>;
  unavailable: string;
  retry: string;
  countries: Record<"US" | "CA" | "BR" | "MX", string>;
}> = {
  en: {
    back: "Back to website",
    language: "Language",
    tag: "CUSTOMER ACCESS",
    title: "Your order feedback, in one light account.",
    intro: "Create an account without email verification. Link a real order later with the one-time code supplied by your sales contact.",
    bullets: [
      "Only linked, delivered orders can receive customer feedback.",
      "Submissions are reviewed before publication.",
      "No medical, dosing, or efficacy claims are published.",
    ],
    tabs: { login: "Sign in", register: "Register", recover: "Recover" },
    saveOnce: "SAVE ONCE",
    recoveryTitle: "Your recovery code",
    recoveryNote: "This code is shown once. Store it privately; the site does not send recovery email.",
    continue: "Continue to customer area",
    username: "Username",
    displayName: "Display name",
    company: "Company / organization",
    country: "Country",
    accountLanguage: "Account language",
    recoveryCode: "Recovery code",
    newPassword: "New password",
    password: "Password",
    verification: "Verification",
    consent: "I accept the privacy notice.",
    wait: "Please wait…",
    submit: { login: "Sign in", register: "Create account", recover: "Reset password" },
    unavailable: "Verification is unavailable.",
    retry: "Please try again.",
    countries: { US: "United States", CA: "Canada", BR: "Brazil", MX: "Mexico" },
  },
  pt: {
    back: "Voltar ao site",
    language: "Idioma",
    tag: "ACESSO DO CLIENTE",
    title: "Seus pedidos e avaliações em uma conta simples.",
    intro: "Crie uma conta sem verificação por e-mail. Depois, vincule um pedido real com o código único fornecido pelo contato comercial.",
    bullets: [
      "Somente pedidos vinculados e entregues podem receber avaliações.",
      "As avaliações são revisadas antes da publicação.",
      "Não publicamos alegações médicas, de dosagem ou eficácia.",
    ],
    tabs: { login: "Entrar", register: "Cadastrar", recover: "Recuperar" },
    saveOnce: "SALVE AGORA",
    recoveryTitle: "Seu código de recuperação",
    recoveryNote: "Este código aparece uma única vez. Guarde-o em segurança; o site não envia e-mail de recuperação.",
    continue: "Continuar para a área do cliente",
    username: "Nome de usuário",
    displayName: "Nome de exibição",
    company: "Empresa / organização",
    country: "País",
    accountLanguage: "Idioma da conta",
    recoveryCode: "Código de recuperação",
    newPassword: "Nova senha",
    password: "Senha",
    verification: "Verificação",
    consent: "Aceito o aviso de privacidade.",
    wait: "Aguarde…",
    submit: { login: "Entrar", register: "Criar conta", recover: "Redefinir senha" },
    unavailable: "A verificação não está disponível.",
    retry: "Tente novamente.",
    countries: { US: "Estados Unidos", CA: "Canadá", BR: "Brasil", MX: "México" },
  },
  es: {
    back: "Volver al sitio",
    language: "Idioma",
    tag: "ACCESO DE CLIENTES",
    title: "Sus pedidos y comentarios en una cuenta sencilla.",
    intro: "Cree una cuenta sin verificación por correo. Después, vincule un pedido real con el código único facilitado por su contacto comercial.",
    bullets: [
      "Solo los pedidos vinculados y entregados pueden recibir comentarios.",
      "Los comentarios se revisan antes de publicarse.",
      "No se publican afirmaciones médicas, de dosificación o eficacia.",
    ],
    tabs: { login: "Ingresar", register: "Registrarse", recover: "Recuperar" },
    saveOnce: "GUÁRDELO AHORA",
    recoveryTitle: "Su código de recuperación",
    recoveryNote: "Este código se muestra una sola vez. Guárdelo en privado; el sitio no envía correos de recuperación.",
    continue: "Continuar al área de clientes",
    username: "Usuario",
    displayName: "Nombre visible",
    company: "Empresa / organización",
    country: "País",
    accountLanguage: "Idioma de la cuenta",
    recoveryCode: "Código de recuperación",
    newPassword: "Nueva contraseña",
    password: "Contraseña",
    verification: "Verificación",
    consent: "Acepto el aviso de privacidad.",
    wait: "Espere…",
    submit: { login: "Ingresar", register: "Crear cuenta", recover: "Restablecer contraseña" },
    unavailable: "La verificación no está disponible.",
    retry: "Inténtelo de nuevo.",
    countries: { US: "Estados Unidos", CA: "Canadá", BR: "Brasil", MX: "México" },
  },
  fr: {
    back: "Retour au site",
    language: "Langue",
    tag: "ACCÈS CLIENT",
    title: "Vos commandes et avis dans un compte léger.",
    intro: "Créez un compte sans vérification par e-mail. Associez ensuite une commande réelle avec le code unique fourni par votre contact commercial.",
    bullets: [
      "Seules les commandes associées et livrées peuvent recevoir un avis.",
      "Les avis sont vérifiés avant publication.",
      "Aucune allégation médicale, de dosage ou d’efficacité n’est publiée.",
    ],
    tabs: { login: "Connexion", register: "Créer un compte", recover: "Récupérer" },
    saveOnce: "À CONSERVER",
    recoveryTitle: "Votre code de récupération",
    recoveryNote: "Ce code n’est affiché qu’une fois. Conservez-le en lieu sûr ; le site n’envoie pas d’e-mail de récupération.",
    continue: "Continuer vers l’espace client",
    username: "Identifiant",
    displayName: "Nom affiché",
    company: "Entreprise / organisation",
    country: "Pays",
    accountLanguage: "Langue du compte",
    recoveryCode: "Code de récupération",
    newPassword: "Nouveau mot de passe",
    password: "Mot de passe",
    verification: "Vérification",
    consent: "J'accepte l'avis de confidentialité.",
    wait: "Veuillez patienter…",
    submit: { login: "Se connecter", register: "Créer le compte", recover: "Réinitialiser le mot de passe" },
    unavailable: "La vérification est indisponible.",
    retry: "Veuillez réessayer.",
    countries: { US: "États-Unis", CA: "Canada", BR: "Brésil", MX: "Mexique" },
  },
  zh: {
    back: "返回网站",
    language: "语言",
    tag: "客户入口",
    title: "用一个轻量账号管理订单反馈。",
    intro: "注册无需邮箱验证码。之后可使用业务联系人提供的一次性绑定码关联真实订单。",
    bullets: [
      "只有已关联且已交付的订单才能提交客户反馈。",
      "客户反馈经人工审核后才会公开。",
      "不公开医疗、剂量或功效相关表述。",
    ],
    tabs: { login: "登录", register: "注册", recover: "找回账号" },
    saveOnce: "仅显示一次",
    recoveryTitle: "你的恢复码",
    recoveryNote: "恢复码只显示一次，请妥善保存；本站不会发送找回邮件。",
    continue: "进入客户中心",
    username: "用户名",
    displayName: "显示名称",
    company: "公司 / 组织",
    country: "国家",
    accountLanguage: "账号语言",
    recoveryCode: "恢复码",
    newPassword: "新密码",
    password: "密码",
    verification: "验证题",
    consent: "我同意隐私说明。",
    wait: "请稍候…",
    submit: { login: "登录", register: "创建账号", recover: "重设密码" },
    unavailable: "验证服务暂时不可用。",
    retry: "请重试。",
    countries: { US: "美国", CA: "加拿大", BR: "巴西", MX: "墨西哥" },
  },
};

export default function CustomerAccessPage() {
  const [locale, setLocale] = useState<SiteLocale>("en");
  const [mode, setMode] = useState<Mode>("login");
  const [challenge, setChallenge] = useState<Challenge | null>(null);
  const [answer, setAnswer] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [recoveryCode, setRecoveryCode] = useState("");
  const t = copy[locale];

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      const stored = window.localStorage.getItem(LOCALE_STORAGE_KEY);
      if (isSiteLocale(stored)) setLocale(stored);
    });
    return () => window.cancelAnimationFrame(frame);
  }, []);

  useEffect(() => {
    window.localStorage.setItem(LOCALE_STORAGE_KEY, locale);
    document.documentElement.lang = htmlLang(locale);
  }, [locale]);

  async function refreshChallenge() {
    setAnswer("");
    const response = await fetch("/api/customer/challenge", { cache: "no-store" });
    const data = (await response.json()) as Challenge & { error?: string };
    if (!response.ok) throw new Error(data.error ?? t.unavailable);
    setChallenge(data);
  }

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      void refreshChallenge().catch((caught) =>
        setError(caught instanceof Error ? caught.message : t.unavailable),
      );
    });
    return () => window.cancelAnimationFrame(frame);
    // A fresh challenge is useful when the user switches auth mode or language.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, locale]);

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
            locale,
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
      if (!response.ok) throw new Error(data.error ?? t.retry);
      if (data.recoveryCode) {
        setRecoveryCode(data.recoveryCode);
      } else {
        window.location.assign("/customer/feedback");
      }
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : t.retry);
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
        <div className="customer-header-actions">
          <label className="customer-language-switcher">
            <span>{t.language}</span>
            <select
              value={locale}
              onChange={(event) => setLocale(event.target.value as SiteLocale)}
              aria-label={t.language}
            >
              {LANGUAGE_OPTIONS.map((option) => (
                <option key={option.code} value={option.code}>{option.label}</option>
              ))}
            </select>
          </label>
          <Link href="/">{t.back}</Link>
        </div>
      </header>
      <section className="customer-access-shell">
        <div className="customer-access-intro">
          <p className="section-tag">{t.tag}</p>
          <h1>{t.title}</h1>
          <p>{t.intro}</p>
          <ul>{t.bullets.map((item) => <li key={item}>{item}</li>)}</ul>
        </div>
        <div className="customer-access-card">
          <div className="customer-access-tabs" role="tablist">
            {(["login", "register", "recover"] as const).map((tab) => (
              <button
                key={tab}
                type="button"
                className={mode === tab ? "active" : ""}
                onClick={() => setMode(tab)}
              >
                {t.tabs[tab]}
              </button>
            ))}
          </div>
          {recoveryCode ? (
            <div className="customer-recovery-result">
              <p className="section-tag">{t.saveOnce}</p>
              <h2>{t.recoveryTitle}</h2>
              <code>{recoveryCode}</code>
              <p>{t.recoveryNote}</p>
              <button type="button" onClick={() => window.location.assign("/customer/feedback")}>{t.continue}</button>
            </div>
          ) : (
            <form onSubmit={submit}>
              <label><span>{t.username}</span><input name="username" autoComplete="username" minLength={3} maxLength={32} required /></label>
              {mode === "register" && (
                <>
                  <label><span>{t.displayName}</span><input name="displayName" maxLength={80} /></label>
                  <label><span>{t.company}</span><input name="companyName" maxLength={120} /></label>
                  <div className="customer-form-row">
                    <label><span>{t.country}</span><select name="countryCode">{(["US", "CA", "BR", "MX"] as const).map((code) => <option value={code} key={code}>{t.countries[code]}</option>)}</select></label>
                    <label><span>{t.accountLanguage}</span><select name="locale" value={locale} onChange={(event) => setLocale(event.target.value as SiteLocale)}>{LANGUAGE_OPTIONS.map((option) => <option value={option.code} key={option.code}>{option.label}</option>)}</select></label>
                  </div>
                </>
              )}
              {mode === "recover" ? (
                <>
                  <label><span>{t.recoveryCode}</span><input name="recoveryCode" autoComplete="off" required /></label>
                  <label><span>{t.newPassword}</span><input name="newPassword" type="password" autoComplete="new-password" minLength={10} maxLength={72} required /></label>
                </>
              ) : (
                <label><span>{t.password}</span><input name="password" type="password" autoComplete={mode === "login" ? "current-password" : "new-password"} minLength={10} maxLength={72} required /></label>
              )}
              <label className="customer-challenge"><span>{t.verification}: {challenge?.question ?? "…"}</span><input inputMode="numeric" value={answer} onChange={(event) => setAnswer(event.target.value)} required /></label>
              {mode === "register" && <label className="customer-consent"><input type="checkbox" name="privacyConsent" required /><span>{t.consent}</span></label>}
              {error && <p className="customer-error" role="alert">{error}</p>}
              <button className="customer-submit" type="submit" disabled={busy || !challenge}>{busy ? t.wait : t.submit[mode]}</button>
            </form>
          )}
        </div>
      </section>
    </main>
  );
}
