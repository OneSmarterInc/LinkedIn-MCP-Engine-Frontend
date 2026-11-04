import { useEffect, type ReactNode } from "react";
import { statusTone, type Tone } from "../utils/format";

export function Pill({ tone = "neutral", children, title }: { tone?: Tone; children: ReactNode; title?: string }) {
  return <span className={`pill ${tone}`} title={title}>{children}</span>;
}

export function StatusPill({ status }: { status: string }) {
  return <Pill tone={statusTone(status)}>{status || "No status"}</Pill>;
}

export function Stat({ label, value, small, hot }: { label: string; value: ReactNode; small?: ReactNode; hot?: boolean }) {
  return (
    <div className={`stat${hot ? " hot" : ""}`}>
      <div className="k">{label}</div>
      <div className="v">{value}{small !== undefined && <small>{small}</small>}</div>
    </div>
  );
}

export function Switch({ on, onChange, label, disabled }: { on: boolean; onChange: (v: boolean) => void; label: string; disabled?: boolean }) {
  return (
    <button
      type="button" role="switch" aria-checked={on} aria-label={label} disabled={disabled}
      className={`sw${on ? " on" : ""}`} onClick={() => onChange(!on)}
    />
  );
}

export function Banner({ tone, children, action }: { tone: "bad" | "warn" | "info"; children: ReactNode; action?: ReactNode }) {
  return <div className={`banner ${tone}`} role={tone === "bad" ? "alert" : "status"}><div className="grow">{children}</div>{action}</div>;
}

export const Spinner = () => <span className="spin" aria-hidden="true" />;

export function Loading({ text = "Reading the Sheet…" }: { text?: string }) {
  return <div className="loading"><Spinner /> {text}</div>;
}

export function Modal({ title, onClose, children, footer, wide }: { title: string; onClose: () => void; children: ReactNode; footer: ReactNode; wide?: boolean }) {
  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [onClose]);
  return (
    <>
      <div className="scrim open" onClick={onClose} />
      <div className="modal" role="dialog" aria-modal="true" aria-label={title} onClick={onClose}>
        <div className={`box${wide ? " wide" : ""}`} onClick={(e) => e.stopPropagation()}>
          <div className="mhead"><h2>{title}</h2><button className="btn sm" style={{ marginLeft: "auto" }} onClick={onClose} aria-label="Close">×</button></div>
          <div className="mbody">{children}</div>
          <div className="mfoot">{footer}</div>
        </div>
      </div>
    </>
  );
}
