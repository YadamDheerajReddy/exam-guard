import { useEffect, useState } from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useSession } from "@/context/session-context";
import { supabase } from "@/lib/supabase";
import { Colors, Radius } from "@/constants/theme";

type Invigilator = { full_name: string; assigned_hall_id: string | null };
type LookupState =
  | { status: "loading" }
  | { status: "ready"; invigilator: Invigilator }
  | { status: "not-invigilator" }
  | { status: "error"; message: string };

export default function HomeScreen() {
  const { session, signOut } = useSession();
  const [lookup, setLookup] = useState<LookupState>({ status: "loading" });

  useEffect(() => {
    if (!session) return;

    setLookup({ status: "loading" });

    supabase
      .from("invigilators")
      .select("full_name, assigned_hall_id")
      .eq("id", session.user.id)
      .maybeSingle()
      .then(({ data, error }) => {
        if (error) {
          setLookup({ status: "error", message: error.message });
          return;
        }
        if (!data) {
          setLookup({ status: "not-invigilator" });
          return;
        }
        setLookup({ status: "ready", invigilator: data });
      });
  }, [session]);

  if (lookup.status === "loading") {
    return null;
  }

  if (lookup.status === "not-invigilator") {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.centerCard}>
          <Text style={styles.title}>Not an invigilator account</Text>
          <Text style={styles.subtitle}>
            {session?.user.email} signed in successfully, but there&apos;s no
            matching row in the invigilators table. Ask an admin to add one,
            or sign out and use an invigilator account instead.
          </Text>
          <TouchableOpacity style={styles.button} onPress={() => signOut()}>
            <Text style={styles.buttonText}>Sign out</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  if (lookup.status === "error") {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.centerCard}>
          <Text style={styles.title}>Couldn&apos;t load your profile</Text>
          <Text style={styles.subtitle}>{lookup.message}</Text>
          <TouchableOpacity style={styles.button} onPress={() => signOut()}>
            <Text style={styles.buttonText}>Sign out</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const { invigilator } = lookup;

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
  centerCard: {
    flex: 1,
    justifyContent: "center",
    gap: 12,
  },
  button: {
    marginTop: 12,
    alignSelf: "flex-start",
    backgroundColor: Colors.accent,
    borderRadius: Radius,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  buttonText: {
    color: Colors.white,
    fontSize: 14,
    fontWeight: "600",
  },
});
