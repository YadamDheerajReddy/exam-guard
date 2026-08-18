// Bridges a timing gap between login.tsx and InvigilatorProvider: the
// moment supabase.auth.signInWithPassword() resolves, Stack.Protected
// reacts to the new session and can mount (app)/_layout.tsx — including its
// own DB read of must_change_password — before login.tsx's subsequent
// checkLoginPassword() call has finished writing that flag. Registering the
// in-flight promise here lets the provider await the *same* call instead of
// racing an independent read against it.
let pending: Promise<{ mustChangePassword: boolean }> | null = null;

export function setPendingLoginCheck(promise: Promise<{ mustChangePassword: boolean }>) {
  pending = promise;
}

export function takePendingLoginCheck() {
  const value = pending;
  pending = null;
  return value;
}
