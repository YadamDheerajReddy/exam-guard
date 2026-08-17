import { StyleSheet, Text, View } from "react-native";
import Svg, { Path } from "react-native-svg";
import { Colors } from "@/constants/theme";

const SHIELD_PATH =
  "M50 4 C 62 4 72 8 82 13 C 84 14 85 16 85 18 L 85 50 C 85 78 70 98 50 112 C 30 98 15 78 15 50 L 15 18 C 15 16 16 14 18 13 C 28 8 38 4 50 4 Z";
const CHECK_PATH = "M33 57 L45 69 L69 43";

// Shield-and-checkmark mark — "guard" + "verified". Deep Blue only, no
// status colors, matching web/src/components/logo.tsx.
function Mark({ size, inverted }: { size: number; inverted?: boolean }) {
  const shield = inverted ? "white" : Colors.accent;
  const check = inverted ? Colors.accent : "white";
  return (
    <Svg width={size} height={(size * 116) / 100} viewBox="0 0 100 116">
      <Path d={SHIELD_PATH} fill={shield} />
      <Path d={CHECK_PATH} stroke={check} strokeWidth={9} strokeLinecap="round" strokeLinejoin="round" fill="none" />
    </Svg>
  );
}

export function Logo({
  size = 28,
  withWordmark = true,
  inverted = false,
}: {
  size?: number;
  withWordmark?: boolean;
  inverted?: boolean;
}) {
  return (
    <View style={styles.row}>
      <Mark size={size} inverted={inverted} />
      {withWordmark && (
        <Text style={[styles.wordmark, { fontSize: size * 0.6, color: inverted ? "white" : Colors.ink }]}>
          Exam
          <Text style={{ color: inverted ? "white" : Colors.accent }}>Guard</Text>
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: 8 },
  wordmark: { fontWeight: "700" },
});
