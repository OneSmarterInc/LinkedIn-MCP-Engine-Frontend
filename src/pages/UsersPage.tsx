import { useCallback, useEffect, useState } from "react";
import { api } from "../api/endpoints";
import type { AuditRow, AuthUser, Role } from "../api/types";
import { Banner, Loading, Pill } from "../components/ui";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";
import { whenText } from "../utils/format";

const ACTION_LABEL: Record<string, string> = {
  register: "asked for access", register_superuser: "registered as superuser", sign_in: "signed in", sign_in_recovery_code: "signed in with a recovery code",
  sign_in_failed: "wrong password", sign_out: "signed out", two_factor_enrolled: "set up two-factor",
  approve_user: "approved", reject_user: "rejected", disable_user: "disabled", enable_user: "enabled", change_role: "changed role of",
  approve_draft: "approved draft", reject_draft: "rejected draft", reopen_draft: "reopened draft", edit_draft: "edited draft",
  mail_sent: "email sent to", mail_failed: "email FAILED to", mail_test: "sent a test email to", password_reset_requested: "asked for a password reset", password_reset: "set a new password",
  start_search: "started job search", start_run: "started campaign run", change_settings: "changed automation settings",
  create_campaign: "created campaign", edit_campaign: "edited campaign", activate_campaign: "switched on campaign", deactivate_campaign: "switched off campaign",
};

/** Administrators only: who may sign in, pending requests first, and the audit trail. */
export function UsersPage() {
  const toast = useToast();
  const { me, refreshMe } = useAuth();
  const [users, setUsers] = useState<AuthUser[]>();
  const [audit, setAudit] = useState<AuditRow[]>([]);
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState<string>();
  const [roles, setRoles] = useState<Record<string, Role>>({});
  const [mailOn, setMailOn] = useState<boolean>();
  const [mailNote, setMailNote] = useState<string>();

  const load = useCallback(async () => {
    try {
      const [u, a, h] = await Promise.all([api.users(), api.audit(100), api.health()]);
      setUsers(u.users); setAudit(a.rows); setMailOn(Boolean(h.mail)); setError(undefined);
    } catch (e) { setError((e as Error).message); }
  }, []);
  useEffect(() => { void load(); }, [load]);

  const act = async (id: string, what: string, fn: () => Promise<unknown>) => {
    setBusy(id + what);
    try { await fn(); await load(); await refreshMe(); toast(`Done: ${what}.`); }
    catch (e) { toast((e as Error).message, true); }
    finally { setBusy(undefined); }
  };

  if (error) return <Banner tone="bad" action={<button className="btn" onClick={() => void load()}>Try again</button>}>{error}</Banner>;
  if (!users) return <Loading text="Reading the accounts…" />;
  const pending = users.filter((u) => u.status === "pending");
  const others = users.filter((u) => u.status !== "pending");

  const row = (u: AuthUser) => {
    const self = u.id === me?.user.id;
    const role = roles[u.id] ?? u.role;
    return (
      <tr key={u.id}>
        <td><div className="t">{u.full_name}{self ? " (you)" : ""}</div><div className="s mono" style={{ fontSize: 12 }}>{u.email}</div></td>
        <td>
          {u.status === "pending" ? (
            <select value={role} onChange={(e) => setRoles({ ...roles, [u.id]: e.target.value as Role })} aria-label="Role to give">
              <option value="member">Member</option><option value="admin">Admin</option>
            </select>
          ) : (
            <><Pill tone={u.role === "admin" ? "ok" : undefined}>{u.role === "admin" ? "Admin" : "Member"}</Pill>{u.superuser && <div className="s">superuser (.env)</div>}</>
          )}
        </td>
        <td>
          <Pill tone={u.status === "active" ? "ok" : u.status === "pending" ? "warn" : "bad"}>{u.status === "active" ? "Active" : u.status === "pending" ? "Waiting" : "Disabled"}</Pill>
          <div className="s">{u.two_factor ? "Two-factor on" : "Two-factor not set up yet"}</div>
        </td>
        <td className="s">{u.status === "pending" ? `asked ${whenText(u.created_at)}` : u.last_sign_in_at ? `last sign-in ${whenText(u.last_sign_in_at)}` : "never signed in"}{u.approved_by ? <><br />approved by {u.approved_by.replace(/ <.*>$/, "")}</> : null}</td>
        <td style={{ whiteSpace: "nowrap" }}>
          {u.status === "pending" && <>
            <button className="btn sm primary" disabled={!!busy} onClick={() => void act(u.id, "approve", () => api.approveUser(u.id, role))}>Approve</button>{" "}
            <button className="btn sm danger" disabled={!!busy} onClick={() => { const reason = prompt("Reason (optional):") ?? undefined; void act(u.id, "reject", () => api.rejectUser(u.id, reason)); }}>Reject</button>
          </>}
          {u.status === "active" && !self && !u.superuser && <>
            <button className="btn sm" disabled={!!busy} onClick={() => void act(u.id, u.role === "admin" ? "make member" : "make admin", () => api.setRole(u.id, u.role === "admin" ? "member" : "admin"))}>{u.role === "admin" ? "Make member" : "Make admin"}</button>{" "}
            <button className="btn sm danger" disabled={!!busy} onClick={() => { if (confirm(`Disable ${u.email}? They are signed out at once.`)) void act(u.id, "disable", () => api.disableUser(u.id)); }}>Disable</button>
          </>}
          {u.status === "active" && u.superuser && !self && u.role !== "admin" && <button className="btn sm" disabled={!!busy} onClick={() => void act(u.id, "make admin", () => api.setRole(u.id, "admin"))}>Make admin</button>}
          {u.status === "disabled" && <button className="btn sm" disabled={!!busy} onClick={() => void act(u.id, "enable", () => api.enableUser(u.id))}>Enable</button>}
        </td>
      </tr>
    );
  };

  return (
    <>
      <p className="s" style={{ marginTop: 0 }}>People register with name, email and password; nothing works until an administrator approves them here. Everyone signs in with a six-digit code from an authenticator app. The addresses in <span className="mono">SUPERUSER_EMAIL</span> are always administrators.</p>
      <div className="s" style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap", margin: "0 0 6px" }}>
        {mailOn === undefined ? null : mailOn
          ? <><Pill tone="ok">Email on</Pill><span>Admins are told of new requests, people are told when approved, and "Forgot password?" works.</span>
              <button className="btn sm" disabled={!!busy} onClick={() => { setBusy("mail"); setMailNote(undefined); api.testMail().then((r) => setMailNote(`Sent to ${r.to} from ${r.from}.`)).catch((e: Error) => setMailNote(e.message)).finally(() => setBusy(undefined)); }}>Send me a test email</button>
              {mailNote && <span>{mailNote}</span>}</>
          : <><Pill tone="warn">Email off</Pill><span>Add <span className="mono">SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, MAIL_FROM, ADMIN_NOTIFY</span> to the backend <span className="mono">.env</span> and restart to turn on request, approval and password-reset emails.</span></>}
      </div>
      <h2 style={{ fontSize: 15, margin: "18px 0 8px" }}>Waiting for approval {pending.length ? <Pill tone="warn">{pending.length}</Pill> : <span className="s">none</span>}</h2>
      {pending.length > 0 && <div className="tablewrap"><table>
        <thead><tr><th>Person</th><th>Role to give</th><th>Status</th><th>When</th><th /></tr></thead>
        <tbody>{pending.map(row)}</tbody>
      </table></div>}
      <h2 style={{ fontSize: 15, margin: "18px 0 8px" }}>Everyone else</h2>
      <div className="tablewrap"><table>
        <thead><tr><th>Person</th><th>Role</th><th>Status</th><th>Activity</th><th /></tr></thead>
        <tbody>{others.length === 0 && <tr><td colSpan={5} className="empty">Nobody yet.</td></tr>}{others.map(row)}</tbody>
      </table></div>
      <h2 style={{ fontSize: 15, margin: "18px 0 8px" }}>What people did <span className="s">(last 100)</span></h2>
      <div className="tablewrap"><table>
        <thead><tr><th>When</th><th>Who</th><th>Did</th><th>On</th></tr></thead>
        <tbody>
          {audit.map((a) => (
            <tr key={a.id}>
              <td className="s" style={{ whiteSpace: "nowrap" }}>{whenText(a.at)}</td>
              <td>{a.actor.replace(/ <.*>$/, "")}</td>
              <td>{ACTION_LABEL[a.action] ?? a.action.replace(/_/g, " ")}</td>
              <td className="s">{[a.target, a.detail].filter(Boolean).join(" · ")}</td>
            </tr>
          ))}
        </tbody>
      </table></div>
    </>
  );
}
