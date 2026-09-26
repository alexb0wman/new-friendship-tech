"use client";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import dynamic from "next/dynamic";
import type { Me, ApiErrorShape } from "@/lib/types";
import type { EIP1193Provider } from "viem";
import type { PublicAuthConfig } from "@/lib/auth-config";

export interface RuntimeConfig {
  demo: boolean;
  checkout: { enabled: boolean; demo: boolean; reason: string };
  ensEnabled: boolean;
  ensWriteEnabled: boolean;
  actors: { key: string; id: string; label: string }[];
  world: {
    enabled: boolean;
    appId: string | null;
    rpId: string | null;
    environment: string;
    action: string;
    agentsEnabled: boolean;
    simulated: boolean;
  };
  ensParent: string | null;
  origin: string;
}
export class ApiError extends Error {
  constructor(
    public code: string,
    message: string,
    public status: number,
    public correlationId?: string,
  ) {
    super(message);
  }
}
interface Session {
  me: Me | null;
  ready: boolean;
  revision: number;
  config: RuntimeConfig | null;
  api: <T>(path: string, options?: RequestInit) => Promise<T>;
  refresh: () => Promise<void>;
  login: () => Promise<void>;
  logout: () => Promise<void>;
  switchDemo: (actor: string) => Promise<void>;
  walletProvider: (address?: string) => Promise<EIP1193Provider>;
  notice: (message: string) => void;
}
const Context = createContext<Session | null>(null);
const emptyToken = async () => null;
const unavailableProvider = async (): Promise<EIP1193Provider> => {
  throw new Error("A connected wallet is required.");
};
export function BootScreen() {
  return (
    <div className="boot-screen" role="status" aria-label="Opening">
      <span className="boot-particles" aria-hidden="true">
        {Array.from({ length: 22 }, (_, index) => (
          <i
            key={index}
            style={{
              left: `${(index * 17) % 100}%`,
              animationDelay: `${(index % 11) * -0.16}s`,
              animationDuration: `${1.5 + (index % 5) * 0.22}s`,
              width: index % 4 === 0 ? 4 : 2,
              height: index % 4 === 0 ? 4 : 2,
              background: index % 3 === 0 ? "#f4f1ea" : "#c7ff97",
            }}
          />
        ))}
      </span>
    </div>
  );
}
const PrivyBridge = dynamic(() => import("./privy-bridge"), {
  ssr: false,
  loading: () => <BootScreen />,
});

export function Providers({ children }: { children: ReactNode }) {
  const [auth, setAuth] = useState<PublicAuthConfig | null>(null);
  const [error, setError] = useState(false);
  const [loginRequested, setLoginRequested] = useState(false);
  const pending = useRef<AbortController | null>(null);
  const loadAuth = useCallback(async () => {
    pending.current?.abort();
    const controller = new AbortController();
    pending.current = controller;
    setError(false);
    setAuth(null);
    const timeout = setTimeout(() => controller.abort(), 10000);
    try {
      const response = await fetch("/api/auth/config", {
        credentials: "same-origin",
        cache: "no-store",
        signal: controller.signal,
      });
      if (!response.ok) throw new Error("Sign-in is unavailable.");
      const value = (await response.json()) as PublicAuthConfig;
      if (
        typeof value.demo !== "boolean" ||
        typeof value.enabled !== "boolean" ||
        !(value.appId === null || typeof value.appId === "string") ||
        (!value.demo && value.enabled && !value.appId)
      )
        throw new Error("Sign-in is unavailable.");
      if (pending.current === controller) setAuth(value);
    } catch {
      if (pending.current === controller) setError(true);
    } finally {
      clearTimeout(timeout);
    }
  }, []);
  useEffect(() => {
    void loadAuth();
    return () => {
      pending.current?.abort();
      pending.current = null;
    };
  }, [loadAuth]);
  const onLoginHandled = useCallback(() => setLoginRequested(false), []);
  const requestLogin = useCallback(() => {
    if (auth && !auth.enabled && loginRequested)
      throw new Error("Sign-in is temporarily unavailable. Please try again later.");
    setLoginRequested(true);
    if (error || (auth && !auth.enabled)) void loadAuth();
  }, [auth, error, loadAuth, loginRequested]);
  if (auth && !auth.demo && auth.enabled && auth.appId)
    return (
      <PrivyBridge
        appId={auth.appId}
        loginRequested={loginRequested}
        onLoginHandled={onLoginHandled}
      >
        {children}
      </PrivyBridge>
    );
  return (
    <SessionController
      demo={auth?.demo ?? false}
      getToken={emptyToken}
      authReady={!!auth}
      onLogin={requestLogin}
      loginRequested={loginRequested}
      onLoginHandled={onLoginHandled}
      authError={error ? "Unable to connect to sign-in. Select Sign in to retry." : undefined}
    >
      {children}
    </SessionController>
  );
}
export function SessionController({
  children,
  demo,
  getToken,
  authReady,
  authRevision = "",
  loginRequested = false,
  onLoginHandled,
  authError,
  onLogin,
  onLogout,
  getProvider = unavailableProvider,
}: {
  children: ReactNode;
  demo: boolean;
  getToken: () => Promise<string | null>;
  authReady: boolean;
  authRevision?: string;
  loginRequested?: boolean;
  onLoginHandled?: () => void;
  authError?: string;
  onLogin?: () => void | Promise<void>;
  onLogout?: () => Promise<void>;
  getProvider?: (address?: string) => Promise<EIP1193Provider>;
}) {
  const [me, setMe] = useState<Me | null>(null),
    [ready, setReady] = useState(false);
  const [revision, setRevision] = useState(0),
    [runtime, setRuntime] = useState<RuntimeConfig | null>(null),
    [toast, setToast] = useState("");
  const refreshSequence = useRef(0);
  const api = useCallback(
    async <T,>(path: string, options: RequestInit = {}): Promise<T> => {
      const token = await getToken(),
        headers = new Headers(options.headers);
      if (token) headers.set("Authorization", "Bearer " + token);
      if (options.body) headers.set("Content-Type", "application/json");
      const response = await fetch("/api/" + path, {
        ...options,
        headers,
        credentials: "same-origin",
        cache: "no-store",
      });
      const body = await response.json();
      if (!response.ok) {
        const error = body.error as ApiErrorShape | undefined;
        throw new ApiError(
          error?.code ?? "REQUEST_FAILED",
          error?.message ?? "Request failed.",
          response.status,
          error?.correlationId,
        );
      }
      return body as T;
    },
    [getToken],
  );
  const refresh = useCallback(async () => {
    const results = await Promise.allSettled([api<Me>("me"), api<RuntimeConfig>("config")]);
    if (results[0].status === "fulfilled") setMe(results[0].value);
    else setMe(null);
    if (results[1].status === "fulfilled") setRuntime(results[1].value);
    setReady(true);
    setRevision((value) => value + 1);
  }, [api]);
  useEffect(() => {
    if (authReady) void refresh();
    return () => {
      refreshSequence.current++;
    };
  }, [authReady, authRevision, refresh]);
  useEffect(() => {
    if (authError) setToast(authError);
  }, [authError]);
  useEffect(() => {
    if (!toast) return;
    const id = setTimeout(() => setToast(""), 5000);
    return () => clearTimeout(id);
  }, [toast]);
  const switchDemo = useCallback(
    async (actor: string) => {
      await api("demo/session", { method: "POST", body: JSON.stringify({ actor }) });
      await refresh();
    },
    [api, refresh],
  );
  const login = useCallback(async () => {
    try {
      if (demo) await switchDemo("alex");
      else if (onLogin) await onLogin();
      else setToast("Sign-in is temporarily unavailable. Please try again later.");
    } catch (error) {
      setToast(error instanceof Error ? error.message : "Unable to sign in. Please try again.");
    }
  }, [demo, switchDemo, onLogin]);
  const handledLoginRequest = useRef(false);
  useEffect(() => {
    if (!loginRequested) handledLoginRequest.current = false;
    if (!loginRequested || !authReady || handledLoginRequest.current) return;
    handledLoginRequest.current = true;
    onLoginHandled?.();
    void login();
  }, [loginRequested, authReady, login, onLoginHandled]);
  const logout = useCallback(async () => {
    try {
      if (demo) await api("demo/session", { method: "DELETE" });
      else await onLogout?.();
      refreshSequence.current++;
      setMe(null);
      setRevision((value) => value + 1);
    } catch (error) {
      setToast(error instanceof Error ? error.message : "Unable to sign out. Please try again.");
    }
  }, [api, demo, onLogout]);
  const value = useMemo(
    () => ({
      me,
      ready,
      revision,
      config: runtime,
      api,
      refresh,
      login,
      logout,
      switchDemo,
      walletProvider: getProvider,
      notice: setToast,
    }),
    [me, ready, revision, runtime, api, refresh, login, logout, switchDemo, getProvider],
  );
  return (
    <Context.Provider value={value}>
      {children}
      {toast && (
        <div className="toast" role="status">
          {toast}
          <button onClick={() => setToast("")} aria-label="Dismiss message">
            ×
          </button>
        </div>
      )}
    </Context.Provider>
  );
}
export function useSession() {
  const session = useContext(Context);
  if (!session) throw new Error("Session provider missing");
  return session;
}
export function useResource<T>(path: string | null) {
  const { api, revision, me } = useSession(),
    [data, setData] = useState<T | null>(null),
    [error, setError] = useState<Error | null>(null),
    [loading, setLoading] = useState(!!path);
  const requestSequence = useRef(0);
  const controller = useRef<AbortController | null>(null);
  const resourceKey = `${me?.user.id ?? "guest"}:${path ?? ""}`;
  const previousKey = useRef<string | null>(null);
  const reload = useCallback(async () => {
    const sequence = ++requestSequence.current;
    controller.current?.abort();
    const request = new AbortController();
    controller.current = request;
    // Preserve an unchanged result during revalidation. Checkout reacts to a newly
    // settled invoice; clearing it on every session refresh would retrigger that effect.
    if (previousKey.current !== resourceKey) setData(null);
    previousKey.current = resourceKey;
    setError(null);
    if (!path) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const result = await api<T>(path, { signal: request.signal });
      if (sequence === requestSequence.current) setData(result);
    } catch (value) {
      if (sequence === requestSequence.current) {
        setData(null);
        setError(value instanceof Error ? value : new Error("Unable to load."));
      }
    } finally {
      if (sequence === requestSequence.current) setLoading(false);
    }
  }, [path, api, resourceKey]);
  useEffect(() => {
    void reload();
    return () => {
      requestSequence.current++;
      controller.current?.abort();
    };
  }, [reload, revision]);
  return { data, error, loading, reload };
}
