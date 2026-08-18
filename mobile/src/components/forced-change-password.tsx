import { useState } from "react";
import { KeyboardAvoidingView, Platform, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { changeInvigilatorPassword } from "@/lib/api";
import { useInvigilator } from "@/context/invigilator-context";
import { useSession } from "@/context/session-context";
import { Logo } from "@/components/logo";
import { Colors, Radius } from "@/constants/theme";

export function ForcedChangePassword() {
  const { refresh } = useInvigilator();
  const { signOut } = useSession();
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit() {
    if (newPassword.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setError("Passwords don't match.");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      await changeInvigilatorPassword(newPassword);
      refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't change password.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <View style={styles.card}>
          <Logo size={26} />
          <Text style={styles.title}>Set a new password</Text>
          <Text style={styles.subtitle}>
            You&apos;re still using the temporary password. Choose a password only you know before continuing.
          </Text>

          <View style={styles.field}>
            <Text style={styles.label}>New password</Text>
            <TextInput
              value={newPassword}
              onChangeText={setNewPassword}
              secureTextEntry
              autoComplete="new-password"
              style={styles.input}
              placeholder="••••••••"
              placeholderTextColor={Colors.slate}
            />
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>Confirm password</Text>
            <TextInput
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              secureTextEntry
              autoComplete="new-password"
              style={styles.input}
              placeholder="••••••••"
              placeholderTextColor={Colors.slate}
            />
          </View>

          {error && (
            <View style={styles.errorBox}>
              <Text style={styles.errorText}>{error}</Text>
            </View>
          )}

          <TouchableOpacity
            style={[styles.button, submitting && styles.buttonDisabled]}
            onPress={handleSubmit}
            disabled={submitting}
          >
            <Text style={styles.buttonText}>{submitting ? "Saving…" : "Set password"}</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.signOutButton} onPress={() => signOut()}>
            <Text style={styles.signOutText}>Sign out</Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: Colors.surface },
  container: { flex: 1, justifyContent: "center", paddingHorizontal: 24 },
  card: {
    backgroundColor: Colors.white,
    borderRadius: Radius,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 24,
  },
  title: { marginTop: 16, fontSize: 20, fontWeight: "700", color: Colors.ink },
  subtitle: { marginTop: 4, fontSize: 14, color: Colors.slate },
  field: { marginTop: 20, gap: 6 },
  label: { fontSize: 14, fontWeight: "600", color: Colors.charcoal },
  input: {
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 15,
    color: Colors.ink,
    backgroundColor: Colors.white,
  },
  errorBox: {
    marginTop: 16,
    backgroundColor: Colors.alertTint,
    borderRadius: Radius,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  errorText: { color: Colors.alert, fontSize: 14 },
  button: {
    marginTop: 24,
    backgroundColor: Colors.accent,
    borderRadius: Radius,
    paddingVertical: 14,
    alignItems: "center",
  },
  buttonDisabled: { opacity: 0.6 },
  buttonText: { color: Colors.white, fontSize: 15, fontWeight: "600" },
  signOutButton: { marginTop: 16, alignItems: "center" },
  signOutText: { color: Colors.slate, fontSize: 13, fontWeight: "600" },
});
