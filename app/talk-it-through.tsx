import React, { useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useRouter } from "expo-router";
import * as SecureStore from "expo-secure-store";

const API_URL = "https://thoughtclarity-api.onrender.com/talk";
const SAVE_TALK_INSIGHT_URL =
  "https://thoughtclarity-api.onrender.com/talk/save-insight";
const USER_ID_STORAGE_KEY = "return_anonymous_user_id";

type ChatMessage = {
  role: "user" | "assistant";
  content: string;
};

const STARTER_MESSAGE =
  "Talk it through naturally. Say what is on your mind, and I’ll help you sort through it clearly.";

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

function buildInsightTitle(messages: ChatMessage[]) {
  const lastUserMessage = [...messages]
    .reverse()
    .find((message) => message.role === "user")?.content;

  const source = (lastUserMessage || "Talk Insight").trim();
  return source.length > 80 ? `${source.slice(0, 77)}...` : source;
}

function buildInsightSummary(messages: ChatMessage[]) {
  const lastAssistantMessage = [...messages]
    .reverse()
    .find((message) => message.role === "assistant" && message.content !== STARTER_MESSAGE)
    ?.content;

  const source = (lastAssistantMessage || "Saved Talk It Through insight.").trim();
  return source.length > 180 ? `${source.slice(0, 177)}...` : source;
}

export default function TalkItThroughScreen() {
  const router = useRouter();
  const scrollViewRef = useRef<ScrollView | null>(null);

  const [messages, setMessages] = useState<ChatMessage[]>([
    { role: "assistant", content: STARTER_MESSAGE },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);

  const [savingInsight, setSavingInsight] = useState(false);
  const [savedInsightId, setSavedInsightId] = useState<string | null>(null);
  const [saveInsightError, setSaveInsightError] = useState("");

  const canSend = useMemo(
    () => input.trim().length > 0 && !loading,
    [input, loading]
  );

  const canSaveInsight = useMemo(() => {
    const meaningfulMessages = messages.filter(
      (message) => message.content.trim() && message.content !== STARTER_MESSAGE
    );
    return meaningfulMessages.length >= 2 && !loading;
  }, [messages, loading]);

  const scrollToBottom = () => {
    requestAnimationFrame(() => {
      scrollViewRef.current?.scrollToEnd({ animated: true });
    });
  };

  const handleSend = async () => {
    const trimmed = input.trim();
    if (!trimmed || loading) return;

    const userMessage: ChatMessage = {
      role: "user",
      content: trimmed,
    };

    const nextMessages = [...messages, userMessage];
    setMessages(nextMessages);
    setInput("");
    setLoading(true);
    setSavedInsightId(null);
    setSaveInsightError("");
    scrollToBottom();

    try {
      const response = await fetch(API_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          messages: nextMessages,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data?.error || "Talk request failed");
      }

      const reply =
        typeof data.reply === "string" && data.reply.trim()
          ? data.reply.trim()
          : "Something went wrong while responding.";

      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: reply,
        },
      ]);
    } catch (error) {
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: "Something went wrong while responding.",
        },
      ]);
    } finally {
      setLoading(false);
      scrollToBottom();
    }
  };

  const handleSaveInsight = async () => {
    if (!canSaveInsight || savingInsight || savedInsightId) return;

    setSavingInsight(true);
    setSaveInsightError("");

    try {
      const userId = await getAnonymousUserId();

      const payload = {
        userId,
        messages,
        title: buildInsightTitle(messages),
        summary: buildInsightSummary(messages),
        metadata: {
          savedFrom: "talk_it_through_screen",
        },
      };

      const response = await fetch(SAVE_TALK_INSIGHT_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data?.error || "Failed to save insight.");
      }

      setSavedInsightId(data?.insight?.id || "saved");
    } catch (error) {
      setSaveInsightError(
        error instanceof Error ? error.message : "Failed to save insight."
      );
    } finally {
      setSavingInsight(false);
    }
  };

  const handleRestart = () => {
    setMessages([{ role: "assistant", content: STARTER_MESSAGE }]);
    setInput("");
    setLoading(false);
    setSavingInsight(false);
    setSavedInsightId(null);
    setSaveInsightError("");
  };

  return (
    <KeyboardAvoidingView
      style={styles.keyboardWrap}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <View style={styles.container}>
        <View style={styles.card}>
          <Text style={styles.eyebrow}>THE RETURN: RECLAIM PEACE</Text>
          <Text style={styles.title}>Talk It Through</Text>
          <Text style={styles.subtitle}>
            A natural back-and-forth space to help you process what is on your mind.
          </Text>

          <View style={styles.topButtonRow}>
            <TouchableOpacity
              style={styles.secondaryButton}
              onPress={() => router.back()}
            >
              <Text style={styles.secondaryButtonText}>Back</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.secondaryButton}
              onPress={handleRestart}
            >
              <Text style={styles.secondaryButtonText}>Start Fresh</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.chatBox}>
            <ScrollView
              ref={scrollViewRef}
              contentContainerStyle={styles.chatContent}
              onContentSizeChange={scrollToBottom}
            >
              {messages.map((message, index) => {
                const isAssistant = message.role === "assistant";

                return (
                  <View
                    key={`${message.role}-${index}`}
                    style={[
                      styles.messageRow,
                      isAssistant ? styles.messageRowLeft : styles.messageRowRight,
                    ]}
                  >
                    <View
                      style={[
                        styles.messageBubble,
                        isAssistant ? styles.assistantBubble : styles.userBubble,
                      ]}
                    >
                      <Text
                        style={[
                          styles.messageLabel,
                          isAssistant ? styles.assistantLabel : styles.userLabel,
                        ]}
                      >
                        {isAssistant ? "Talk It Through" : "You"}
                      </Text>

                      <Text
                        style={[
                          styles.messageText,
                          isAssistant ? styles.assistantText : styles.userText,
                        ]}
                      >
                        {message.content}
                      </Text>
                    </View>
                  </View>
                );
              })}

              {loading && (
                <View style={[styles.messageRow, styles.messageRowLeft]}>
                  <View
                    style={[
                      styles.messageBubble,
                      styles.assistantBubble,
                      styles.loadingBubble,
                    ]}
                  >
                    <Text style={[styles.messageLabel, styles.assistantLabel]}>
                      Talk It Through
                    </Text>
                    <View style={styles.loadingInline}>
                      <ActivityIndicator size="small" />
                      <Text style={styles.loadingInlineText}>Thinking...</Text>
                    </View>
                  </View>
                </View>
              )}
            </ScrollView>
          </View>

          <View style={styles.saveInsightWrap}>
            <TouchableOpacity
              style={[
                styles.saveInsightButton,
                (!canSaveInsight || savingInsight) && styles.buttonDisabled,
                savedInsightId && styles.savedInsightButton,
              ]}
              onPress={handleSaveInsight}
              disabled={!canSaveInsight || savingInsight || !!savedInsightId}
            >
              {savingInsight ? (
                <ActivityIndicator color="#E8ECF3" />
              ) : (
                <Text style={styles.saveInsightButtonText}>
                  {savedInsightId ? "Insight Saved" : "Save This Insight"}
                </Text>
              )}
            </TouchableOpacity>

            {!!saveInsightError.trim() && (
              <Text style={styles.saveInsightErrorText}>{saveInsightError}</Text>
            )}
          </View>

          <View style={styles.inputWrap}>
            <TextInput
              style={styles.input}
              placeholder="Type what’s on your mind..."
              placeholderTextColor="#7A7F8A"
              multiline
              value={input}
              onChangeText={setInput}
              textAlignVertical="top"
            />

            <TouchableOpacity
              style={[styles.primaryButton, !canSend && styles.buttonDisabled]}
              onPress={handleSend}
              disabled={!canSend}
            >
              <Text style={styles.primaryButtonText}>Send</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  keyboardWrap: {
    flex: 1,
    backgroundColor: "#0B0D12",
  },
  container: {
    flex: 1,
    backgroundColor: "#0B0D12",
    padding: 20,
    justifyContent: "center",
    alignItems: "center",
  },
  card: {
    width: "100%",
    maxWidth: 760,
    flex: 1,
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
    marginBottom: 16,
  },
  topButtonRow: {
    flexDirection: "row",
    gap: 12,
    marginBottom: 16,
  },
  chatBox: {
    flex: 1,
    minHeight: 320,
    backgroundColor: "#0F131B",
    borderWidth: 1,
    borderColor: "#232938",
    borderRadius: 18,
    marginBottom: 16,
    overflow: "hidden",
  },
  chatContent: {
    padding: 14,
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
  loadingBubble: {
    minWidth: 150,
  },
  loadingInline: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  loadingInlineText: {
    color: "#A8B0BD",
    fontSize: 14,
  },
  saveInsightWrap: {
    marginBottom: 12,
  },
  saveInsightButton: {
    backgroundColor: "#0F131B",
    borderWidth: 1,
    borderColor: "#232938",
    borderRadius: 16,
    paddingVertical: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  savedInsightButton: {
    backgroundColor: "#17301F",
    borderColor: "#2E6B44",
  },
  saveInsightButtonText: {
    color: "#E8ECF3",
    fontSize: 15,
    fontWeight: "700",
  },
  saveInsightErrorText: {
    marginTop: 10,
    color: "#FCA5A5",
    textAlign: "center",
    lineHeight: 20,
  },
  inputWrap: {
    gap: 12,
  },
  input: {
    minHeight: 120,
    maxHeight: 200,
    backgroundColor: "#0F131B",
    borderWidth: 1,
    borderColor: "#232938",
    borderRadius: 18,
    padding: 16,
    color: "#F5F7FB",
    fontSize: 16,
  },
  primaryButton: {
    backgroundColor: "#7C8BFF",
    borderRadius: 16,
    paddingVertical: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  buttonDisabled: {
    opacity: 0.45,
  },
  primaryButtonText: {
    color: "#0B0D12",
    fontSize: 16,
    fontWeight: "800",
    textAlign: "center",
    paddingHorizontal: 12,
  },
  secondaryButton: {
    flex: 1,
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
});