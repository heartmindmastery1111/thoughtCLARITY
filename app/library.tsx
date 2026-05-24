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
const PATTERNS_URL = "https://thoughtclarity-api.onrender.com/patterns";
const USER_ID_STORAGE_KEY = "return_anonymous_user_id";

type PatternEntry = {
  value: string;
  count: number;
  label?: string;
};

type PatternsResponse = {
  totalSavedItems: number;
  byType: Record<string, number>;
  topMindStories: PatternEntry[];
  topPatternMarkers: PatternEntry[];
  topContexts: PatternEntry[];
  topKeywords?: PatternEntry[];
  topTitles?: PatternEntry[];
};

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
  contextMarkers?: string[];
  metadata?: Record<string, unknown>;
  messages?: {
    role: "user" | "assistant";
    content: string;
  }[];
  fullThread?: {
    role: "user" | "assistant";
    content: string;
  }[];
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

function getTypeLabel(type?: string) {
  if (type === "talk_insight") return "Talk Insight";
  return "Clarity Session";
}

export default function LibraryScreen() {
  const router = useRouter();

  const [sessions, setSessions] = useState<SavedSession[]>([]);
  const [patterns, setPatterns] = useState<PatternsResponse | null>(null);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [error, setError] = useState("");
  const [patternsError, setPatternsError] = useState("");

  const fetchLibraryData = useCallback(async (isRefresh = false) => {
    if (isRefresh) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }

    setError("");
    setPatternsError("");

    try {
      const userId = await getAnonymousUserId();

      const [sessionsResponse, patternsResponse] = await Promise.all([
        fetch(`${SESSIONS_URL}?userId=${encodeURIComponent(userId)}`),
        fetch(`${PATTERNS_URL}?userId=${encodeURIComponent(userId)}`),
      ]);

      const sessionsData = await sessionsResponse.json();
      const patternsData = await patternsResponse.json();

      if (!sessionsResponse.ok) {
        throw new Error(
          sessionsData?.error || "Failed to fetch saved sessions."
        );
      }

      setSessions(Array.isArray(sessionsData?.sessions) ? sessionsData.sessions : []);

      if (patternsResponse.ok) {
        setPatterns(patternsData?.patterns || null);
      } else {
        setPatterns(null);
        setPatternsError(patternsData?.error || "Failed to fetch patterns.");
      }
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
    fetchLibraryData();
  }, [fetchLibraryData]);

  const hasPatterns = !!patterns && patterns.totalSavedItems > 0;

  return (
    <ScrollView
      contentContainerStyle={styles.container}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={() => fetchLibraryData(true)}
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
            onPress={() => fetchLibraryData(true)}
          >
            <Text style={styles.primaryButtonText}>Refresh</Text>
          </TouchableOpacity>
        </View>

        {!loading && !error && (
          <View style={styles.patternsCard}>
            <View style={styles.patternsHeaderRow}>
              <Text style={styles.patternsTitle}>Your Patterns</Text>

              <TouchableOpacity
                style={[
                  styles.readPatternsButton,
                  !hasPatterns && styles.buttonDisabled,
                ]}
                onPress={() => router.push("/patterns-reading")}
                disabled={!hasPatterns}
              >
                <Text style={styles.readPatternsButtonText}>Read My Patterns</Text>
              </TouchableOpacity>
            </View>

            {patternsError ? (
              <Text style={styles.patternsErrorText}>{patternsError}</Text>
            ) : !hasPatterns ? (
              <Text style={styles.patternsEmptyText}>
                Save more sessions to start seeing patterns.
              </Text>
            ) : (
              <>
                <View style={styles.patternStatsRow}>
                  <View style={styles.patternStatPill}>
                    <Text style={styles.patternStatValue}>
                      {patterns.totalSavedItems}
                    </Text>
                    <Text style={styles.patternStatLabel}>Saved</Text>
                  </View>

                  <View style={styles.patternStatPill}>
                    <Text style={styles.patternStatValue}>
                      {patterns.byType?.clarity_session || 0}
                    </Text>
                    <Text style={styles.patternStatLabel}>Clarity</Text>
                  </View>

                  <View style={styles.patternStatPill}>
                    <Text style={styles.patternStatValue}>
                      {patterns.byType?.talk_insight || 0}
                    </Text>
                    <Text style={styles.patternStatLabel}>Talk</Text>
                  </View>
                </View>

                {patterns.topMindStories?.length > 0 && (
                  <View style={styles.patternLineWrap}>
                    <Text style={styles.patternLineLabel}>Most repeated story</Text>
                    <Text style={styles.patternLineText}>
                      “{patterns.topMindStories[0].value}”
                    </Text>
                  </View>
                )}

                {patterns.topPatternMarkers?.length > 0 && (
                  <View style={styles.patternLineWrap}>
                    <Text style={styles.patternLineLabel}>Repeated pattern</Text>
                    <Text style={styles.patternLineText}>
                      {patterns.topPatternMarkers[0].label || patterns.topPatternMarkers[0].value}
                    </Text>
                  </View>
                )}

                {patterns.topContexts?.length > 0 && (
                  <View style={styles.patternLineWrap}>
                    <Text style={styles.patternLineLabel}>Repeated context</Text>
                    <Text style={styles.patternLineText}>
                      {patterns.topContexts[0].label || patterns.topContexts[0].value}
                    </Text>
                  </View>
                )}
              </>
            )}
          </View>
        )}

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
              Complete a Clarity Session or save a Talk Insight. It will appear here.
            </Text>
          </View>
        ) : (
          <View style={styles.listWrap}>
            {sessions.map((session) => {
              const isTalkInsight = session.type === "talk_insight";

              return (
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
                  <View style={styles.cardHeaderRow}>
                    <Text style={styles.sessionTitle}>
                      {session.title || "Saved Session"}
                    </Text>
                    <View
                      style={[
                        styles.typeBadge,
                        isTalkInsight
                          ? styles.talkInsightBadge
                          : styles.clarityBadge,
                      ]}
                    >
                      <Text style={styles.typeBadgeText}>
                        {getTypeLabel(session.type)}
                      </Text>
                    </View>
                  </View>

                  {!!session.summary?.trim() && (
                    <Text style={styles.sessionSummary}>{session.summary}</Text>
                  )}

                  {!isTalkInsight && !!session.output?.clarityAnchor?.trim() && (
                    <View style={styles.anchorBox}>
                      <Text style={styles.anchorLabel}>Clarity Anchor</Text>
                      <Text style={styles.anchorText}>
                        {session.output.clarityAnchor}
                      </Text>
                    </View>
                  )}

                  {isTalkInsight && (
                    <View style={styles.talkInsightBox}>
                      <Text style={styles.talkInsightLabel}>Talk Insight</Text>
                      <Text style={styles.talkInsightText}>
                        Full conversation saved in the background.
                      </Text>
                    </View>
                  )}

                  <Text style={styles.sessionMeta}>
                    {formatDate(session.createdAt)}
                  </Text>

                  <Text style={styles.tapHint}>Tap to open full session</Text>
                </TouchableOpacity>
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
  patternsCard: {
    backgroundColor: "#0F131B",
    borderWidth: 1,
    borderColor: "#232938",
    borderRadius: 18,
    padding: 16,
    marginBottom: 18,
  },
  patternsHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 12,
    marginBottom: 12,
  },
  patternsTitle: {
    color: "#F5F7FB",
    fontSize: 20,
    fontWeight: "800",
    flex: 1,
  },
  readPatternsButton: {
    backgroundColor: "#171D2B",
    borderWidth: 1,
    borderColor: "#7C8BFF",
    borderRadius: 14,
    paddingVertical: 10,
    paddingHorizontal: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  readPatternsButtonText: {
    color: "#E8ECF3",
    fontSize: 13,
    fontWeight: "800",
  },
  patternsErrorText: {
    color: "#FCA5A5",
    fontSize: 14,
    lineHeight: 22,
  },
  patternsEmptyText: {
    color: "#A8B0BD",
    fontSize: 14,
    lineHeight: 22,
  },
  patternStatsRow: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 12,
  },
  patternStatPill: {
    flex: 1,
    backgroundColor: "#151922",
    borderWidth: 1,
    borderColor: "#2A3247",
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 10,
    alignItems: "center",
  },
  patternStatValue: {
    color: "#F5F7FB",
    fontSize: 20,
    fontWeight: "800",
    marginBottom: 4,
  },
  patternStatLabel: {
    color: "#A8B0BD",
    fontSize: 12,
    fontWeight: "700",
    textAlign: "center",
  },
  patternLineWrap: {
    backgroundColor: "#151922",
    borderWidth: 1,
    borderColor: "#2A3247",
    borderRadius: 14,
    padding: 12,
    marginTop: 10,
  },
  patternLineLabel: {
    color: "#7C8BFF",
    fontSize: 12,
    fontWeight: "800",
    textTransform: "uppercase",
    marginBottom: 6,
  },
  patternLineText: {
    color: "#E8ECF3",
    fontSize: 14,
    lineHeight: 22,
  },
  buttonDisabled: {
    opacity: 0.45,
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
  cardHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 12,
    marginBottom: 8,
  },
  sessionTitle: {
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
  },
  clarityBadge: {
    backgroundColor: "#171D2B",
    borderColor: "#7C8BFF",
  },
  talkInsightBadge: {
    backgroundColor: "#18261D",
    borderColor: "#46A36B",
  },
  typeBadgeText: {
    color: "#E8ECF3",
    fontSize: 11,
    fontWeight: "800",
    textTransform: "uppercase",
    letterSpacing: 0.5,
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
  talkInsightBox: {
    backgroundColor: "#18261D",
    borderWidth: 1,
    borderColor: "#46A36B",
    borderRadius: 16,
    paddingVertical: 14,
    paddingHorizontal: 14,
    marginBottom: 12,
  },
  talkInsightLabel: {
    color: "#8DE2AE",
    fontSize: 12,
    fontWeight: "700",
    marginBottom: 8,
    textTransform: "uppercase",
  },
  talkInsightText: {
    color: "#E8ECF3",
    fontSize: 15,
    lineHeight: 22,
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
