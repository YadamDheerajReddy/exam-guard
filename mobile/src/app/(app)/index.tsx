import { useEffect, useState } from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useSession } from "@/context/session-context";
import { supabase } from "@/lib/supabase";
import { Colors, Radius } from "@/constants/theme";

type Invigilator = { full_name: string; assigned_hall_id: string | null };

export default function HomeScreen() {
  const { session, signOut } = useSession();
  const [invigilator, setInvigilator] = useState<Invigilator | null>(null);
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    if (!session) return;

    supabase
      .from("invigilators")
      .select("full_name, assigned_hall_id")
      .eq("id", session.user.id)
      .maybeSingle()
      .then(({ data }) => {
        if (!data) {
          // Signed in, but no invigilators row for this account.
          signOut();
          return;
        }
        setInvigilator(data);
        setChecked(true);
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session]);

  if (!checked || !invigilator) {
    return null;
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>Invigilator Scanner</Text>
          <Text style={styles.subtitle}>Welcome, {invigilator.full_name}</Text>
        </View>
        <TouchableOpacity style={styles.signOutButton} onPress={() => signOut()}>
          <Text style={styles.signOutText}>Sign out</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.placeholder}>
        <Text style={styles.placeholderText}>
          Phase 0 complete. Hall selection, offline roster sync, and the
          camera scanner land in Phase 3.
        </Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: Colors.surface,
    paddingHorizontal: 20,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 20,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  title: {
    fontSize: 18,
    fontWeight: "700",
    color: Colors.ink,
  },
  subtitle: {
    marginTop: 2,
    fontSize: 13,
    color: Colors.slate,
  },
  signOutButton: {
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  signOutText: {
    fontSize: 13,
    fontWeight: "600",
    color: Colors.charcoal,
  },
  placeholder: {
    marginTop: 24,
    borderWidth: 1,
    borderStyle: "dashed",
    borderColor: Colors.border,
    borderRadius: Radius,
    backgroundColor: Colors.white,
    padding: 32,
    alignItems: "center",
  },
  placeholderText: {
    textAlign: "center",
    fontSize: 14,
    color: Colors.slate,
  },
});
