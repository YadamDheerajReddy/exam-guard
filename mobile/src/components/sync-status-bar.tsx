import { useEffect, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import NetInfo from "@react-native-community/netinfo";
import { useScanSession } from "@/context/scan-session-context";
import { Colors } from "@/constants/theme";

// Persistent, unobtrusive sync-state indicator shown on every invigilator
// screen (UI/UX Brief §5) — invigilators should never have to wonder
// whether a verification "counted."
export function SyncStatusBar() {
  const { pendingSyncCount } = useScanSession();
  const [isOnline, setIsOnline] = useState(true);

  useEffect(() => {
    return NetInfo.addEventListener((state) => setIsOnline(state.isConnected ?? true));
  }, []);

  const offline = !isOnline;
  const pending = isOnline && pendingSyncCount > 0;
  const label = offline ? "Offline mode" : pending ? `${pendingSyncCount} pending sync` : "All synced";

  return (
    <View style={[styles.bar, offline ? styles.offline : pending ? styles.pending : styles.synced]}>
      <Text style={[styles.text, offline ? styles.offlineText : pending ? styles.pendingText : styles.syncedText]}>
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    paddingVertical: 6,
    alignItems: "center",
  },
  text: {
    fontSize: 11,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 0.4,
  },
  synced: { backgroundColor: Colors.verifiedTint },
  syncedText: { color: Colors.verified },
  pending: { backgroundColor: Colors.pendingTint },
  pendingText: { color: Colors.pending },
  offline: { backgroundColor: Colors.inactiveTint },
  offlineText: { color: Colors.inactive },
});
