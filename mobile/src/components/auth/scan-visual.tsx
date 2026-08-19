import { useEffect } from "react";
import { StyleSheet, View } from "react-native";
import Svg, { Circle, Path, Rect } from "react-native-svg";
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from "react-native-reanimated";

const WIDTH = 220;
const HEIGHT = 150;
const CARD_TOP = 12;
const CARD_BOTTOM = 122;
const CARD_LEFT = 20;
const CARD_WIDTH = 180;

// Same mechanic as the web login screens' scan visual: a beam sweeps down
// a barcode pass, then a verified checkmark resolves — what this app
// actually does at the hall door. Sweep-then-rest rhythm (scan → verify →
// pause), not a continuous bounce, so it reads as an event completing.
export function ScanVisual() {
  const beamY = useSharedValue(CARD_TOP + 6);
  const beamOpacity = useSharedValue(0);
  const checkScale = useSharedValue(0);
  const checkOpacity = useSharedValue(0);

  useEffect(() => {
    const sweepDuration = 1400;
    const pauseDuration = 1100;
    const easing = Easing.inOut(Easing.quad);

    beamY.value = withRepeat(
      withSequence(
        withTiming(CARD_TOP + 6, { duration: 0 }),
        withTiming(CARD_BOTTOM - 6, { duration: sweepDuration, easing }),
        withDelay(pauseDuration, withTiming(CARD_TOP + 6, { duration: 0 })),
      ),
      -1,
    );
    beamOpacity.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 150 }),
        withTiming(1, { duration: sweepDuration - 300 }),
        withTiming(0, { duration: 150 }),
        withDelay(pauseDuration, withTiming(0, { duration: 0 })),
      ),
      -1,
    );

    checkScale.value = withRepeat(
      withSequence(
        withDelay(sweepDuration, withTiming(1, { duration: 220, easing: Easing.out(Easing.back(1.6)) })),
        withTiming(1, { duration: pauseDuration - 500 }),
        withTiming(0, { duration: 220 }),
      ),
      -1,
    );
    checkOpacity.value = withRepeat(
      withSequence(
        withDelay(sweepDuration, withTiming(1, { duration: 180 })),
        withTiming(1, { duration: pauseDuration - 460 }),
        withTiming(0, { duration: 180 }),
      ),
      -1,
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const beamStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: beamY.value }],
    opacity: beamOpacity.value,
  }));
  const checkStyle = useAnimatedStyle(() => ({
    opacity: checkOpacity.value,
    transform: [{ scale: checkScale.value }],
  }));

  const barX = [0, 5, 9, 12, 17, 21, 24, 29, 34, 38, 43, 47, 52, 57, 61, 66, 71, 75, 80, 85, 89, 94, 99, 103];

  return (
    <View style={{ width: WIDTH, height: HEIGHT }}>
      <Svg width={WIDTH} height={HEIGHT} viewBox={`0 0 ${WIDTH} ${HEIGHT}`}>
        {/* Viewfinder corner brackets */}
        <Path d="M8 24 V13 a3 3 0 0 1 3-3 H22" stroke="white" strokeOpacity={0.3} strokeWidth={2} strokeLinecap="round" fill="none" />
        <Path d="M198 10 H209 a3 3 0 0 1 3 3 V24" stroke="white" strokeOpacity={0.3} strokeWidth={2} strokeLinecap="round" fill="none" />
        <Path d="M8 126 V137 a3 3 0 0 0 3 3 H22" stroke="white" strokeOpacity={0.3} strokeWidth={2} strokeLinecap="round" fill="none" />
        <Path d="M198 140 H209 a3 3 0 0 0 3-3 V126" stroke="white" strokeOpacity={0.3} strokeWidth={2} strokeLinecap="round" fill="none" />

        {/* Pass card */}
        <Rect x={CARD_LEFT} y={CARD_TOP} width={CARD_WIDTH} height={CARD_BOTTOM - CARD_TOP} rx={12} fill="white" fillOpacity={0.06} stroke="white" strokeOpacity={0.22} />

        {/* Photo + identity lines */}
        <Circle cx={46} cy={38} r={13} fill="white" fillOpacity={0.16} />
        <Rect x={68} y={32} width={62} height={5} rx={2.5} fill="white" fillOpacity={0.28} />
        <Rect x={68} y={42} width={44} height={5} rx={2.5} fill="white" fillOpacity={0.16} />

        {/* Barcode */}
        {barX.map((x, i) => (
          <Rect key={x} x={40 + x} y={66} width={i % 3 === 0 ? 3 : 1.5} height={26} fill="white" fillOpacity={0.55} />
        ))}
      </Svg>

      <Animated.View style={[styles.beam, beamStyle]} />

      <Animated.View style={[styles.checkBadge, checkStyle]}>
        <Svg width={14} height={14} viewBox="0 0 14 14">
          <Path d="M2 7.5 L5.5 11 L12 3" stroke="white" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" fill="none" />
        </Svg>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  beam: {
    position: "absolute",
    left: CARD_LEFT,
    top: 0,
    width: CARD_WIDTH,
    height: 3,
    borderRadius: 2,
    backgroundColor: "#8FD3FF",
    shadowColor: "#8FD3FF",
    shadowOpacity: 0.9,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 0 },
  },
  checkBadge: {
    position: "absolute",
    left: CARD_LEFT + CARD_WIDTH - 42,
    top: CARD_BOTTOM - 42,
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: "#1E8E5A",
    alignItems: "center",
    justifyContent: "center",
  },
});
