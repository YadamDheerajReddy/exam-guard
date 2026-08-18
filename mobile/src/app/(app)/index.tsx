import { useEffect, useState } from "react";
import { StyleSheet, Text, TouchableOpacity, View, ActivityIndicator } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { useSession } from "@/context/session-context";
import { useInvigilator } from "@/context/invigilator-context";
import { useScanSession } from "@/context/scan-session-context";
import { SyncStatusBar } from "@/components/sync-status-bar";
import { Logo } from "@/components/logo";
import { fetchExams, type ExamSummary } from "@/lib/api";
import { Colors, Radius } from "@/constants/theme";

export default function HomeScreen() {
  const router = useRouter();
  const { signOut } = useSession();
  // The (app) layout only renders this Stack once lookup.status is "ready"
  // and mustChangePassword is false — this early return is just keeping
  // TypeScript honest about that, not a state this screen expects to hit.
  const { lookup } = useInvigilator();
  const { session: activeSession, presyncing, presyncError, startSession, endSession } = useScanSession();
  const [exams, setExams] = useState<ExamSummary[] | null>(null);
  const [examsError, setExamsError] = useState<string | null>(null);

  const invigilator = lookup.status === "ready" ? lookup.invigilator : null;

  useEffect(() => {
    if (!invigilator?.assignedHallId || activeSession) return;
    fetchExams()
      .then(setExams)
      .catch((err) => setExamsError(err instanceof Error ? err.message : "Couldn't load exams."));
  }, [invigilator?.assignedHallId, activeSession]);

  if (!invigilator) return null;

  return (
    <SafeAreaView style={styles.safeArea}>
      <SyncStatusBar />
      <View style={styles.header}>
        <View style={styles.headerRow}>
          <Logo size={20} withWordmark={false} />
          <View>
            <Text style={styles.title}>Invigilator Scanner</Text>
            <Text style={styles.subtitle}>Welcome, {invigilator.fullName}</Text>
            {invigilator.assignedHallId && (
              <Text style={styles.hallBadge}>
                Assigned hall: {invigilator.assignedHallBuildingName} · {invigilator.assignedHallRoomNumber}
              </Text>
            )}
          </View>
        </View>
        <TouchableOpacity style={styles.signOutButton} onPress={() => signOut()}>
          <Text style={styles.signOutText}>Sign out</Text>
        </TouchableOpacity>
      </View>

      {!invigilator.assignedHallId ? (
        <View style={styles.placeholder}>
          <Text style={styles.placeholderText}>
            No hall assigned yet. Ask your admin to assign you to a hall (Invigilators page) before you can scan.
          </Text>
        </View>
      ) : activeSession ? (
        <View style={styles.card}>
          <Text style={styles.h2}>{activeSession.exam.courseCode}</Text>
          <Text style={styles.subtitle}>{activeSession.exam.courseTitle}</Text>
          <Text style={styles.mono}>
            {activeSession.hallBuildingName} · {activeSession.hallRoomNumber}
          </Text>
          <View style={styles.readyBadge}>
            <Text style={styles.readyText}>Roster ready — {activeSession.rosterCount} students cached</Text>
          </View>

          <TouchableOpacity style={styles.primaryButton} onPress={() => router.push("/scanner")}>
            <Text style={styles.primaryButtonText}>Start scanning</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.secondaryButton} onPress={() => router.push("/search")}>
            <Text style={styles.secondaryButtonText}>Manual roll-number search</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.secondaryButton} onPress={() => router.push("/summary")}>
            <Text style={styles.secondaryButtonText}>Session summary</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.linkButton} onPress={endSession}>
            <Text style={styles.linkText}>Pick a different exam</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <View style={styles.card}>
          <Text style={styles.h2}>Select today&apos;s exam</Text>
          {presyncError && (
            <View style={styles.errorBox}>
              <Text style={styles.errorText}>{presyncError}</Text>
            </View>
          )}
          {examsError && (
            <View style={styles.errorBox}>
              <Text style={styles.errorText}>{examsError}</Text>
            </View>
          )}
          {presyncing ? (
            <View style={styles.loadingRow}>
              <ActivityIndicator color={Colors.accent} />
              <Text style={styles.subtitle}>Downloading roster and photos…</Text>
            </View>
          ) : exams === null ? (
            <ActivityIndicator color={Colors.accent} />
          ) : exams.length === 0 ? (
            <Text style={styles.subtitle}>No exams mapped to your hall yet.</Text>
          ) : (
            exams.map((exam) => (
              <TouchableOpacity key={exam.id} style={styles.examRow} onPress={() => startSession(exam)}>
                <View>
                  <Text style={styles.examCode}>{exam.courseCode}</Text>
                  <Text style={styles.subtitle}>{exam.courseTitle}</Text>
                  <Text style={styles.caption}>
                    {exam.examDate} · {exam.startTime}
                  </Text>
                </View>
              </TouchableOpacity>
            ))
          )}
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: Colors.surface, paddingHorizontal: 20 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 20,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  title: { fontSize: 18, fontWeight: "700", color: Colors.ink },
  h2: { fontSize: 16, fontWeight: "700", color: Colors.ink, marginBottom: 12 },
  subtitle: { marginTop: 2, fontSize: 13, color: Colors.slate },
  hallBadge: { marginTop: 2, fontSize: 12, fontWeight: "600", color: Colors.accent },
  caption: { marginTop: 2, fontSize: 12, color: Colors.slate },
  mono: { marginTop: 8, fontSize: 14, fontWeight: "500", color: Colors.charcoal },
  signOutButton: {
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  signOutText: { fontSize: 13, fontWeight: "600", color: Colors.charcoal },
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
  placeholderText: { textAlign: "center", fontSize: 14, color: Colors.slate },
  card: {
    marginTop: 20,
    backgroundColor: Colors.white,
    borderRadius: Radius,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 20,
  },
  examRow: {
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  examCode: { fontSize: 15, fontWeight: "600", color: Colors.ink },
  readyBadge: {
    marginTop: 16,
    backgroundColor: Colors.verifiedTint,
    borderRadius: Radius,
    paddingVertical: 8,
    paddingHorizontal: 12,
    alignSelf: "flex-start",
  },
  readyText: { fontSize: 12, fontWeight: "600", color: Colors.verified },
  loadingRow: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 12 },
  errorBox: { backgroundColor: Colors.alertTint, borderRadius: Radius, padding: 12, marginBottom: 12 },
  errorText: { color: Colors.alert, fontSize: 13 },
  primaryButton: {
    marginTop: 20,
    backgroundColor: Colors.accent,
    borderRadius: Radius,
    paddingVertical: 14,
    alignItems: "center",
  },
  primaryButtonText: { color: Colors.white, fontSize: 15, fontWeight: "600" },
  secondaryButton: {
    marginTop: 10,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius,
    paddingVertical: 12,
    alignItems: "center",
  },
  secondaryButtonText: { color: Colors.charcoal, fontSize: 14, fontWeight: "600" },
  linkButton: { marginTop: 14, alignItems: "center" },
  linkText: { color: Colors.accent, fontSize: 13, fontWeight: "600" },
});
