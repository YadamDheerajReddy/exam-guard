import "react-native-url-polyfill/auto";
import { AppState } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!;

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});

// autoRefreshToken alone isn't enough on React Native: the refresh timer
// only runs while the app is foregrounded, and nothing restarts it when the
// app comes back. Without this an invigilator who locks their phone between
// halls returns to an expired access token, and every /api/invigilator/*
// call 401s — which surfaced as a bare "Couldn't load exams."
// Required setup per supabase-js's React Native guidance.
AppState.addEventListener("change", (state) => {
  if (state === "active") {
    void supabase.auth.startAutoRefresh();
  } else {
    void supabase.auth.stopAutoRefresh();
  }
});
