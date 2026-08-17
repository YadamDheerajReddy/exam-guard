import { useEffect, useState } from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { useScanSession } from "@/context/scan-session-context";
import { SyncStatusBar } from "@/components/sync-status-bar";
import { getRosterCountForHall, getSessionSummary } from "@/lib/local-db";
import { drainQueueOnce } from "@/lib/sync-engine";
import { Colors, Radius } from "@/constants/theme";

export default function SessionSummaryScreen() {
  const router = useRouter();
  const { session, pendingSyncCount, endSession } = useScanSession();
  const [counts, setCounts] = useState({ verified: 0, wrongHall: 0, flagged: 0 });
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    if (!session) return;
    setCounts(getSessionSummary(session.exam.id, session.hallId));
  }, [session, pendingSyncCount]);

  if (!session) {
    router.replace("/");
    return null;
  }

  const rosterCount = getRosterCountForHall(session.exam.id, session.hallId);
  const notYetSeen = Math.max(0, rosterCount - counts.verified - counts.flagged);
  const allSynced = pendingSyncCount === 0;

  async function handleSubmit() {
    await drainQueueOnce();
    setSubmitted(true);
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <SyncStatusBar />
      <View style={styles.header}>
        <Text style={styles.title}>Session Summary</Text>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={styles.backText}>Back</Text>
        </TouchableOpacity>
      </View>
      <Text style={styles.subtitle}>
        {session.exam.courseCode} — {session.hallBuildingName} · {session.hallRoomNumber}
      </Text>

      <View style={styles.grid}>
        <View style={[styles.statCard, styles.verifiedCard]}>
          <Text style={[styles.statValue, styles.verifiedText]}>{counts.verified}</Text>
          <Text style={styles.statLabel}>Verified</Text>
        </View>
        <View style={[styles.statCard, styles.pendingCard]}>
          <Text style={[styles.statValue, styles.pendingText]}>{notYetSeen}</Text>
          <Text style={styles.statLabel}>Not Yet Seen</Text>
        </View>
        <View style={[styles.statCard, styles.alertCard]}>
          <Text style={[styles.statValue, styles.alertText]}>{counts.wrongHall}</Text>
          <Text style={styles.statLabel}>Wrong Hall</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statValue}>{counts.flagged}</Text>
          <Text style={styles.statLabel}>Flagged</Text>
        </View>
      </View>

      {submitted ? (
        <View style={styles.submittedBox}>
          <Text style={styles.submittedText}>Submitted — all scans synced to the admin dashboard.</Text>
        </View>
      ) : (
        <TouchableOpacity style={[styles.submitButton, !allSynced && styles.submitButtonDisabled]} onPress={handleSubmit}>
          <Text style={styles.submitButtonText}>
            {allSynced ? "Submit to Admin" : `Waiting on ${pendingSyncCount} pending sync…`}
          </Text>
        </TouchableOpacity>
      )}

      <TouchableOpacity style={styles.linkButton} onPress={endSession}>
        <Text style={styles.linkText}>End session — pick a different exam</Text>
      </TouchableOpacity>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: Colors.surface, paddingHorizontal: 20 },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingTop: 16 },
  title: { fontSize: 18, fontWeight: "700", color: Colors.ink },
  backText: { fontSize: 13, fontWeight: "600", color: Colors.accent },
  subtitle: { marginTop: 4, fontSize: 13, color: Colors.slate },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 12, marginTop: 20 },
  statCard: {
    width: "47%",
    backgroundColor: Colors.white,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius,
    padding: 18,
  },
  statValue: { fontSize: 28, fontWeight: "800", color: Colors.ink },
  statLabel: { marginTop: 4, fontSize: 12, fontWeight: "600", color: Colors.slate, textTransform: "uppercase" },
  verifiedCard: { backgroundColor: Colors.verifiedTint },
  verifiedText: { color: Colors.verified },
  pendingCard: { backgroundColor: Colors.pendingTint },
  pendingText: { color: Colors.pending },
  alertCard: { backgroundColor: Colors.alertTint },
  alertText: { color: Colors.alert },
  submitButton: {
    marginTop: 28,
    backgroundColor: Colors.accent,
    borderRadius: Radius,
    paddingVertical: 14,
    alignItems: "center",
  },
  submitButtonDisabled: { opacity: 0.5 },
  submitButtonText: { color: Colors.white, fontSize: 15, fontWeight: "600" },
  submittedBox: { marginTop: 28, backgroundColor: Colors.verifiedTint, borderRadius: Radius, padding: 16, alignItems: "center" },
  submittedText: { color: Colors.verified, fontSize: 14, fontWeight: "600", textAlign: "center" },
  linkButton: { marginTop: 16, alignItems: "center" },
  linkText: { color: Colors.accent, fontSize: 13, fontWeight: "600" },
});
