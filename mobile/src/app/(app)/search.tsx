import { useMemo, useState } from "react";
import { FlatList, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import * as Haptics from "expo-haptics";
import { useScanSession } from "@/context/scan-session-context";
import { SyncStatusBar } from "@/components/sync-status-bar";
import { VerificationResultCard } from "@/components/verification-result-card";
import { decideForManual, type ScanDecision } from "@/lib/scan-decision";
import { searchByRollNumber, enqueueScan, type RosterRow } from "@/lib/local-db";
import { drainQueueOnce } from "@/lib/sync-engine";
import { Colors, Radius } from "@/constants/theme";

export default function ManualSearchScreen() {
  const router = useRouter();
  const { session } = useScanSession();
  const [query, setQuery] = useState("");
  const [pending, setPending] = useState<ScanDecision | null>(null);

  const results = useMemo(() => {
    if (!session || query.trim().length === 0) return [];
    return searchByRollNumber(session.exam.id, session.hallId, query.trim());
  }, [session, query]);

  if (!session) {
    router.replace("/");
    return null;
  }

  function handlePick(roster: RosterRow) {
    const decision = decideForManual(roster, session!.hallId, session!.exam.id, session!.hallId);
    setPending(decision);

    const feedback =
      decision.outcome.kind === "VERIFIED"
        ? Haptics.NotificationFeedbackType.Success
        : decision.outcome.kind === "WRONG_HALL"
          ? Haptics.NotificationFeedbackType.Error
          : Haptics.NotificationFeedbackType.Warning;
    Haptics.notificationAsync(feedback);

    if (decision.outcome.kind !== "VERIFIED") {
      enqueueScan(decision.queueRow);
      drainQueueOnce();
    }
  }

  function confirmVerified() {
    if (!pending) return;
    enqueueScan(pending.queueRow);
    drainQueueOnce();
    dismiss();
  }

  function dismiss() {
    setPending(null);
    setQuery("");
  }

  return (
    <View style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <SyncStatusBar />
        <View style={styles.header}>
          <Text style={styles.title}>Manual Search</Text>
          <TouchableOpacity onPress={() => router.back()}>
            <Text style={styles.backText}>Back to scanner</Text>
          </TouchableOpacity>
        </View>
        <Text style={styles.subtitle}>For damaged passes or dead phones — find the student by roll number.</Text>

        <TextInput
          value={query}
          onChangeText={setQuery}
          autoCapitalize="characters"
          autoCorrect={false}
          placeholder="Roll number"
          placeholderTextColor={Colors.slate}
          style={styles.input}
        />

        <FlatList
          data={results}
          keyExtractor={(item) => item.mapping_id}
          contentContainerStyle={styles.list}
          renderItem={({ item }) => (
            <TouchableOpacity style={styles.resultRow} onPress={() => handlePick(item)}>
              <View>
                <Text style={styles.resultRoll}>{item.roll_number}</Text>
                <Text style={styles.resultName}>{item.full_name}</Text>
              </View>
              <Text style={styles.resultDept}>{item.department}</Text>
            </TouchableOpacity>
          )}
          ListEmptyComponent={
            query.trim().length > 0 ? <Text style={styles.empty}>No matches in this exam&apos;s roster.</Text> : null
          }
        />
      </SafeAreaView>

      {pending && (
        <VerificationResultCard
          outcome={pending.outcome}
          exam={session.exam}
          onConfirm={pending.outcome.kind === "VERIFIED" ? confirmVerified : undefined}
          onDismiss={dismiss}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.surface },
  safeArea: { flex: 1, paddingHorizontal: 20 },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingTop: 16 },
  title: { fontSize: 18, fontWeight: "700", color: Colors.ink },
  backText: { fontSize: 13, fontWeight: "600", color: Colors.accent },
  subtitle: { marginTop: 4, fontSize: 13, color: Colors.slate },
  input: {
    marginTop: 16,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    color: Colors.ink,
    backgroundColor: Colors.white,
  },
  list: { marginTop: 8, paddingBottom: 24 },
  resultRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: Colors.white,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius,
    paddingHorizontal: 16,
    paddingVertical: 14,
    marginTop: 10,
  },
  resultRoll: { fontSize: 14, fontWeight: "600", color: Colors.ink },
  resultName: { marginTop: 2, fontSize: 13, color: Colors.charcoal },
  resultDept: { fontSize: 12, color: Colors.slate },
  empty: { marginTop: 20, textAlign: "center", fontSize: 13, color: Colors.slate },
});
