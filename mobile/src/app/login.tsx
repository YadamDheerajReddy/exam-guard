import { useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
// Easing must come from Reanimated: layout-animation builders run their
// easing on the UI thread, so it has to be a worklet. A plain JS arrow
// throws "The easing function is not a worklet" on a real device (web only
// warns and silently falls back to linear, which is how this slipped past
// the browser preview).
import Animated, { Easing, FadeInDown, FadeInUp } from "react-native-reanimated";
import { supabase } from "@/lib/supabase";
import { checkLoginPassword } from "@/lib/api";
import { setPendingLoginCheck } from "@/lib/pending-login-check";
import { Logo } from "@/components/logo";
import { ScanVisual } from "@/components/auth/scan-visual";
import { Colors, Radius } from "@/constants/theme";

export default function LoginScreen() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSignIn() {
    if (!email || !password) {
      setError("Enter your email and password.");
      return;
    }
    setSubmitting(true);
    setError(null);

    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });

    setSubmitting(false);
    if (signInError) {
      setError("Incorrect email or password.");
      return;
    }

    // Registered before Stack.Protected has a chance to mount (app)/_layout
    // and read must_change_password itself — see pending-login-check.ts for
    // why that ordering matters. Errors here (e.g. not actually an
    // invigilator account) are swallowed; the layout's own lookup surfaces
    // that case with a proper message.
    setPendingLoginCheck(checkLoginPassword(password).catch(() => ({ mustChangePassword: false })));
    // On success, onAuthStateChange updates the session and Stack.Protected
    // switches to the (app) group automatically.
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <Animated.View entering={FadeInUp.duration(450).easing(Easing.out(Easing.cubic))}>
          <LinearGradient
            colors={["#122c56", Colors.accent, "#0d7ce0"]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.hero}
          >
            <View style={styles.eyebrowRow}>
              <Logo size={18} withWordmark={false} inverted />
              <Text style={styles.eyebrow}>INVIGILATOR SCANNER</Text>
            </View>
            <View style={styles.scanWrap}>
              <ScanVisual />
            </View>
            <Text style={styles.tagline}>Scan once. Identity, hall, and seat verified instantly — online or off.</Text>
          </LinearGradient>
        </Animated.View>

        <Animated.View
          entering={FadeInDown.delay(120).duration(400).easing(Easing.out(Easing.cubic))}
          style={styles.card}
        >
          <Text style={styles.title}>Sign in</Text>
          <Text style={styles.subtitle}>Use your institutional email.</Text>

          <View style={styles.field}>
            <Text style={styles.label}>Email</Text>
            <TextInput
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              autoComplete="email"
              keyboardType="email-address"
              style={styles.input}
              placeholder="you@institution.edu"
              placeholderTextColor={Colors.slate}
            />
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>Password</Text>
            <TextInput
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              autoComplete="password"
              autoCapitalize="none"
              autoCorrect={false}
              style={styles.input}
              placeholder="••••••••"
              placeholderTextColor={Colors.slate}
            />
          </View>

          {error && (
            <Animated.View entering={FadeInDown.duration(200)} style={styles.errorBox}>
              <Text style={styles.errorText}>{error}</Text>
            </Animated.View>
          )}

          <TouchableOpacity
            style={[styles.button, submitting && styles.buttonDisabled]}
            onPress={handleSignIn}
            disabled={submitting}
            activeOpacity={0.85}
          >
            <Text style={styles.buttonText}>{submitting ? "Signing in…" : "Sign in"}</Text>
          </TouchableOpacity>

          {/* No self-service reset for invigilators — an admin resets it
           * for you from the Invigilators page. */}
          <Text style={styles.contactAdminText}>Contact your organization admin for a password change.</Text>
        </Animated.View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: Colors.surface,
  },
  container: {
    flex: 1,
    justifyContent: "center",
    paddingHorizontal: 24,
  },
  hero: {
    borderTopLeftRadius: Radius * 2,
    borderTopRightRadius: Radius * 2,
    paddingTop: 24,
    paddingBottom: 20,
    paddingHorizontal: 20,
    alignItems: "center",
  },
  eyebrowRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    alignSelf: "flex-start",
  },
  eyebrow: {
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 1.2,
    color: "rgba(255,255,255,0.8)",
  },
  scanWrap: {
    marginTop: 12,
    marginBottom: 12,
    alignItems: "center",
  },
  tagline: {
    fontSize: 12,
    lineHeight: 17,
    color: "rgba(255,255,255,0.75)",
    textAlign: "center",
  },
  card: {
    backgroundColor: Colors.white,
    borderBottomLeftRadius: Radius * 2,
    borderBottomRightRadius: Radius * 2,
    borderWidth: 1,
    borderTopWidth: 0,
    borderColor: Colors.border,
    padding: 24,
  },
  title: {
    fontSize: 20,
    fontWeight: "700",
    color: Colors.ink,
  },
  subtitle: {
    marginTop: 4,
    fontSize: 14,
    color: Colors.slate,
  },
  field: {
    marginTop: 20,
    gap: 6,
  },
  label: {
    fontSize: 14,
    fontWeight: "600",
    color: Colors.charcoal,
  },
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
  errorText: {
    color: Colors.alert,
    fontSize: 14,
  },
  button: {
    marginTop: 24,
    backgroundColor: Colors.accent,
    borderRadius: Radius,
    paddingVertical: 14,
    alignItems: "center",
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    color: Colors.white,
    fontSize: 15,
    fontWeight: "600",
  },
  contactAdminText: {
    marginTop: 16,
    textAlign: "center",
    fontSize: 13,
    color: Colors.slate,
  },
});
