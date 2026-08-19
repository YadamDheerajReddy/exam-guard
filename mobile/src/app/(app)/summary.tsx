import { useEffect, useState } from "react";
import { Image, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { useScanSession } from "@/context/scan-session-context";
import { SyncStatusBar } from "@/components/sync-status-bar";
import { getRosterForHall, getSessionSummary, type RosterRow } from "@/lib/local-db";
import { drainQueueOnce } from "@/lib/sync-engine";
import { Colors, Radius } from "@/constants/theme";

export default function SessionSummaryScreen() {
  const router = useRouter();
  const { session, pendingSyncCount, endSession } = useScanSession();
  const [counts, setCounts] = useState({ verified: 0, wrongHall: 0, flagged: 0 });
  const [roster, setRoster] = useState<RosterRow[]>([]);
  const [submitted, setSubmitted] = useState(false);
  const [presentOpen, setPresentOpen] = useState(false);
  const [absentOpen, setAbsentOpen] = useState(false);

  useEffect(() => {
    if (!session) return;
    setCounts(getSessionSummary(session.exam.id, session.hallId));
    // roster.used_at is the same column isAlreadyUsedLocally() treats as
    // authoritative elsewhere in the app — set from the server at pre-sync
    // time and kept current locally on every VERIFIED scan this device
    // makes (see local-db.ts enqueueScan) — so present/absent here matches
    // what a re-scan of either student would actually decide.
    setRoster(getRosterForHall(session.exam.id, session.hallId));
  }, [session, pendingSyncCount]);

  if (!session) {
    router.replace("/");
    return null;
  }

  const present = roster.filter((r) => r.used_at);
  const absent = roster.filter((r) => !r.used_at);
  const notYetSeen = Math.max(0, roster.length - counts.verified - counts.flagged);
  const allSynced = pendingSyncCount === 0;

  async function handleSubmit() {
    await drainQueueOnce();
    setSubmitted(true);
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <SyncStatusBar />
      <ScrollView contentContainerStyle={styles.scrollContent}>
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

        <RosterSection
          title="Present"
          count={present.length}
          open={presentOpen}
          onToggle={() => setPresentOpen((v) => !v)}
          accentColor={Colors.verified}
          rows={present}
          emptyText="No one checked in yet."
        />
        <RosterSection
          title="Absent"
          count={absent.length}
          open={absentOpen}
          onToggle={() => setAbsentOpen((v) => !v)}
          accentColor={Colors.alert}
          rows={absent}
          emptyText="Everyone on the roster has been seen."
        />

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
      </ScrollView>
    </SafeAreaView>
  );
}

function RosterSection({
  title,
  count,
  open,
  onToggle,
  accentColor,
  rows,
  emptyText,
}: {
  title: string;
  count: number;
  open: boolean;
  onToggle: () => void;
  accentColor: string;
  rows: RosterRow[];
  emptyText: string;
}) {
  return (
    <View style={styles.section}>
      <TouchableOpacity style={styles.sectionHeader} onPress={onToggle} activeOpacity={0.7}>
        <View style={styles.sectionHeaderLeft}>
          <View style={[styles.sectionDot, { backgroundColor: accentColor }]} />
          <Text style={styles.sectionTitle}>
            {title} ({count})
          </Text>
        </View>
        <Text style={styles.sectionChevron}>{open ? "▲" : "▼"}</Text>
      </TouchableOpacity>

      {open && (
        <View style={styles.sectionBody}>
          {rows.length === 0 ? (
            <Text style={styles.emptyText}>{emptyText}</Text>
          ) : (
            rows.map((row, i) => (
              <RosterRowItem key={row.mapping_id} row={row} isLast={i === rows.length - 1} />
            ))
          )}
        </View>
      )}
    </View>
  );
}

function RosterRowItem({ row, isLast }: { row: RosterRow; isLast: boolean }) {
  return (
    <View style={[styles.rosterRow, isLast && styles.rosterRowLast]}>
      {row.photo_url ? (
        <Image source={{ uri: row.photo_url }} style={styles.rosterPhoto} />
      ) : (
        <View style={[styles.rosterPhoto, styles.rosterPhotoPlaceholder]} />
      )}
      <View style={styles.rosterText}>
        <Text style={styles.rosterName}>{row.full_name}</Text>
        <Text style={styles.rosterMeta}>
          {row.roll_number} · {row.department} · Seat {row.seat_number}
        </Text>
        {row.used_at && (
          <Text style={styles.rosterTime}>Checked in {new Date(row.used_at).toLocaleTimeString()}</Text>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: Colors.surface },
  scrollContent: { paddingHorizontal: 20, paddingBottom: 32 },
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
  section: {
    marginTop: 16,
    backgroundColor: Colors.white,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius,
    overflow: "hidden",
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  sectionHeaderLeft: { flexDirection: "row", alignItems: "center", gap: 8 },
  sectionDot: { width: 8, height: 8, borderRadius: 4 },
  sectionTitle: { fontSize: 14, fontWeight: "700", color: Colors.ink },
  sectionChevron: { fontSize: 11, color: Colors.slate },
  sectionBody: { borderTopWidth: 1, borderTopColor: Colors.border },
  emptyText: { padding: 16, fontSize: 13, color: Colors.slate, textAlign: "center" },
  rosterRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  rosterRowLast: { borderBottomWidth: 0 },
  rosterPhoto: { width: 44, height: 44, borderRadius: Radius },
  rosterPhotoPlaceholder: { backgroundColor: Colors.surface },
  rosterText: { flex: 1, minWidth: 0 },
  rosterName: { fontSize: 14, fontWeight: "600", color: Colors.ink },
  rosterMeta: { marginTop: 1, fontSize: 12, color: Colors.slate },
  rosterTime: { marginTop: 1, fontSize: 11, fontWeight: "600", color: Colors.verified },
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
