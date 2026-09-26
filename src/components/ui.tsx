"use client";
import Link from "next/link";
import { useEffect, useRef, type ReactNode } from "react";
import { ArrowUpRight, X, LockKeyhole, RefreshCw } from "lucide-react";
import { ApiError, useSession } from "./session";

export function Arrow({ size = 18 }: { size?: number }) {
  return <ArrowUpRight size={size} strokeWidth={1.5} aria-hidden="true" />;
}
export function Eyebrow({ children }: { children: ReactNode }) {
  return <p className="eyebrow">{children}</p>;
}
export function PageTitle({
  eyebrow,
  title,
  description,
  action,
}: {
  eyebrow: string;
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="page-title">
      <div>
        <Eyebrow>{eyebrow}</Eyebrow>
        <h1>{title}</h1>
        {description && <p className="muted">{description}</p>}
      </div>
      {action}
    </div>
  );
}
export function Empty({
  title,
  children,
  action,
}: {
  title: string;
  children?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="empty-state">
      <span className="empty-symbol">＋</span>
      <h2>{title}</h2>
      <p className="muted">{children}</p>
      {action}
    </div>
  );
}
export function Loading() {
  return (
    <div className="skeleton-grid" aria-label="Loading" role="status">
      {[0, 1, 2].map((id) => (
        <div className="skeleton" key={id} />
      ))}
    </div>
  );
}
export function ErrorBox({ error, retry }: { error: Error | string | null; retry?: () => void }) {
  if (!error) return null;
  return (
    <div className="error-box" role="alert">
      <p>{typeof error === "string" ? error : error.message}</p>
      {retry && (
        <button className="button small ghost" onClick={retry}>
          <RefreshCw size={14} />
          Try again
        </button>
      )}
    </div>
  );
}
export function AccessState({ error, retry }: { error: Error | null; retry?: () => void }) {
  const { login } = useSession();
  if (error instanceof ApiError && error.code === "MEMBERSHIP_REQUIRED") return <Paywall />;
  if (error instanceof ApiError && error.status === 401)
    return (
      <Empty
        title="Start with a hello."
        action={
          <button className="button lime" onClick={() => void login()}>
            Sign in <Arrow />
          </button>
        }
      >
        Create your account to continue.
      </Empty>
    );
  return <ErrorBox error={error} retry={retry} />;
}
export function Paywall() {
  return (
    <div className="paywall">
      <LockKeyhole size={28} />
      <Eyebrow>One membership. Wherever you go.</Eyebrow>
      <h2>
        Your next connection
        <br />
        starts here.
      </h2>
      <p>
        All published city guides. Relevant people. Plans for right now.
        <br />
        All Access is $39 a month. Cancel anytime.
      </p>
      <Link className="button lime" href="/membership">
        Get All Access <Arrow />
      </Link>
      <span className="muted small">Tokyo is live first. More cities included as they launch.</span>
    </div>
  );
}
export function Modal({
  open,
  title,
  onClose,
  children,
}: {
  open: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
}) {
  const dialog = useRef<HTMLDialogElement>(null),
    close = useRef(onClose);
  close.current = onClose;
  useEffect(() => {
    const element = dialog.current;
    if (!element) return;
    if (open && !element.open) element.showModal();
    if (!open && element.open) element.close();
  }, [open]);
  return (
    <dialog
      ref={dialog}
      className="modal"
      aria-label={title}
      onCancel={(event) => {
        event.preventDefault();
        close.current();
      }}
      onClick={(event) => {
        if (event.target === event.currentTarget) close.current();
      }}
    >
      <div className="modal-inner">
        <div className="modal-heading">
          <h2>{title}</h2>
          <button className="icon-button" onClick={onClose} aria-label="Close dialog">
            <X size={20} />
          </button>
        </div>
        {children}
      </div>
    </dialog>
  );
}
export function Avatar({ name, large = false }: { name: string; large?: boolean }) {
  const sum = [...name].reduce((value, char) => value + char.charCodeAt(0), 0);
  return (
    <span aria-hidden="true" className={"avatar avatar-" + (sum % 5) + (large ? " large" : "")}>
      {name
        .split(" ")
        .map((part) => part[0])
        .slice(0, 2)
        .join("")}
    </span>
  );
}
export function Tag({ children, lime = false }: { children: ReactNode; lime?: boolean }) {
  return <span className={"tag" + (lime ? " lime-tag" : "")}>{children}</span>;
}
export function TimeLeft({ expiresAt }: { expiresAt: string }) {
  const [minutes, setMinutes] = useMinute(expiresAt);
  return (
    <span className="time-left">
      {minutes <= 0
        ? "Expired"
        : minutes >= 60
          ? Math.floor(minutes / 60) + "h " + (minutes % 60) + "m left"
          : minutes + "m left"}
    </span>
  );
}
import { useState } from "react";
function useMinute(expiresAt: string): [number, (value: number) => void] {
  const calc = () => Math.max(0, Math.ceil((new Date(expiresAt).getTime() - Date.now()) / 60000));
  const [value, setValue] = useState(calc);
  useEffect(() => {
    const id = setInterval(() => setValue(calc()), 15000);
    return () => clearInterval(id);
  }, [expiresAt]);
  return [value, setValue];
}
export function dateLabel(value: string) {
  return (
    new Intl.DateTimeFormat("en", {
      timeZone: "Asia/Tokyo",
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    }).format(new Date(value)) + " JST"
  );
}
