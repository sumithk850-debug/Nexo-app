import { supabase } from "./supabase";

export interface AuthUser {
  id: string;
  email: string;
  fullName?: string;
  birthday?: string;
}

export interface SignUpDetails {
  email: string;
  password: string;
  fullName?: string;
  birthday?: string; // YYYY-MM-DD, optional
}

export async function signUp(details: SignUpDetails) {
  const { data, error } = await supabase.auth.signUp({
    email: details.email,
    password: details.password,
    options: {
      data: {
        ...(details.fullName ? { full_name: details.fullName } : {}),
        ...(details.birthday ? { birthday: details.birthday } : {}),
      },
    },
  });
  return { data, error };
}

export async function signIn(email: string, password: string) {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  return { data, error };
}

export async function signInWithGithub() {
  if (typeof window !== "undefined") {
    window.sessionStorage.setItem("kyvorix.github.profile.pending", "true");
  }
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "github",
    options: { redirectTo: typeof window !== "undefined" ? window.location.origin : undefined },
  });
  if (error && typeof window !== "undefined") {
    window.sessionStorage.removeItem("kyvorix.github.profile.pending");
  }
  return { data, error };
}

export async function linkGithubIdentity() {
  const { data, error } = await supabase.auth.linkIdentity({
    provider: "github",
    options: { redirectTo: typeof window !== "undefined" ? window.location.origin : undefined },
  });
  return { data, error };
}

export async function updateProfile(details: { fullName?: string; birthday?: string }) {
  const data: Record<string, string> = {};
  if (details.fullName?.trim()) data.full_name = details.fullName.trim();
  if (details.birthday) data.birthday = details.birthday;
  const { data: userData, error } = await supabase.auth.updateUser({ data });
  return { data: userData, error };
}

export async function signOut() {
  await supabase.auth.signOut();
}

export async function getCurrentUser(): Promise<AuthUser | null> {
  const { data } = await supabase.auth.getUser();
  if (!data.user) return null;
  return { 
    id: data.user.id, 
    email: data.user.email ?? "",
    fullName: data.user.user_metadata?.full_name ?? data.user.user_metadata?.name,
    birthday: data.user.user_metadata?.birthday
  };
}

export function onAuthStateChange(callback: (user: AuthUser | null) => void) {
  const { data } = supabase.auth.onAuthStateChange((_event, session) => {
    if (session?.user) {
      callback({ 
        id: session.user.id, 
        email: session.user.email ?? "",
        fullName: session.user.user_metadata?.full_name ?? session.user.user_metadata?.name,
        birthday: session.user.user_metadata?.birthday
      });
    } else {
      callback(null);
    }
  });
  return data.subscription;
}
