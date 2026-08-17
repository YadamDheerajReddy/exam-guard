import { Stack } from "expo-router";
import { ScanSessionProvider } from "@/context/scan-session-context";

export default function AppLayout() {
  return (
    <ScanSessionProvider>
      <Stack screenOptions={{ headerShown: false }} />
    </ScanSessionProvider>
  );
}
