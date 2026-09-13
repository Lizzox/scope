"use client";

import { ArrowRight, CheckCircle2, Users } from "lucide-react";
import { useState } from "react";
import { ScopeMark } from "./scope-mark";

export function JoinForm({ token }: { token: string }) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [joined, setJoined] = useState(false);

  const accept = async () => {
    setLoading(true); setError("");
    try {
      const response = await fetch("/api/v1/invitations/accept", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ token, name, email, password }) });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error?.message ?? "Einladung konnte nicht angenommen werden");
      setJoined(true); window.setTimeout(() => { window.location.href = "/"; }, 700);
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Einladung konnte nicht angenommen werden"); setLoading(false); }
  };

  return <main className="onboarding-shell"><header className="onboarding-header"><div className="brand"><ScopeMark size={30} /><span>Scope</span></div></header><section className="onboarding-card">{joined ? <div className="finish-step"><div className="success-ring"><CheckCircle2 size={31} /></div><h1>Willkommen im Team.</h1><p className="lead">Dein Konto wurde angelegt. Scope öffnet jetzt den Workspace.</p></div> : <form className="step-content" onSubmit={(event) => { event.preventDefault(); void accept(); }}><div className="step-icon"><Users size={22} /></div><h1>Workspace beitreten.</h1><p className="lead">Lege ein lokales Konto auf dieser Scope-Instanz an. Der Einladungslink wird danach ungültig.</p>{!token && <p className="privacy-note" role="alert">Dieser Link enthält kein gültiges Einladungstoken.</p>}<div className="field-row"><label>Dein Name<input autoComplete="name" value={name} onChange={(event) => setName(event.target.value)} required /></label><label>E-Mail<input type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} required /></label></div><div className="field-row"><label>Passwort · mindestens 10 Zeichen<input type="password" autoComplete="new-password" value={password} onChange={(event) => setPassword(event.target.value)} minLength={10} required /></label></div>{error && <p className="privacy-note" role="alert">{error}</p>}<button className="primary-button large" disabled={loading || !token || name.trim().length < 2 || !email.includes("@") || password.length < 10}>{loading ? "Beitritt läuft…" : "Einladung annehmen"} <ArrowRight size={17} /></button><p className="subscription-note">Du hast bereits ein Konto? Melde dich zuerst auf dieser Instanz an und öffne den Einladungslink anschließend erneut.</p></form>}</section><footer className="onboarding-footer"><span>Deine Daten bleiben auf diesem Server.</span><span>AGPLv3 · Open Source</span></footer></main>;
}
