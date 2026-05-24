import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Platform,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import * as SecureStore from "expo-secure-store";

const PATTERNS_READING_DETAIL_URL = "https://thoughtclarity-api.onrender.com/patterns/readings";
const USER_ID_STORAGE_KEY = "return_anonymous_user_id";

type SavedPatternsReading = {
  id: string;
  userId: string;
  type: string;
  title: string;
  summary: string;
  reading: string;
  patternsSnapshot?: {
    totalSavedItems?: number;
    byType?: Record<string, number>;
  };
  createdAt: string;
  updatedAt?: string;
  createdAtMs?: number;
  updatedAtMs?: number;
};

type PatternsReadingDetailResponse = {
  savedReading?: SavedPatternsReading;
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

function formatDate(dateString?: string) {
  if (!dateString) return "";

  const date = new Date(dateString);

  if (Number.isNaN(date.getTime())) return "";

  return date.toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
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

export default function PatternsReadingDetailScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ id?: string }>();
  const readingId = typeof params.id === "string" ? params.id : "";

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState("");
  const [savedReading, setSavedReading] = useState<SavedPatternsReading | null>(null);

  const fetchReadingDetail = useCallback(async (isRefresh = false) => {
    if (!readingId) {
      setError("Missing patterns reading id.");
      setLoading(false);
      return;
    }

    if (isRefresh) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }

    setError("");

    try {
      const userId = await getAnonymousUserId();

      const response = await fetch(
        `${PATTERNS_READING_DETAIL_URL}/${encodeURIComponent(readingId)}?userId=${encodeURIComponent(userId)}`
      );

      const result: PatternsReadingDetailResponse & { error?: string } = await response.json();

      if (!response.ok) {
        throw new Error(result?.error || "Failed to fetch patterns reading.");
      }

      setSavedReading(result?.savedReading || null);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to fetch patterns reading."
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [readingId]);

  useEffect(() => {
    fetchReadingDetail();
  }, [fetchReadingDetail]);

  const handleDelete = useCallback(async () => {
    if (!readingId || deleting) return;

    const runDelete = async () => {
      try {
        setDeleting(true);
        setError("");

        const userId = await getAnonymousUserId();

        const response = await fetch(
          `${PATTERNS_READING_DETAIL_URL}/${encodeURIComponent(readingId)}?userId=${encodeURIComponent(userId)}`,
          {
            method: "DELETE",
          }
        );

        const result = await response.json();

        if (!response.ok) {
          throw new Error(result?.error || "Failed to delete patterns reading.");
        }

        router.replace("/patterns-reading-history");
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Failed to delete patterns reading."
        );
      } finally {
        setDeleting(false);
      }
    };

    if (Platform.OS === "web") {
      const confirmed = window.confirm("Delete this saved pattern read?");
      if (!confirmed) return;
      await runDelete();
      return;
    }

    Alert.alert(
      "Delete saved read",
      "Delete this saved pattern read?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: () => {
            void runDelete();
          },
        },
      ]
    );
  }, [deleting, readingId, router]);

  const sections = parseReadingSections(savedReading?.reading || "");
  const totalSaved = savedReading?.patternsSnapshot?.totalSavedItems || 0;
  const clarityCount = savedReading?.patternsSnapshot?.byType?.clarity_session || 0;
  const talkCount = savedReading?.patternsSnapshot?.byType?.talk_insight || 0;

  return (
    <ScrollView
      contentContainerStyle={styles.container}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={() => fetchReadingDetail(true)}
        />
      }
    >
      <View style={styles.card}>
        <Text style={styles.eyebrow}>THE RETURN: RECLAIM PEACE</Text>
        <Text style={styles.title}>Saved Pattern Read</Text>
        <Text style={styles.subtitle}>
          Revisit a past connected read and compare how your signal changes over time.
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
            onPress={() => fetchReadingDetail(true)}
          >
            <Text style={styles.primaryButtonText}>Refresh</Text>
          </TouchableOpacity>
        </View>

        <TouchableOpacity
          style={[styles.deleteButton, deleting && styles.buttonDisabled]}
          onPress={handleDelete}
          disabled={deleting}
        >
          {deleting ? (
            <ActivityIndicator color="#FDE2E2" />
          ) : (
            <Text style={styles.deleteButtonText}>Delete This Saved Read</Text>
          )}
        </TouchableOpacity>

        {!!error && !loading && (
          <View style={styles.messageBox}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        )}

        {loading ? (
          <View style={styles.loadingBox}>
            <ActivityIndicator size="large" />
            <Text style={styles.loadingText}>Loading saved pattern read...</Text>
          </View>
        ) : !savedReading ? (
          <View style={styles.messageBox}>
            <Text style={styles.errorText}>Patterns reading not found.</Text>
          </View>
        ) : (
          <>
            <View style={styles.headerBox}>
              <View style={styles.headerTopRow}>
                <Text style={styles.readingTitle}>
                  {savedReading.title || "Patterns Read"}
                </Text>

                <View style={styles.typeBadge}>
                  <Text style={styles.typeBadgeText}>Patterns Read</Text>
                </View>
              </View>

              {!!savedReading.summary?.trim() && (
                <Text style={styles.readingSummary}>{savedReading.summary}</Text>
              )}

              <Text style={styles.readingMeta}>{formatDate(savedReading.createdAt)}</Text>
            </View>

            <View style={styles.statsRow}>
              <View style={styles.statPill}>
                <Text style={styles.statValue}>{totalSaved}</Text>
                <Text style={styles.statLabel}>Saved</Text>
              </View>

              <View style={styles.statPill}>
                <Text style={styles.statValue}>{clarityCount}</Text>
                <Text style={styles.statLabel}>Clarity</Text>
              </View>

              <View style={styles.statPill}>
                <Text style={styles.statValue}>{talkCount}</Text>
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
    marginBottom: 14,
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
  deleteButton: {
    backgroundColor: "#2A1418",
    borderWidth: 1,
    borderColor: "#7A2832",
    borderRadius: 16,
    paddingVertical: 16,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 18,
  },
  deleteButtonText: {
    color: "#FDE2E2",
    fontSize: 15,
    fontWeight: "800",
  },
  buttonDisabled: {
    opacity: 0.55,
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
    marginBottom: 18,
  },
  errorText: {
    color: "#FCA5A5",
    fontSize: 14,
    lineHeight: 22,
    textAlign: "center",
  },
  headerBox: {
    backgroundColor: "#0F131B",
    borderWidth: 1,
    borderColor: "#232938",
    borderRadius: 18,
    padding: 16,
    marginBottom: 14,
  },
  headerTopRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 12,
    marginBottom: 8,
  },
  readingTitle: {
    flex: 1,
    color: "#F5F7FB",
    fontSize: 22,
    fontWeight: "800",
    lineHeight: 30,
  },
  typeBadge: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderWidth: 1,
    backgroundColor: "#171D2B",
    borderColor: "#7C8BFF",
  },
  typeBadgeText: {
    color: "#E8ECF3",
    fontSize: 11,
    fontWeight: "800",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  readingSummary: {
    color: "#A8B0BD",
    fontSize: 15,
    lineHeight: 22,
    marginBottom: 10,
  },
  readingMeta: {
    color: "#8E98AA",
    fontSize: 13,
    lineHeight: 18,
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