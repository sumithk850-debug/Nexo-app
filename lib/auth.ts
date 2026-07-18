import { supabase } from "./supabase";

export interface AuthUser {
  id: string;
  email: string;
  fullName?: string;
}

export interface SignUpDetails {
  email: string;
  password: string;
  fullName: string;
  birthday: string; // YYYY-MM-DD
}

export async function signUp(details: SignUpDetails) {
  const { data, error } = await supabase.auth.signUp({
    email: details.email,
    password: details.password,
    options: {
      data: {
        full_name: details.fullName,
        birthday: details.birthday,
      },
    },
  });
  return { data, error };
}

export async function signIn(email: string, password: string) {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  return { data, error };
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
    fullName: data.user.user_metadata?.full_name
  };
}

export function onAuthStateChange(callback: (user: AuthUser | null) => void) {
  const { data } = supabase.auth.onAuthStateChange((_event, session) => {
    if (session?.user) {
      callback({ 
        id: session.user.id, 
        email: session.user.email ?? "",
        fullName: session.user.user_metadata?.full_name
      });
    } else {
      callback(null);
    }
  });
  return data.subscription;
}
