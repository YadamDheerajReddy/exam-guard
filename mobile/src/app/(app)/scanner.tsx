import { useRef, useState } from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { CameraView, useCameraPermissions, type BarcodeScanningResult } from "expo-camera";
import * as Haptics from "expo-haptics";
import { useRouter } from "expo-router";
import { useScanSession } from "@/context/scan-session-context";
import { SyncStatusBar } from "@/components/sync-status-bar";
import { VerificationResultCard } from "@/components/verification-result-card";
import { decideForToken, type ScanDecision } from "@/lib/scan-decision";
import { enqueueScan } from "@/lib/local-db";
import { drainQueueOnce } from "@/lib/sync-engine";
import { Colors, Radius } from "@/constants/theme";

export default function ScannerScreen() {
  const router = useRouter();
  const { session } = useScanSession();
  const [permission, requestPermission] = useCameraPermissions();
  const [pending, setPending] = useState<ScanDecision | null>(null);
  // The camera keeps re-detecting the same code every frame it's in view —
  // this ref blocks re-entry the instant the first frame is handled, well
  // before the pending-state re-render could do it.
  const lockedRef = useRef(false);

  if (!session) {
    router.replace("/");
    return null;
  }

  function handleBarcodeScanned(result: BarcodeScanningResult) {
    if (lockedRef.current) return;
    lockedRef.current = true;

    const decision = decideForToken(result.data, session!.hallId, session!.exam.id, session!.hallId);
    setPending(decision);

    const feedback =
      decision.outcome.kind === "VERIFIED"
        ? Haptics.NotificationFeedbackType.Success
        : decision.outcome.kind === "WRONG_HALL"
          ? Haptics.NotificationFeedbackType.Error
          : Haptics.NotificationFeedbackType.Warning;
    Haptics.notificationAsync(feedback);

    // Informational outcomes record themselves immediately — nothing for
    // the invigilator to confirm, unlike an actual admission decision.
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
    lockedRef.current = false;
  }

  if (!permission) return null;

  if (!permission.granted) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.permissionCard}>
          <Text style={styles.permissionText}>Camera access is needed to scan student barcodes.</Text>
          <TouchableOpacity style={styles.permissionButton} onPress={requestPermission}>
            <Text style={styles.permissionButtonText}>Grant camera access</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <View style={styles.container}>
      <CameraView
        style={StyleSheet.absoluteFillObject}
        facing="back"
        active={!pending}
        barcodeScannerSettings={{ barcodeTypes: ["qr"] }}
        onBarcodeScanned={handleBarcodeScanned}
      />
      <SafeAreaView style={styles.chrome} pointerEvents="box-none">
        <SyncStatusBar />
        <View style={styles.frame} pointerEvents="none" />
        <View style={styles.footer}>
          <Text style={styles.footerText}>
            {session.hallBuildingName} · {session.hallRoomNumber} — {session.exam.courseCode}
          </Text>
          <View style={styles.footerActions}>
            <TouchableOpacity style={styles.footerButton} onPress={() => router.push("/search")}>
              <Text style={styles.footerButtonText}>Manual search</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.footerButton} onPress={() => router.back()}>
              <Text style={styles.footerButtonText}>Back</Text>
            </TouchableOpacity>
          </View>
        </View>
      </SafeAreaView>

      {pending && (
        <VerificationResultCard
          outcome={pending.outcome}
          onConfirm={pending.outcome.kind === "VERIFIED" ? confirmVerified : undefined}
          onDismiss={dismiss}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "black" },
  chrome: { flex: 1, justifyContent: "space-between" },
  frame: {
    alignSelf: "center",
    marginTop: 60,
    width: 240,
    height: 240,
    borderRadius: Radius,
    borderWidth: 3,
    borderColor: "rgba(255,255,255,0.85)",
  },
  footer: {
    backgroundColor: "rgba(16,19,26,0.75)",
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 16,
    gap: 10,
  },
  footerText: { color: Colors.white, fontSize: 13, fontWeight: "600" },
  footerActions: { flexDirection: "row", gap: 10 },
  footerButton: {
    flex: 1,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.5)",
    borderRadius: Radius,
    paddingVertical: 10,
    alignItems: "center",
  },
  footerButtonText: { color: Colors.white, fontSize: 13, fontWeight: "600" },
  safeArea: { flex: 1, backgroundColor: Colors.surface, justifyContent: "center", paddingHorizontal: 24 },
  permissionCard: {
    backgroundColor: Colors.white,
    borderRadius: Radius,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 24,
    alignItems: "center",
    gap: 16,
  },
  permissionText: { fontSize: 14, color: Colors.charcoal, textAlign: "center" },
  permissionButton: { backgroundColor: Colors.accent, borderRadius: Radius, paddingVertical: 12, paddingHorizontal: 20 },
  permissionButtonText: { color: Colors.white, fontSize: 14, fontWeight: "600" },
});
