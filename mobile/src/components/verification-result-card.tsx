import { useState } from "react";
import { Image, Modal, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { Colors, Radius } from "@/constants/theme";
import type { ScanOutcome } from "@/lib/scan-decision";
import type { ExamSummary } from "@/lib/api";

type Props = {
  outcome: ScanOutcome;
  exam: ExamSummary;
  // Present only for the VERIFIED case — every other outcome is
  // informational and gets recorded automatically without a tap.
  onConfirm?: () => void;
  onDismiss: () => void;
};

export function VerificationResultCard({ outcome, exam, onConfirm, onDismiss }: Props) {
  if (outcome.kind === "NOT_FOUND") {
    return (
      <View style={[styles.overlay, styles.neutralBg]}>
        <View style={styles.card}>
          <Text style={styles.chip}>NOT RECOGNIZED</Text>
          <Text style={styles.message}>This barcode doesn&apos;t match anyone in this exam&apos;s roster.</Text>
          <Text style={styles.hint}>If this is a mistake, use Manual Search.</Text>
          <DismissButton onPress={onDismiss} />
        </View>
      </View>
    );
  }

  if (outcome.kind === "EXPIRED") {
    return (
      <View style={[styles.overlay, styles.pendingBg]}>
        <View style={styles.card}>
          <Text style={[styles.chip, styles.pendingChip]}>EXPIRED</Text>
          <Text style={styles.message}>This barcode expired before it was read. Ask the student to reopen their pass and scan again.</Text>
          <DismissButton onPress={onDismiss} />
        </View>
      </View>
    );
  }

  const { roster } = outcome;

  if (outcome.kind === "VERIFIED") {
    return (
      <View style={[styles.overlay, styles.verifiedBg]}>
        <View style={styles.card}>
          <Text style={[styles.chip, styles.verifiedChip]}>VERIFIED</Text>
          <CandidateInfo roster={roster} />
          <ExamInfo exam={exam} />
          <View style={styles.placeRow}>
            <View style={styles.placeBox}>
              <Text style={styles.placeLabel}>Hall</Text>
              <Text style={styles.placeValue}>
                {roster.hall_building_name} · {roster.hall_room_number}
              </Text>
            </View>
            <View style={styles.placeBox}>
              <Text style={styles.placeLabel}>Seat</Text>
              <Text style={styles.placeValue}>{roster.seat_number}</Text>
            </View>
          </View>
          <TouchableOpacity style={styles.verifyButton} onPress={() => onConfirm?.()}>
            <Text style={styles.verifyButtonText}>Verify</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  if (outcome.kind === "WRONG_HALL") {
    return (
      <View style={[styles.overlay, styles.alertBg]}>
        <View style={styles.card}>
          <Text style={[styles.chip, styles.alertChip]}>WRONG HALL</Text>
          <CandidateInfo roster={roster} />
          <ExamInfo exam={exam} />
          <View style={styles.redirectBox}>
            <Text style={styles.redirectLabel}>Correct hall &amp; seat</Text>
            <Text style={styles.redirectText}>
              {roster.hall_building_name} · {roster.hall_room_number} — Seat {roster.seat_number}
            </Text>
          </View>
          <DismissButton onPress={onDismiss} />
        </View>
      </View>
    );
  }

  // ALREADY_USED
  return (
    <View style={[styles.overlay, styles.pendingBg]}>
      <View style={styles.card}>
        <Text style={[styles.chip, styles.pendingChip]}>ALREADY VERIFIED</Text>
        <CandidateInfo roster={roster} />
        <ExamInfo exam={exam} />
        <View style={styles.placeRow}>
          <View style={styles.placeBox}>
            <Text style={styles.placeLabel}>Hall</Text>
            <Text style={styles.placeValue}>
              {roster.hall_building_name} · {roster.hall_room_number}
            </Text>
          </View>
          <View style={styles.placeBox}>
            <Text style={styles.placeLabel}>Seat</Text>
            <Text style={styles.placeValue}>{roster.seat_number}</Text>
          </View>
        </View>
        <Text style={styles.message}>
          Already verified at {outcome.usedAt ? new Date(outcome.usedAt).toLocaleTimeString() : "an earlier time"}.
          If this is a mistake, use Manual Search.
        </Text>
        <DismissButton onPress={onDismiss} />
      </View>
    </View>
  );
}

function CandidateInfo({
  roster,
}: {
  roster: { photo_url: string | null; full_name: string; roll_number: string; department: string };
}) {
  const [enlarged, setEnlarged] = useState(false);

  return (
    <View style={styles.candidateRow}>
      {roster.photo_url ? (
        <TouchableOpacity onPress={() => setEnlarged(true)}>
          <Image source={{ uri: roster.photo_url }} style={styles.photo} />
        </TouchableOpacity>
      ) : (
        <View style={[styles.photo, styles.photoPlaceholder]} />
      )}
      <View style={styles.candidateText}>
        <Text style={styles.name}>{roster.full_name}</Text>
        <Text style={styles.roll}>{roster.roll_number}</Text>
        <Text style={styles.department}>{roster.department}</Text>
      </View>

      {roster.photo_url && (
        <Modal visible={enlarged} transparent animationType="fade" onRequestClose={() => setEnlarged(false)}>
          <TouchableOpacity
            style={styles.enlargedBackdrop}
            activeOpacity={1}
            onPress={() => setEnlarged(false)}
          >
            <Image source={{ uri: roster.photo_url }} style={styles.enlargedPhoto} resizeMode="contain" />
            <Text style={styles.enlargedHint}>Tap anywhere to close</Text>
          </TouchableOpacity>
        </Modal>
      )}
    </View>
  );
}

function ExamInfo({ exam }: { exam: ExamSummary }) {
  return (
    <View style={styles.examBox}>
      <Text style={styles.examCourse}>
        {exam.courseCode} · {exam.courseTitle}
      </Text>
      <Text style={styles.examTime}>
        {exam.examDate} · {exam.startTime}–{exam.endTime}
      </Text>
    </View>
  );
}

function DismissButton({ onPress }: { onPress: () => void }) {
  return (
    <TouchableOpacity style={styles.dismissButton} onPress={onPress}>
      <Text style={styles.dismissButtonText}>Continue scanning</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  verifiedBg: { backgroundColor: "rgba(30,142,90,0.94)" },
  alertBg: { backgroundColor: "rgba(217,48,37,0.94)" },
  pendingBg: { backgroundColor: "rgba(199,119,0,0.94)" },
  neutralBg: { backgroundColor: "rgba(31,36,48,0.94)" },
  card: {
    width: "100%",
    backgroundColor: Colors.white,
    borderRadius: Radius,
    padding: 24,
    alignItems: "center",
  },
  chip: {
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 0.6,
    textTransform: "uppercase",
    color: Colors.charcoal,
    backgroundColor: Colors.inactiveTint,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 4,
  },
  verifiedChip: { color: Colors.verified, backgroundColor: Colors.verifiedTint },
  alertChip: { color: Colors.alert, backgroundColor: Colors.alertTint },
  pendingChip: { color: Colors.pending, backgroundColor: Colors.pendingTint },
  candidateRow: { flexDirection: "row", alignItems: "center", gap: 14, marginTop: 16, alignSelf: "stretch" },
  photo: { width: 64, height: 64, borderRadius: Radius },
  photoPlaceholder: { backgroundColor: Colors.surface },
  candidateText: { flex: 1 },
  name: { fontSize: 17, fontWeight: "600", color: Colors.ink },
  roll: { marginTop: 2, fontSize: 14, fontWeight: "500", color: Colors.charcoal },
  department: { marginTop: 2, fontSize: 13, color: Colors.slate },
  examBox: {
    marginTop: 14,
    alignSelf: "stretch",
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    paddingTop: 12,
  },
  examCourse: { fontSize: 14, fontWeight: "600", color: Colors.charcoal },
  examTime: { marginTop: 2, fontSize: 12, color: Colors.slate },
  placeRow: { flexDirection: "row", gap: 10, marginTop: 14, alignSelf: "stretch" },
  placeBox: {
    flex: 1,
    backgroundColor: Colors.surface,
    borderRadius: Radius,
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  placeLabel: {
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 0.4,
    textTransform: "uppercase",
    color: Colors.slate,
  },
  placeValue: { marginTop: 2, fontSize: 16, fontWeight: "800", color: Colors.ink },
  message: { marginTop: 16, fontSize: 14, color: Colors.charcoal, textAlign: "center", lineHeight: 20 },
  hint: { marginTop: 8, fontSize: 13, color: Colors.slate, textAlign: "center" },
  redirectBox: {
    marginTop: 14,
    backgroundColor: Colors.alertTint,
    borderRadius: Radius,
    paddingVertical: 10,
    paddingHorizontal: 14,
    alignSelf: "stretch",
  },
  redirectLabel: {
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 0.4,
    textTransform: "uppercase",
    color: Colors.alert,
    textAlign: "center",
  },
  redirectText: { marginTop: 2, color: Colors.alert, fontSize: 16, fontWeight: "700", textAlign: "center" },
  verifyButton: {
    marginTop: 20,
    backgroundColor: Colors.verified,
    borderRadius: Radius,
    paddingVertical: 14,
    alignSelf: "stretch",
    alignItems: "center",
  },
  verifyButtonText: { color: Colors.white, fontSize: 16, fontWeight: "700" },
  dismissButton: { marginTop: 20, paddingVertical: 10, alignSelf: "stretch", alignItems: "center" },
  dismissButtonText: { color: Colors.charcoal, fontSize: 14, fontWeight: "600" },
  enlargedBackdrop: {
    flex: 1,
    backgroundColor: "rgba(16,19,26,0.95)",
    alignItems: "center",
    justifyContent: "center",
    gap: 16,
  },
  enlargedPhoto: { width: "88%", height: "70%" },
  enlargedHint: { color: Colors.white, fontSize: 13, fontWeight: "600" },
});
