import React from "react";
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useRouter } from "expo-router";

export default function HomeScreen() {
  const router = useRouter();

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <View style={styles.card}>
        <Text style={styles.eyebrow}>THE RETURN: RECLAIM PEACE</Text>
        <Text style={styles.title}>What do you need right now?</Text>
        <Text style={styles.subtitle}>
          The RETURN trains the shift from mental spiraling back to presence.
        </Text>

        <View style={styles.optionCard}>
          <Text style={styles.optionTitle}>Clarity Session</Text>
          <Text style={styles.optionText}>
            A guided path to slow down, separate fact from story, and return to clarity.
          </Text>

          <TouchableOpacity
            style={styles.primaryButton}
            onPress={() => router.push("/clarity-session")}
          >
            <Text style={styles.primaryButtonText}>Start Clarity Session</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.optionCard}>
          <Text style={styles.optionTitle}>Talk It Through</Text>
          <Text style={styles.optionText}>
            A natural back-and-forth space to process what is on your mind.
          </Text>

          <TouchableOpacity
            style={styles.secondaryButton}
            onPress={() => router.push("/talk-it-through")}
          >
            <Text style={styles.secondaryButtonText}>Start Talk It Through</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.optionCard}>
          <Text style={styles.optionTitle}>Clarity Library</Text>
          <Text style={styles.optionText}>
            Revisit your saved sessions and track what has been landing most clearly.
          </Text>

          <TouchableOpacity
            style={styles.secondaryButton}
            onPress={() => router.push("/library")}
          >
            <Text style={styles.secondaryButtonText}>Open Clarity Library</Text>
          </TouchableOpacity>
        </View>
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
  optionCard: {
    backgroundColor: "#0F131B",
    borderWidth: 1,
    borderColor: "#232938",
    borderRadius: 18,
    padding: 16,
    marginBottom: 14,
  },
  optionTitle: {
    color: "#F5F7FB",
    fontSize: 22,
    fontWeight: "800",
    marginBottom: 8,
  },
  optionText: {
    color: "#A8B0BD",
    fontSize: 15,
    lineHeight: 22,
    marginBottom: 16,
  },
  primaryButton: {
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
    backgroundColor: "#151922",
    borderWidth: 1,
    borderColor: "#2A3247",
    borderRadius: 16,
    paddingVertical: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  secondaryButtonText: {
    color: "#E8ECF3",
    fontSize: 15,
    fontWeight: "700",
    textAlign: "center",
    paddingHorizontal: 12,
  },
});