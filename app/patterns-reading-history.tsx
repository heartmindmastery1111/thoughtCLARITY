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
import { useRouter } from "expo-router";
import * as SecureStore from "expo-secure-store";

const PATTERNS_READINGS_URL = "https://thoughtclarity-api.onrender.com/patterns/readings";
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

type PatternsReadingsResponse = {
  readings?: SavedPatternsReading[];
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

export default function PatternsReadingHistoryScreen() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [deletingId, setDeletingId] = useState("");
  const [error, setError] = useState("");
  const [readings, setReadings] = useState<SavedPatternsReading[]>([]);

  const fetchHistory = useCallback(async (isRefresh = false) => {
    if (isRefresh) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }

    setError("");

    try {
      const userId = await getAnonymousUserId();

      const response = await fetch(
        `${PATTERNS_READINGS_URL}?userId=${encodeURIComponent(userId)}`
      );

      const result: PatternsReadingsResponse & { error?: string } = await response.json();

      if (!response.ok) {
        throw new Error(result?.error || "Failed to fetch patterns read history.");
      }

      setReadings(Array.isArray(result?.readings) ? result.readings : []);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to fetch patterns read history."
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchHistory();
  }, [fetchHistory]);

  const handleDelete = useCallback(
    async (id: string) => {
      if (!id || deletingId) return;

      const runDelete = async () => {
        try {
          setDeletingId(id);
          setError("");

          const userId = await getAnonymousUserId();

          const response = await fetch(
            `${PATTERNS_READINGS_URL}/${encodeURIComponent(id)}?userId=${encodeURIComponent(userId)}`,
            {
              method: "DELETE",
            }
          );

          const result = await response.json();

          if (!response.ok) {
            throw new Error(result?.error || "Failed to delete patterns reading.");
          }

          setReadings((prev) => prev.filter((item) => item.id !== id));
        } catch (err) {
          setError(
            err instanceof Error ? err.message : "Failed to delete patterns reading."
          );
        } finally {
          setDeletingId("");
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
    },
    [deletingId]
  );

  return (
    <ScrollView
      contentContainerStyle={styles.container}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={() => fetchHistory(true)}
        />
      }
    >
      <View style={styles.card}>
        <Text style={styles.eyebrow}>THE RETURN: RECLAIM PEACE</Text>
        <Text style={styles.title}>Past Pattern Reads</Text>
        <Text style={styles.subtitle}>
          Revisit your saved pattern readings and notice how the signal changes over time.
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
            onPress={() => fetchHistory(true)}
          >
            <Text style={styles.primaryButtonText}>Refresh History</Text>
          </TouchableOpacity>
        </View>

        {!!error && !loading && (
          <View style={styles.messageBox}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        )}

        {loading ? (
          <View style={styles.loadingBox}>
            <ActivityIndicator size="large" />
            <Text style={styles.loadingText}>Loading saved pattern reads...</Text>
          </View>
        ) : readings.length === 0 ? (
          <View style={styles.messageBox}>
            <Text style={styles.emptyTitle}>No saved pattern reads yet</Text>
            <Text style={styles.emptyText}>
              Save a patterns read first, then it will appear here.
            </Text>
          </View>
        ) : (
          <View style={styles.listWrap}>
            {readings.map((item) => {
              const totalSaved = item.patternsSnapshot?.totalSavedItems || 0;
              const clarityCount = item.patternsSnapshot?.byType?.clarity_session || 0;
              const talkCount = item.patternsSnapshot?.byType?.talk_insight || 0;
              const isDeleting = deletingId === item.id;

              return (
                <View key={item.id} style={styles.historyCard}>
                  <TouchableOpacity
                    activeOpacity={0.9}
                    onPress={() =>
                      router.push({
                        pathname: "/patterns-reading-detail",
                        params: { id: item.id },
                      })
                    }
                  >
                    <View style={styles.historyHeaderRow}>
                      <Text style={styles.historyTitle}>
                        {item.title || "Patterns Read"}
                      </Text>

                      <View style={styles.typeBadge}>
                        <Text style={styles.typeBadgeText}>Patterns Read</Text>
                      </View>
                    </View>

                    {!!item.summary?.trim() && (
                      <Text style={styles.historySummary}>{item.summary}</Text>
                    )}

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

                    <Text style={styles.historyMeta}>{formatDate(item.createdAt)}</Text>
                    <Text style={styles.tapHint}>Tap to open full read</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.deleteButton, isDeleting && styles.buttonDisabled]}
                    onPress={() => handleDelete(item.id)}
                    disabled={isDeleting}
                  >
                    {isDeleting ? (
                      <ActivityIndicator color="#FDE2E2" />
                    ) : (
                      <Text style={styles.deleteButtonText}>Delete</Text>
                    )}
                  </TouchableOpacity>
                </View>
              );
            })}
          </View>
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
    marginBottom: 18,
  },
  errorText: {
    color: "#FCA5A5",
    fontSize: 14,
    lineHeight: 22,
    textAlign: "center",
  },
  emptyTitle: {
    color: "#F5F7FB",
    fontSize: 20,
    fontWeight: "800",
    marginBottom: 8,
    textAlign: "center",
  },
  emptyText: {
    color: "#A8B0BD",
    fontSize: 15,
    lineHeight: 22,
    textAlign: "center",
  },
  listWrap: {
    gap: 14,
  },
  historyCard: {
    backgroundColor: "#0F131B",
    borderWidth: 1,
    borderColor: "#232938",
    borderRadius: 18,
    padding: 16,
  },
  historyHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 12,
    marginBottom: 8,
  },
  historyTitle: {
    flex: 1,
    color: "#F5F7FB",
    fontSize: 20,
    fontWeight: "800",
    lineHeight: 28,
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
  historySummary: {
    color: "#A8B0BD",
    fontSize: 15,
    lineHeight: 22,
    marginBottom: 12,
  },
  statsRow: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 12,
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
  historyMeta: {
    color: "#8E98AA",
    fontSize: 13,
    lineHeight: 18,
    marginBottom: 8,
  },
  tapHint: {
    color: "#7C8BFF",
    fontSize: 13,
    fontWeight: "700",
    marginBottom: 12,
  },
  deleteButton: {
    backgroundColor: "#2A1418",
    borderWidth: 1,
    borderColor: "#7A2832",
    borderRadius: 14,
    paddingVertical: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  deleteButtonText: {
    color: "#FDE2E2",
    fontSize: 14,
    fontWeight: "800",
  },
  buttonDisabled: {
    opacity: 0.55,
  },
});