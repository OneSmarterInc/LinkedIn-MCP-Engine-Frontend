import { createContext, useContext, type ReactNode } from "react";
import type { Me } from "../api/types";

/** Who is signed in (accounts mode), or undefined when the backend runs with the shared token or open. */
export interface AuthState {
  me?: Me;
  accounts: boolean;
  refreshMe: () => Promise<void>;
  signOut: () => Promise<void>;
}

const Ctx = createContext<AuthState>({ accounts: false, refreshMe: async () => {}, signOut: async () => {} });

export function AuthProvider({ value, children }: { value: AuthState; children: ReactNode }) {
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export const useAuth = (): AuthState => useContext(Ctx);
export const useIsAdmin = (): boolean => { const { me, accounts } = useAuth(); return !accounts || me?.user.role === "admin"; };
