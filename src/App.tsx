import { useCallback, useEffect, useState } from "react";
import { ApiError, getToken, setToken, UNAUTHORIZED_EVENT } from "./api/client";
import { api } from "./api/endpoints";
import type { LoginNext, Me } from "./api/types";
import { Rail } from "./components/layout/Rail";
import { Topbar } from "./components/layout/Topbar";
import { Banner, Loading } from "./components/ui";
import { AuthProvider, useAuth } from "./context/AuthContext";
import { DataProvider, useData } from "./context/DataContext";
import { ToastProvider } from "./context/ToastContext";
import { useHashRoute } from "./hooks/useHashRoute";
import { EnrollPage, ForgotPage, RegisterPage, ResetPage, SignInPage, VerifyPage } from "./pages/auth/AuthPages";
import { AutomationPage } from "./pages/AutomationPage";
import { CampaignsPage } from "./pages/campaigns/CampaignsPage";
import { JobsPage } from "./pages/JobsPage";
import { PipelinePage } from "./pages/PipelinePage";
import { QueuePage } from "./pages/QueuePage";
import { RunsPage } from "./pages/RunsPage";
import { SentPage } from "./pages/SentPage";
import { UsersPage } from "./pages/UsersPage";
import { ADMIN_PAGES, PAGE_INFO, PAGES } from "./pages/routes";

type Gate = "checking" | "down" | "token" | "signin" | "register" | "forgot" | "reset" | "enroll" | "totp" | "ready";
const resetToken = () => (window.location.hash.startsWith("#reset=") ? decodeURIComponent(window.location.hash.slice(7)) : "");
/** Which signed-out screen the address bar asks for. */
const entryFor = (hash: string): Gate => (hash === "#register" ? "register" : hash === "#forgot" ? "forgot" : hash.startsWith("#reset=") ? "reset" : "signin");

/**
 * Checks the backend first: is it running, and how does it want people to sign in? Accounts mode (SUPERUSER_EMAIL on
 * the server): email + password, then a six-digit code; new people register and wait for approval. Token mode: the
 * shared API_TOKEN. Open mode: straight in.
 */
export function App() {
  const [state, setState] = useState<Gate>("checking");
  const [message, setMessage] = useState("");
  const [tokenNote, setTokenNote] = useState("");
  const [accounts, setAccounts] = useState(false);
  const [me, setMe] = useState<Me>();
  const [enroll, setEnroll] = useState<{ otpauth_url: string; secret: string }>();

  const refreshMe = useCallback(async () => {
    try { setMe(await api.me()); } catch { setMe(undefined); }
  }, []);

  const check = useCallback(async () => {
    setState("checking");
    try {
      const health = await api.health();
      if (health.accounts) {
        setAccounts(true);
        if (window.location.hash.startsWith("#reset=")) { setState("reset"); return; } // a reset link works signed in or out
        try {
          const m = await api.me();
          setMe(m);
          if (m.stage === "full") { setState("ready"); return; }
          if (m.stage === "password") { setState("totp"); return; }
          setState("signin"); return; // an unfinished enrolment: start again from the password
        } catch {
          setState(entryFor(window.location.hash)); return;
        }
      }
      if (health.auth) {
        if (!getToken()) { setState("token"); return; }
        try { await api.summary(); } catch (e) { if (e instanceof ApiError && e.status === 401) { setState("token"); return; } }
      }
      setState("ready");
    } catch (e) {
      setMessage((e as Error).message);
      setState("down");
    }
  }, []);
  useEffect(() => { void check(); }, [check]);
  // Any 401 later on (session ended, token changed) brings the sign-in screen back instead of a dead console.
  useEffect(() => {
    const back = () => {
      if (accounts) { setMe(undefined); setState("signin"); setTokenNote("Your session ended. Sign in again."); }
      else { setTokenNote("The saved token was not accepted. Paste the current API_TOKEN."); setState("token"); }
    };
    window.addEventListener(UNAUTHORIZED_EVENT, back);
    return () => window.removeEventListener(UNAUTHORIZED_EVENT, back);
  }, [accounts]);
  // #signin, #register, #forgot and #reset= switch between the signed-out screens.
  useEffect(() => {
    const onHash = () => {
      const out: Gate[] = ["signin", "register", "forgot", "reset"];
      if (out.includes(state)) setState(entryFor(window.location.hash));
    };
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, [state]);

  const onLogin = (n: LoginNext) => {
    setTokenNote("");
    if (n.next === "enroll") { setEnroll({ otpauth_url: n.otpauth_url, secret: n.secret }); setState("enroll"); }
    else setState("totp");
  };
  const signedIn = async () => { await refreshMe(); if (/^#(signin|register|forgot|reset=)/.test(window.location.hash)) window.location.hash = "#queue"; setState("ready"); };
  const signOut = async () => { try { await api.logout(); } catch { /* already out */ } setMe(undefined); setState("signin"); };

  if (state === "checking") return <Loading text="Connecting to the backend…" />;
  if (state === "down") {
    return <div style={{ padding: 24, maxWidth: 640 }}><Banner tone="bad" action={<button className="btn" onClick={check}>Try again</button>}>{message}</Banner></div>;
  }
  if (state === "token") return <TokenGate note={tokenNote} onDone={() => { setTokenNote(""); void check(); }} />;
  if (state === "signin") return <SignInPage note={tokenNote || undefined} onNext={onLogin} />;
  if (state === "register") return <RegisterPage />;
  if (state === "forgot") return <ForgotPage />;
  if (state === "reset") return <ResetPage token={resetToken()} />;
  if (state === "enroll" && enroll) return <EnrollPage otpauthUrl={enroll.otpauth_url} secret={enroll.secret} onDone={() => void signedIn()} />;
  if (state === "totp") return <VerifyPage onDone={() => void signedIn()} onBack={() => void signOut()} />;
  return (
    <AuthProvider value={{ me, accounts, refreshMe, signOut }}>
      <ToastProvider><DataProvider><Console /></DataProvider></ToastProvider>
    </AuthProvider>
  );
}

/** Shown when the backend has API_TOKEN set. The token stays in this browser. */
function TokenGate({ note, onDone }: { note?: string; onDone: () => void }) {
  const [value, setValue] = useState(getToken());
  return (
    <div style={{ padding: 24, maxWidth: 440, display: "flex", flexDirection: "column", gap: 12 }}>
      <h1 style={{ fontSize: 18, margin: 0 }}>Outreach Console</h1>
      {note && <Banner tone="bad">{note}</Banner>}
      <p className="hint">This backend asks for a token. Paste the API_TOKEN from the backend's .env file. It is kept in this browser only.</p>
      <form style={{ display: "flex", gap: 8 }} onSubmit={(e) => { e.preventDefault(); setToken(value.trim()); onDone(); }}>
        <input type="password" autoFocus aria-label="API token" value={value} onChange={(e) => setValue(e.target.value)}
          style={{ flex: 1, padding: "7px 10px", border: "1px solid var(--line)", borderRadius: 6 }} />
        <button className="btn primary" type="submit" disabled={!value.trim()}>Continue</button>
      </form>
    </div>
  );
}

/** The layout from the design: rail on the left, top bar, and the current page. */
function Console() {
  const { refresh, campaigns } = useData();
  const { me, accounts } = useAuth();
  const isAdmin = !accounts || me?.user.role === "admin";
  const page = useHashRoute(PAGES, "queue");
  const [query, setQuery] = useState("");
  const campaignCount = campaigns?.length;
  const [runningCount, setRunningCount] = useState(0);
  const info = PAGE_INFO[page];
  // Keep "who am I" fresh: the pending-users badge and role changes made by another admin show within a minute or on navigation.
  const { refreshMe } = useAuth();
  useEffect(() => { if (!accounts) return; void refreshMe(); const t = setInterval(() => void refreshMe(), 60_000); return () => clearInterval(t); }, [accounts, refreshMe, page]);
  // Sidebar open/closed. Remembered per browser; starts closed on narrow screens.
  const [navOpen, setNavOpen] = useState<boolean>(() => {
    try { const v = localStorage.getItem("nav-open"); if (v) return v === "1"; } catch { /* private window */ }
    return !window.matchMedia("(max-width: 860px)").matches;
  });
  const toggleNav = () => setNavOpen((v) => { try { localStorage.setItem("nav-open", v ? "0" : "1"); } catch { /* ignore */ } return !v; });
  const closeNavOnMobile = () => { if (window.matchMedia("(max-width: 860px)").matches) setNavOpen(false); };

  useEffect(() => { document.title = `${info.title} · Outreach Console`; }, [info.title]);

  return (
    <div className={`app ${navOpen ? "nav-open" : "nav-closed"}`}>
      {navOpen && <div className="navscrim" onClick={toggleNav} />}
      <Rail page={page} campaignCount={campaignCount} runningCount={runningCount} onToggle={toggleNav} onNavigate={closeNavOnMobile} hide={isAdmin ? [] : ADMIN_PAGES} />
      <div className="main">
        <Topbar
          navOpen={navOpen} onToggleNav={toggleNav}
          title={info.title} subtitle={info.subtitle}
          query={query} onQuery={setQuery} showSearch={page === "jobs" || page === "pipeline" || page === "sent"}
          showRefresh={page !== "users"}
          onRefresh={() => refresh(true)}
        />
        <main className="content">
          {page === "jobs" && <JobsPage query={query} />}
          {page === "queue" && <QueuePage />}
          {page === "sent" && <SentPage query={query} />}
          {page === "pipeline" && <PipelinePage query={query} />}
          {page === "campaigns" && <CampaignsPage />}
          {page === "runs" && <RunsPage onRunning={setRunningCount} />}
          {page === "automation" && <AutomationPage />}
          {page === "users" && (isAdmin ? <UsersPage /> : <Banner tone="warn">Only an administrator can see this page.</Banner>)}
        </main>
      </div>
    </div>
  );
}
