import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import * as SecureStore from "expo-secure-store";

const SESSIONS_URL = "https://thoughtclarity-api.onrender.com/sessions";
const USER_ID_STORAGE_KEY = "return_anonymous_user_id";

type ChatMessage = {
  role: "user" | "assistant";
  content: string;
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
  metadata?: Record<string, unknown>;
  messages?: ChatMessage[];
  fullThread?: ChatMessage[];
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

export default function SessionDetailScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ id?: string }>();
  const sessionId = typeof params.id === "string" ? params.id : "";

  const [session, setSession] = useState<SavedSession | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const fetchSession = useCallback(async () => {
    if (!sessionId) {
      setError("Missing session id.");
      setLoading(false);
      return;
    }

    setLoading(true);
    setError("");

    try {
      const userId = await getAnonymousUserId();

      const response = await fetch(
        `${SESSIONS_URL}/${encodeURIComponent(sessionId)}?userId=${encodeURIComponent(userId)}`
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data?.error || "Failed to fetch session.");
      }

      setSession(data?.session || null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch session.");
    } finally {
      setLoading(false);
    }
  }, [sessionId]);

  useEffect(() => {
    fetchSession();
  }, [fetchSession]);

  const isTalkInsight = session?.type === "talk_insight";
  const thread = session?.fullThread || session?.messages || [];

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <View style={styles.card}>
        <Text style={styles.eyebrow}>THE RETURN: RECLAIM PEACE</Text>
        <Text style={styles.title}>Saved Session</Text>
        <Text style={styles.subtitle}>
          Revisit the full clarity from this moment.
        </Text>

        <View style={styles.buttonRow}>
          <TouchableOpacity
            style={styles.secondaryButton}
            onPress={() => router.back()}
          >
            <Text style={styles.secondaryButtonText}>Back</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.primaryButton} onPress={fetchSession}>
            <Text style={styles.primaryButtonText}>Refresh</Text>
          </TouchableOpacity>
        </View>

        {loading ? (
          <View style={styles.loadingBox}>
            <ActivityIndicator size="large" />
            <Text style={styles.loadingText}>Loading saved session...</Text>
          </View>
        ) : error ? (
          <View style={styles.messageBox}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : !session ? (
          <View style={styles.messageBox}>
            <Text style={styles.errorText}>Session not found.</Text>
          </View>
        ) : (
          <>
            <View style={styles.headerBox}>
              <View style={styles.headerTopRow}>
                <Text style={styles.sessionTitle}>
                  {session.title || "Saved Session"}
                </Text>

                <View
                  style={[
                    styles.typeBadge,
                    isTalkInsight ? styles.talkInsightBadge : styles.clarityBadge,
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

              <Text style={styles.sessionMeta}>
                {formatDate(session.createdAt)}
              </Text>
            </View>

            {isTalkInsight ? (
              <View style={styles.threadWrap}>
                <Text style={styles.threadTitle}>Saved Conversation</Text>

                {thread.length === 0 ? (
                  <View style={styles.messageBox}>
                    <Text style={styles.errorText}>
                      No saved messages were found for this talk insight.
                    </Text>
                  </View>
                ) : (
                  <View style={styles.threadList}>
                    {thread.map((message, index) => {
                      const isAssistant = message.role === "assistant";

                      return (
                        <View
                          key={`${message.role}-${index}`}
                          style={[
                            styles.messageRow,
                            isAssistant
                              ? styles.messageRowLeft
                              : styles.messageRowRight,
                          ]}
                        >
                          <View
                            style={[
                              styles.messageBubble,
                              isAssistant
                                ? styles.assistantBubble
                                : styles.userBubble,
                            ]}
                          >
                            <Text
                              style={[
                                styles.messageLabel,
                                isAssistant
                                  ? styles.assistantLabel
                                  : styles.userLabel,
                              ]}
                            >
                              {isAssistant ? "Talk It Through" : "You"}
                            </Text>

                            <Text
                              style={[
                                styles.messageText,
                                isAssistant
                                  ? styles.assistantText
                                  : styles.userText,
                              ]}
                            >
                              {message.content}
                            </Text>
                          </View>
                        </View>
                      );
                    })}
                  </View>
                )}
              </View>
            ) : (
              <>
                {!!session.output?.reflection?.trim() && (
                  <View style={styles.miniSection}>
                    <Text style={styles.sectionTitle}>Reflection</Text>
                    <Text style={styles.sectionText}>
                      {session.output.reflection}
                    </Text>
                  </View>
                )}

                {!!session.output?.fact?.trim() && (
                  <View style={styles.miniSection}>
                    <Text style={styles.sectionTitle}>Fact</Text>
                    <Text style={styles.sectionText}>{session.output.fact}</Text>
                  </View>
                )}

                {!!session.output?.mindStory?.trim() && (
                  <View style={styles.miniSection}>
                    <Text style={styles.sectionTitle}>Mind Story</Text>
                    <Text style={styles.sectionText}>
                      {session.output.mindStory}
                    </Text>
                  </View>
                )}

                {!!session.output?.clarityAnchor?.trim() && (
                  <View style={styles.anchorBox}>
                    <Text style={styles.anchorLabel}>Clarity Anchor</Text>
                    <Text style={styles.anchorText}>
                      {session.output.clarityAnchor}
                    </Text>
                  </View>
                )}

                {!!session.output?.reminder?.trim() && (
                  <View style={styles.softBox}>
                    <Text style={styles.softLabel}>Reminder</Text>
                    <Text style={styles.softText}>
                      {session.output.reminder}
                    </Text>
                  </View>
                )}

                {!!session.output?.oneSmallAction?.trim() && (
                  <View style={styles.softBox}>
                    <Text style={styles.softLabel}>One Small Action</Text>
                    <Text style={styles.softText}>
                      {session.output.oneSmallAction}
                    </Text>
                  </View>
                )}
              </>
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
  sessionTitle: {
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
    marginBottom: 10,
  },
  sessionMeta: {
    color: "#8E98AA",
    fontSize: 13,
    lineHeight: 18,
  },
  miniSection: {
    backgroundColor: "#0E121A",
    borderWidth: 1,
    borderColor: "#1D2331",
    borderRadius: 14,
    padding: 13,
    marginBottom: 10,
  },
  sectionTitle: {
    color: "#7C8BFF",
    fontSize: 13,
    fontWeight: "700",
    marginBottom: 8,
    textTransform: "uppercase",
  },
  sectionText: {
    color: "#E8ECF3",
    fontSize: 14,
    lineHeight: 23,
  },
  anchorBox: {
    backgroundColor: "#171D2B",
    borderWidth: 1,
    borderColor: "#7C8BFF",
    borderRadius: 20,
    paddingVertical: 18,
    paddingHorizontal: 18,
    marginBottom: 12,
  },
  anchorLabel: {
    color: "#AEB8FF",
    fontSize: 12,
    fontWeight: "700",
    marginBottom: 10,
    textTransform: "uppercase",
    textAlign: "center",
  },
  anchorText: {
    color: "#F5F7FB",
    fontSize: 21,
    fontWeight: "800",
    textAlign: "center",
    lineHeight: 29,
  },
  softBox: {
    backgroundColor: "#111726",
    borderWidth: 1,
    borderColor: "#2A3247",
    borderRadius: 16,
    padding: 16,
    marginBottom: 10,
  },
  softLabel: {
    color: "#AEB8FF",
    fontSize: 12,
    fontWeight: "700",
    marginBottom: 8,
    textTransform: "uppercase",
  },
  softText: {
    color: "#E8ECF3",
    fontSize: 15,
    fontWeight: "700",
    lineHeight: 22,
  },
  threadWrap: {
    gap: 12,
  },
  threadTitle: {
    color: "#F5F7FB",
    fontSize: 20,
    fontWeight: "800",
    marginBottom: 2,
  },
  threadList: {
    gap: 12,
  },
  messageRow: {
    width: "100%",
    flexDirection: "row",
  },
  messageRowLeft: {
    justifyContent: "flex-start",
  },
  messageRowRight: {
    justifyContent: "flex-end",
  },
  messageBubble: {
    maxWidth: "86%",
    borderRadius: 18,
    padding: 14,
  },
  assistantBubble: {
    backgroundColor: "#101522",
    borderWidth: 1,
    borderColor: "#2A3247",
  },
  userBubble: {
    backgroundColor: "#7C8BFF",
  },
  messageLabel: {
    fontSize: 12,
    fontWeight: "800",
    marginBottom: 8,
    letterSpacing: 0.5,
  },
  assistantLabel: {
    color: "#AEB8FF",
    textTransform: "uppercase",
  },
  userLabel: {
    color: "#0B0D12",
    textTransform: "uppercase",
  },
  messageText: {
    fontSize: 15,
    lineHeight: 23,
  },
  assistantText: {
    color: "#E8ECF3",
  },
  userText: {
    color: "#0B0D12",
    fontWeight: "600",
  },
});