import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Platform,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useRouter } from "expo-router";
import * as SecureStore from "expo-secure-store";

const READ_PATTERNS_URL = "https://thoughtclarity-api.onrender.com/patterns/read";
const USER_ID_STORAGE_KEY = "return_anonymous_user_id";

type PatternsReadResponse = {
  reading?: string;
  patterns?: {
    totalSavedItems?: number;
    byType?: Record<string, number>;
  };
};

async function getStoredValue(key: string) {
  if (Platform.OS === "web") {
    return typeof window !== "undefined" ? localStorage.getItem(key) : null;
  }

  return SecureStore.getItemAsync(key);
}

async function setStoredValue(key: string, value: string) {
  if (Platform.OS === "web") {
    if (typeof window !== "undefined") {
      localStorage.setItem(key, value);
    }
    return;
  }

  await SecureStore.setItemAsync(key, value);
}

async function getAnonymousUserId() {
  const existing = await getStoredValue(USER_ID_STORAGE_KEY);
  if (existing) return existing;

  const newId = `anon_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
  await setStoredValue(USER_ID_STORAGE_KEY, newId);
  return newId;
}

function parseReadingSections(reading: string) {
  const lines = String(reading || "").replace(/\r\n/g, "\n").split("\n");
  const sections: Record<string, string> = {};
  let currentHeading = "";

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) continue;

    if (
      [
        "HEADLINE",
        "WHAT KEEPS REPEATING",
        "WHAT IT SEEMS TO LINK TO",
        "WHERE TO WATCH CLOSELY",
        "ONE CLEAN INSIGHT",
      ].includes(line)
    ) {
      currentHeading = line;
      if (!sections[currentHeading]) sections[currentHeading] = "";
      continue;
    }

    if (currentHeading) {
      sections[currentHeading] = `${sections[currentHeading]} ${line}`.trim();
    }
  }

  return sections;
}

export default function PatternsReadingScreen() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [data, setData] = useState<PatternsReadResponse | null>(null);

  const fetchReading = useCallback(async (isRefresh = false) => {
    if (isRefresh) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }

    setError("");

    try {
      const userId = await getAnonymousUserId();

      const response = await fetch(READ_PATTERNS_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ userId }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result?.error || "Failed to read patterns.");
      }

      setData(result || null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to read patterns.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchReading();
  }, [fetchReading]);

  const sections = parseReadingSections(data?.reading || "");

  return (
    <ScrollView
      contentContainerStyle={styles.container}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={() => fetchReading(true)}
        />
      }
    >
      <View style={styles.card}>
        <Text style={styles.eyebrow}>THE RETURN: RECLAIM PEACE</Text>
        <Text style={styles.title}>Read My Patterns</Text>
        <Text style={styles.subtitle}>
          A connected read of what has been repeating across your saved sessions.
        </Text>

        <View style={styles.buttonRow}>
          <TouchableOpacity
            style={styles.secondaryButton}
            onPress={() => router.back()}
          >
            <Text style={styles.secondaryButtonText}>Back</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.primaryButton}
            onPress={() => fetchReading(true)}
          >
            <Text style={styles.primaryButtonText}>Refresh Read</Text>
          </TouchableOpacity>
        </View>

        {loading ? (
          <View style={styles.loadingBox}>
            <ActivityIndicator size="large" />
            <Text style={styles.loadingText}>Reading your patterns...</Text>
          </View>
        ) : error ? (
          <View style={styles.messageBox}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : !data?.reading ? (
          <View style={styles.messageBox}>
            <Text style={styles.errorText}>No patterns reading returned.</Text>
          </View>
        ) : (
          <>
            <View style={styles.statsRow}>
              <View style={styles.statPill}>
                <Text style={styles.statValue}>{data?.patterns?.totalSavedItems || 0}</Text>
                <Text style={styles.statLabel}>Saved</Text>
              </View>

              <View style={styles.statPill}>
                <Text style={styles.statValue}>{data?.patterns?.byType?.clarity_session || 0}</Text>
                <Text style={styles.statLabel}>Clarity</Text>
              </View>

              <View style={styles.statPill}>
                <Text style={styles.statValue}>{data?.patterns?.byType?.talk_insight || 0}</Text>
                <Text style={styles.statLabel}>Talk</Text>
              </View>
            </View>

            {!!sections.HEADLINE && (
              <View style={styles.headlineBox}>
                <Text style={styles.headlineLabel}>Headline</Text>
                <Text style={styles.headlineText}>{sections.HEADLINE}</Text>
              </View>
            )}

            {!!sections["WHAT KEEPS REPEATING"] && (
              <View style={styles.sectionBox}>
                <Text style={styles.sectionLabel}>What keeps repeating</Text>
                <Text style={styles.sectionText}>{sections["WHAT KEEPS REPEATING"]}</Text>
              </View>
            )}

            {!!sections["WHAT IT SEEMS TO LINK TO"] && (
              <View style={styles.sectionBox}>
                <Text style={styles.sectionLabel}>What it seems to link to</Text>
                <Text style={styles.sectionText}>{sections["WHAT IT SEEMS TO LINK TO"]}</Text>
              </View>
            )}

            {!!sections["WHERE TO WATCH CLOSELY"] && (
              <View style={styles.sectionBox}>
                <Text style={styles.sectionLabel}>Where to watch closely</Text>
                <Text style={styles.sectionText}>{sections["WHERE TO WATCH CLOSELY"]}</Text>
              </View>
            )}

            {!!sections["ONE CLEAN INSIGHT"] && (
              <View style={styles.insightBox}>
                <Text style={styles.insightLabel}>One clean insight</Text>
                <Text style={styles.insightText}>{sections["ONE CLEAN INSIGHT"]}</Text>
              </View>
            )}
          </>
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    backgroundColor: "#0B0D12",
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  card: {
    width: "100%",
    maxWidth: 760,
    backgroundColor: "#151922",
    borderRadius: 28,
    padding: 20,
    shadowColor: "#000",
    shadowOpacity: 0.25,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 10 },
    elevation: 10,
  },
  eyebrow: {
    color: "#7C8BFF",
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 1.4,
    marginBottom: 10,
  },
  title: {
    color: "#F5F7FB",
    fontSize: 28,
    fontWeight: "800",
    marginBottom: 10,
  },
  subtitle: {
    color: "#A8B0BD",
    fontSize: 15,
    lineHeight: 22,
    marginBottom: 18,
  },
  buttonRow: {
    flexDirection: "row",
    gap: 12,
    marginBottom: 18,
  },
  primaryButton: {
    flex: 1,
    backgroundColor: "#7C8BFF",
    borderRadius: 16,
    paddingVertical: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  primaryButtonText: {
    color: "#0B0D12",
    fontSize: 16,
    fontWeight: "800",
    textAlign: "center",
    paddingHorizontal: 12,
  },
  secondaryButton: {
    width: 120,
    backgroundColor: "#0F131B",
    borderWidth: 1,
    borderColor: "#232938",
    borderRadius: 16,
    paddingVertical: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  secondaryButtonText: {
    color: "#E8ECF3",
    fontSize: 15,
    fontWeight: "700",
  },
  loadingBox: {
    minHeight: 240,
    alignItems: "center",
    justifyContent: "center",
    gap: 14,
  },
  loadingText: {
    color: "#A8B0BD",
    fontSize: 14,
  },
  messageBox: {
    backgroundColor: "#0F131B",
    borderWidth: 1,
    borderColor: "#232938",
    borderRadius: 18,
    padding: 18,
  },
  errorText: {
    color: "#FCA5A5",
    fontSize: 14,
    lineHeight: 22,
    textAlign: "center",
  },
  statsRow: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 14,
  },
  statPill: {
    flex: 1,
    backgroundColor: "#151922",
    borderWidth: 1,
    borderColor: "#2A3247",
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 10,
    alignItems: "center",
  },
  statValue: {
    color: "#F5F7FB",
    fontSize: 20,
    fontWeight: "800",
    marginBottom: 4,
  },
  statLabel: {
    color: "#A8B0BD",
    fontSize: 12,
    fontWeight: "700",
    textAlign: "center",
  },
  headlineBox: {
    backgroundColor: "#171D2B",
    borderWidth: 1,
    borderColor: "#7C8BFF",
    borderRadius: 18,
    padding: 16,
    marginBottom: 14,
  },
  headlineLabel: {
    color: "#AEB8FF",
    fontSize: 12,
    fontWeight: "800",
    textTransform: "uppercase",
    marginBottom: 8,
  },
  headlineText: {
    color: "#F5F7FB",
    fontSize: 20,
    fontWeight: "800",
    lineHeight: 28,
  },
  sectionBox: {
    backgroundColor: "#0F131B",
    borderWidth: 1,
    borderColor: "#232938",
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
  },
  sectionLabel: {
    color: "#7C8BFF",
    fontSize: 12,
    fontWeight: "800",
    textTransform: "uppercase",
    marginBottom: 8,
  },
  sectionText: {
    color: "#E8ECF3",
    fontSize: 15,
    lineHeight: 24,
  },
  insightBox: {
    backgroundColor: "#171D2B",
    borderWidth: 1,
    borderColor: "#7C8BFF",
    borderRadius: 18,
    padding: 16,
    marginTop: 4,
  },
  insightLabel: {
    color: "#AEB8FF",
    fontSize: 12,
    fontWeight: "800",
    textTransform: "uppercase",
    marginBottom: 8,
  },
  insightText: {
    color: "#F5F7FB",
    fontSize: 18,
    fontWeight: "800",
    lineHeight: 26,
  },
});
