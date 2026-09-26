"use client";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import dynamic from "next/dynamic";
import type { Me, ApiErrorShape } from "@/lib/types";
import type { EIP1193Provider } from "viem";

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
  const demo = process.env.NEXT_PUBLIC_APP_MODE === "demo";
  const appId = process.env.NEXT_PUBLIC_PRIVY_APP_ID;
  if (!demo && appId) return <PrivyBridge appId={appId}>{children}</PrivyBridge>;
  return (
    <SessionController demo={demo} getToken={emptyToken} authReady={true}>
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
  onLogin,
  onLogout,
  getProvider = unavailableProvider,
}: {
  children: ReactNode;
  demo: boolean;
  getToken: () => Promise<string | null>;
  authReady: boolean;
  authRevision?: string;
  onLogin?: () => void;
  onLogout?: () => Promise<void>;
  getProvider?: (address?: string) => Promise<EIP1193Provider>;
}) {
  const [me, setMe] = useState<Me | null>(null),
    [ready, setReady] = useState(false);
  const [revision, setRevision] = useState(0),
    [runtime, setRuntime] = useState<RuntimeConfig | null>(null),
    [toast, setToast] = useState("");
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
    else if (results[0].reason instanceof ApiError && results[0].reason.status === 401) setMe(null);
    else {
      setMe(null);
      setToast(
        results[0].reason instanceof Error ? results[0].reason.message : "Account is unavailable.",
      );
    }
    if (results[1].status === "fulfilled") setRuntime(results[1].value);
    setReady(true);
    setRevision((value) => value + 1);
  }, [api]);
  useEffect(() => {
    if (authReady) void refresh();
  }, [authReady, authRevision, refresh]);
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
    if (demo) await switchDemo("alex");
    else if (onLogin) onLogin();
    else setToast("Privy sign-in is not configured in this build.");
  }, [demo, switchDemo, onLogin]);
  const logout = useCallback(async () => {
    if (demo) await api("demo/session", { method: "DELETE" });
    else await onLogout?.();
    setMe(null);
    setRevision((value) => value + 1);
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
  const { api, revision } = useSession(),
    [data, setData] = useState<T | null>(null),
    [error, setError] = useState<Error | null>(null),
    [loading, setLoading] = useState(!!path);
  const reload = useCallback(async () => {
    if (!path) {
      setLoading(false);
      setData(null);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      setData(await api<T>(path));
    } catch (value) {
      setError(value instanceof Error ? value : new Error("Unable to load."));
    } finally {
      setLoading(false);
    }
  }, [path, api]);
  useEffect(() => {
    let cancelled = false;
    if (!path) {
      setData(null);
      setError(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    void api<T>(path)
      .then((result) => {
        if (!cancelled) setData(result);
      })
      .catch((value) => {
        if (!cancelled) {
          setData(null);
          setError(value instanceof Error ? value : new Error("Unable to load."));
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [path, api, revision]);
  return { data, error, loading, reload };
}
