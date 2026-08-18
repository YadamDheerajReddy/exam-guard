import { Stack } from "expo-router";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { ScanSessionProvider } from "@/context/scan-session-context";
import { InvigilatorProvider, useInvigilator } from "@/context/invigilator-context";
import { useSession } from "@/context/session-context";
import { ForcedChangePassword } from "@/components/forced-change-password";
import { Colors, Radius } from "@/constants/theme";

export default function AppLayout() {
  return (
    <InvigilatorProvider>
      <AppGate />
    </InvigilatorProvider>
  );
}

function AppGate() {
  const { lookup } = useInvigilator();
  const { session, signOut } = useSession();

  if (lookup.status === "loading") return null;

  if (lookup.status === "not-invigilator" || lookup.status === "error") {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.centerCard}>
          <Text style={styles.title}>
            {lookup.status === "not-invigilator" ? "Not an invigilator account" : "Couldn't load your profile"}
          </Text>
          <Text style={styles.subtitle}>
            {lookup.status === "not-invigilator"
              ? `${session?.user.email} signed in successfully, but there's no matching row in the invigilators table. Ask an admin to add one, or sign out and use an invigilator account instead.`
              : lookup.message}
          </Text>
          <TouchableOpacity style={styles.button} onPress={() => signOut()}>
            <Text style={styles.buttonText}>Sign out</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  if (lookup.invigilator.mustChangePassword) {
    return <ForcedChangePassword />;
  }

  return (
    <ScanSessionProvider>
      <Stack screenOptions={{ headerShown: false }} />
    </ScanSessionProvider>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: Colors.surface, paddingHorizontal: 20 },
  centerCard: { flex: 1, justifyContent: "center", gap: 12 },
  title: { fontSize: 18, fontWeight: "700", color: Colors.ink },
  subtitle: { marginTop: 2, fontSize: 13, color: Colors.slate },
  button: {
    marginTop: 12,
    alignSelf: "flex-start",
    backgroundColor: Colors.accent,
    borderRadius: Radius,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  buttonText: { color: Colors.white, fontSize: 14, fontWeight: "600" },
});
