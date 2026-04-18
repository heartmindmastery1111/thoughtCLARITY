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

const SESSIONS_URL = "https://thoughtclarity-api.onrender.com/sessions";
const USER_ID_STORAGE_KEY = "return_anonymous_user_id";

type SavedSession = {
  id: string;
  userId: string;
  type: string;
  title: string;
  summary: string;
  createdAt: string;
  updatedAt?: string;
  createdAtMs?: number;
  updatedAtMs?: number;
  input?: {
    question1?: string;
    question2?: string;
    question3?: string;
    question4?: string;
    question5?: string;
    question6?: string;
  };
  answers?: string[];
  output?: {
    reflection?: string;
    fact?: string;
    mindStory?: string;
    clarityAnchor?: string;
    reminder?: string;
    oneSmallAction?: string;
  };
  rawResult?: string;
  tags?: string[];
  patternMarkers?: string[];
  metadata?: Record<string, unknown>;
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

export default function LibraryScreen() {
  const router = useRouter();

  const [sessions, setSessions] = useState<SavedSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  const fetchSessions = useCallback(async (isRefresh = false) => {
    if (isRefresh) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }

    setError("");

    try {
      const userId = await getAnonymousUserId();

      const response = await fetch(
        `${SESSIONS_URL}?userId=${encodeURIComponent(userId)}`
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data?.error || "Failed to fetch saved sessions.");
      }

      setSessions(Array.isArray(data?.sessions) ? data.sessions : []);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to fetch saved sessions."
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchSessions();
  }, [fetchSessions]);

  return (
    <ScrollView
      contentContainerStyle={styles.container}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={() => fetchSessions(true)}
        />
      }
    >
      <View style={styles.card}>
        <Text style={styles.eyebrow}>THE RETURN: RECLAIM PEACE</Text>
        <Text style={styles.title}>Clarity Library</Text>
        <Text style={styles.subtitle}>
          Revisit your saved sessions and notice what has been repeating or landing clearly.
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
            onPress={() => fetchSessions(true)}
          >
            <Text style={styles.primaryButtonText}>Refresh</Text>
          </TouchableOpacity>
        </View>

        {loading ? (
          <View style={styles.loadingBox}>
            <ActivityIndicator size="large" />
            <Text style={styles.loadingText}>Loading saved sessions...</Text>
          </View>
        ) : error ? (
          <View style={styles.messageBox}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : sessions.length === 0 ? (
          <View style={styles.messageBox}>
            <Text style={styles.emptyTitle}>No saved sessions yet</Text>
            <Text style={styles.emptyText}>
              Complete a Clarity Session and tap Save Session. It will appear here.
            </Text>
          </View>
        ) : (
          <View style={styles.listWrap}>
            {sessions.map((session) => (
              <TouchableOpacity
                key={session.id}
                style={styles.sessionCard}
                activeOpacity={0.9}
                onPress={() =>
                  router.push({
                    pathname: "/session-detail",
                    params: { id: session.id },
                  })
                }
              >
                <Text style={styles.sessionTitle}>
                  {session.title || "Saved Clarity Session"}
                </Text>

                {!!session.summary?.trim() && (
                  <Text style={styles.sessionSummary}>{session.summary}</Text>
                )}

                {!!session.output?.clarityAnchor?.trim() && (
                  <View style={styles.anchorBox}>
                    <Text style={styles.anchorLabel}>Clarity Anchor</Text>
                    <Text style={styles.anchorText}>
                      {session.output.clarityAnchor}
                    </Text>
                  </View>
                )}

                <Text style={styles.sessionMeta}>
                  {formatDate(session.createdAt)}
                </Text>

                <Text style={styles.tapHint}>Tap to open full session</Text>
              </TouchableOpacity>
            ))}
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
    minHeight: 220,
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
  sessionCard: {
    backgroundColor: "#0F131B",
    borderWidth: 1,
    borderColor: "#232938",
    borderRadius: 18,
    padding: 16,
  },
  sessionTitle: {
    color: "#F5F7FB",
    fontSize: 20,
    fontWeight: "800",
    lineHeight: 28,
    marginBottom: 8,
  },
  sessionSummary: {
    color: "#A8B0BD",
    fontSize: 15,
    lineHeight: 22,
    marginBottom: 12,
  },
  anchorBox: {
    backgroundColor: "#171D2B",
    borderWidth: 1,
    borderColor: "#7C8BFF",
    borderRadius: 16,
    paddingVertical: 14,
    paddingHorizontal: 14,
    marginBottom: 12,
  },
  anchorLabel: {
    color: "#AEB8FF",
    fontSize: 12,
    fontWeight: "700",
    marginBottom: 8,
    textTransform: "uppercase",
  },
  anchorText: {
    color: "#F5F7FB",
    fontSize: 16,
    fontWeight: "700",
    lineHeight: 24,
  },
  sessionMeta: {
    color: "#8E98AA",
    fontSize: 13,
    lineHeight: 18,
    marginBottom: 8,
  },
  tapHint: {
    color: "#7C8BFF",
    fontSize: 13,
    fontWeight: "700",
  },
});