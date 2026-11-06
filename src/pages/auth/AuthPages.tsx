import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import QRCode from "qrcode";
import { ApiError } from "../../api/client";
import { api } from "../../api/endpoints";
import type { LoginNext } from "../../api/types";
import { Banner } from "../../components/ui";

/** The centred card every sign-in screen uses. */
function Shell({ title, lead, children, foot }: { title: string; lead?: string; children: ReactNode; foot?: ReactNode }) {
  return (
    <div className="gate">
      <div className="card gatecard">
        <div className="brand gatebrand"><span className="mark" aria-hidden="true">O</span><span>Outreach Console</span></div>
        <h1>{title}</h1>
        {lead && <p className="s">{lead}</p>}
        {children}
        {foot && <div className="gatefoot">{foot}</div>}
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return <label className="gatefield"><span>{label}</span>{children}</label>;
}

const msg = (e: unknown) => (e instanceof Error ? e.message : String(e));

/** Email and password. Decides what comes next from the backend's answer. */
export function SignInPage({ onNext, note }: { onNext: (n: LoginNext) => void; note?: string }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState<string>();
  const [busy, setBusy] = useState(false);
  const submit = async (e: FormEvent) => {
    e.preventDefault(); setBusy(true); setErr(undefined);
    try { onNext(await api.login({ email: email.trim(), password })); }
    catch (x) { setErr(msg(x)); }
    finally { setBusy(false); }
  };
  return (
    <Shell title="Sign in" lead="Approve drafts, start searches and watch AutoBooker work." foot={<>New here? <a href="#register">Ask for access</a> · <a href="#forgot">Forgot password?</a></>}>
      {note && <Banner tone="warn">{note}</Banner>}
      <form onSubmit={(e) => void submit(e)} className="gateform">
        <Field label="Email"><input type="email" autoComplete="username" autoFocus required value={email} onChange={(e) => setEmail(e.target.value)} /></Field>
        <Field label="Password"><input type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} /></Field>
        {err && <div className="err">{err}</div>}
        <button className="btn primary" type="submit" disabled={busy || !email || !password}>{busy ? "Checking…" : "Continue"}</button>
      </form>
    </Shell>
  );
}

/** Full name, email, password twice. Ends on "sent to an administrator", or straight to sign-in for a superuser. */
export function RegisterPage() {
  const [f, setF] = useState({ full_name: "", email: "", password: "", confirm: "" });
  const [err, setErr] = useState<string>();
  const [done, setDone] = useState<"pending" | "active">();
  const [busy, setBusy] = useState(false);
  const set = (k: keyof typeof f) => (e: { target: { value: string } }) => setF({ ...f, [k]: e.target.value });
  const submit = async (e: FormEvent) => {
    e.preventDefault(); setBusy(true); setErr(undefined);
    if (f.password !== f.confirm) { setErr("The two passwords do not match."); setBusy(false); return; }
    try { setDone((await api.register({ ...f, full_name: f.full_name.trim(), email: f.email.trim() })).status); }
    catch (x) { setErr(msg(x)); }
    finally { setBusy(false); }
  };
  if (done === "pending") {
    return (
      <Shell title="Request sent" foot={<a href="#signin">Back to sign in</a>}>
        <p>Your request was sent to an administrator. You will be able to sign in once it is approved.</p>
      </Shell>
    );
  }
  if (done === "active") {
    return (
      <Shell title="Account ready" foot={<a href="#signin">Sign in</a>}>
        <p>Your address is listed as an administrator, so the account is already approved. Sign in to set up your authenticator app.</p>
      </Shell>
    );
  }
  return (
    <Shell title="Ask for access" lead="An administrator approves each request before the first sign-in." foot={<>Already approved? <a href="#signin">Sign in</a></>}>
      <form onSubmit={(e) => void submit(e)} className="gateform">
        <Field label="Full name"><input autoComplete="name" autoFocus required minLength={2} value={f.full_name} onChange={set("full_name")} /></Field>
        <Field label="Work email"><input type="email" autoComplete="email" required value={f.email} onChange={set("email")} /></Field>
        <Field label="Password (at least 12 characters)"><input type="password" autoComplete="new-password" required minLength={12} value={f.password} onChange={set("password")} /></Field>
        <Field label="Confirm password"><input type="password" autoComplete="new-password" required minLength={12} value={f.confirm} onChange={set("confirm")} /></Field>
        {err && <div className="err">{err}</div>}
        <button className="btn primary" type="submit" disabled={busy}>{busy ? "Sending…" : "Send request"}</button>
      </form>
    </Shell>
  );
}

/** First sign-in: scan the QR code, type one code, save the recovery codes. */
export function EnrollPage({ otpauthUrl, secret, onDone }: { otpauthUrl: string; secret: string; onDone: () => void }) {
  const [qr, setQr] = useState<string>();
  const [code, setCode] = useState("");
  const [err, setErr] = useState<string>();
  const [codes, setCodes] = useState<string[]>();
  const [busy, setBusy] = useState(false);
  useEffect(() => { QRCode.toDataURL(otpauthUrl, { margin: 1, width: 200 }).then(setQr).catch(() => setQr(undefined)); }, [otpauthUrl]);
  const submit = async (e: FormEvent) => {
    e.preventDefault(); setBusy(true); setErr(undefined);
    try { setCodes((await api.enroll2fa(code)).recovery_codes); }
    catch (x) { setErr(msg(x)); }
    finally { setBusy(false); }
  };
  if (codes) {
    return (
      <Shell title="Save your recovery codes" lead="Each code signs you in once if you lose your phone. Keep them somewhere safe; they are shown only now.">
        <pre className="codes">{codes.join("\n")}</pre>
        <div style={{ display: "flex", gap: 8 }}>
          <button className="btn" type="button" onClick={() => { void navigator.clipboard?.writeText(codes.join("\n")); }}>Copy</button>
          <button className="btn primary" type="button" onClick={onDone}>I saved them, continue</button>
        </div>
      </Shell>
    );
  }
  return (
    <Shell title="Set up your authenticator" lead="Every sign-in needs a six-digit code from Google Authenticator, Microsoft Authenticator or 1Password.">
      <ol className="steps-plain">
        <li>Open the authenticator app and tap <b>Add account</b>.</li>
        <li>Scan this code{qr ? "" : " (or type the key below)"}:</li>
      </ol>
      <div className="qrwrap">
        {qr ? <img src={qr} alt="QR code for the authenticator app" width={200} height={200} className="qr" /> : null}
        <div className="s">Cannot scan? Enter this key by hand:</div>
        <div className="key mono">{secret.replace(/(.{4})/g, "$1 ").trim()}</div>
      </div>
      <form onSubmit={(e) => void submit(e)} className="gateform">
        <Field label="The six-digit code the app shows now"><input inputMode="numeric" pattern="[0-9 ]*" autoComplete="one-time-code" autoFocus required value={code} onChange={(e) => setCode(e.target.value)} /></Field>
        {err && <div className="err">{err}</div>}
        <button className="btn primary" type="submit" disabled={busy || code.replace(/\s/g, "").length !== 6}>{busy ? "Checking…" : "Turn on two-factor"}</button>
      </form>
    </Shell>
  );
}

/** Every later sign-in: the six-digit code, or a recovery code. */
export function VerifyPage({ onDone, onBack }: { onDone: () => void; onBack: () => void }) {
  const [code, setCode] = useState("");
  const [err, setErr] = useState<string>();
  const [busy, setBusy] = useState(false);
  const submit = async (e: FormEvent) => {
    e.preventDefault(); setBusy(true); setErr(undefined);
    try {
      const r = await api.verify2fa(code);
      if (r.recovery_codes_left <= 2 && /[a-z]/i.test(code)) alert(`You have ${r.recovery_codes_left} recovery code(s) left.`);
      onDone();
    } catch (x) {
      setErr(msg(x));
      if (x instanceof ApiError && x.status === 429) onBack();
    } finally { setBusy(false); }
  };
  return (
    <Shell title="Enter your code" lead="The six-digit code from your authenticator app, or one of your recovery codes." foot={<a href="#signin" onClick={onBack}>Use a different account</a>}>
      <form onSubmit={(e) => void submit(e)} className="gateform">
        <Field label="Code"><input inputMode="numeric" autoComplete="one-time-code" autoFocus required value={code} onChange={(e) => setCode(e.target.value)} /></Field>
        {err && <div className="err">{err}</div>}
        <button className="btn primary" type="submit" disabled={busy || code.trim().length < 6}>{busy ? "Checking…" : "Sign in"}</button>
      </form>
    </Shell>
  );
}

/** "Forgot password?": asks for the email and always answers the same way. */
export function ForgotPage() {
  const [email, setEmail] = useState("");
  const [msgText, setMsgText] = useState<string>();
  const [err, setErr] = useState<string>();
  const [busy, setBusy] = useState(false);
  const submit = async (e: FormEvent) => {
    e.preventDefault(); setBusy(true); setErr(undefined);
    try { setMsgText((await api.forgot(email.trim())).message); }
    catch (x) { setErr(msg(x)); }
    finally { setBusy(false); }
  };
  return (
    <Shell title="Reset your password" lead="Enter your email. If it has an account, a link to choose a new password is sent to it." foot={<a href="#signin">Back to sign in</a>}>
      {msgText ? <Banner tone="info">{msgText}</Banner> : (
        <form onSubmit={(e) => void submit(e)} className="gateform">
          <Field label="Email"><input type="email" autoComplete="username" autoFocus required value={email} onChange={(e) => setEmail(e.target.value)} /></Field>
          {err && <div className="err">{err}</div>}
          <button className="btn primary" type="submit" disabled={busy || !email}>{busy ? "Sending…" : "Send the link"}</button>
        </form>
      )}
    </Shell>
  );
}

/** Reached from the link in the email (#reset=<token>): choose a new password. Every old session ends. */
export function ResetPage({ token }: { token: string }) {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [err, setErr] = useState<string>();
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);
  const submit = async (e: FormEvent) => {
    e.preventDefault(); setBusy(true); setErr(undefined);
    if (password !== confirm) { setErr("The two passwords do not match."); setBusy(false); return; }
    try { await api.resetPassword({ token, password, confirm }); setDone(true); }
    catch (x) { setErr(msg(x)); }
    finally { setBusy(false); }
  };
  if (done) {
    return <Shell title="Password changed" foot={<a href="#signin">Sign in</a>}><p>Your new password is set and every earlier session is signed out. Your authenticator app stays the same.</p></Shell>;
  }
  return (
    <Shell title="Choose a new password" foot={<a href="#signin">Back to sign in</a>}>
      <form onSubmit={(e) => void submit(e)} className="gateform">
        <Field label="New password (at least 12 characters)"><input type="password" autoComplete="new-password" autoFocus required minLength={12} value={password} onChange={(e) => setPassword(e.target.value)} /></Field>
        <Field label="Confirm new password"><input type="password" autoComplete="new-password" required minLength={12} value={confirm} onChange={(e) => setConfirm(e.target.value)} /></Field>
        {err && <div className="err">{err}</div>}
        <button className="btn primary" type="submit" disabled={busy}>{busy ? "Saving…" : "Set password"}</button>
      </form>
    </Shell>
  );
}
