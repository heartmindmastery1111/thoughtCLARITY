import { useState } from "react";
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";

const QUESTIONS = [
  "What feels most heavy in you right now?",
  "What is happening inside you right now, in this moment?",
  "Where do you feel it in your body?",
  "What thought is your mind repeating about this?",
  "Take a moment and breathe slowly for 3 breaths, making each exhale longer than the inhale. If you didn’t believe that thought for a moment, what would remain?",
  "Is there one small action available to you right now?",
];

const API_URL = "https://thoughtclarity-api.onrender.com/clarity";

export default function HomeScreen() {
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<string[]>(Array(QUESTIONS.length).fill(""));
  const [input, setInput] = useState("");
  const [result, setResult] = useState("");
  const [loading, setLoading] = useState(false);

  const isLastStep = step === QUESTIONS.length - 1;
  const progress = `${step + 1} / ${QUESTIONS.length}`;

  const handleNext = () => {
    if (!input.trim()) return;

    const updated = [...answers];
    updated[step] = input.trim();
    setAnswers(updated);

    if (isLastStep) {
      generateClarity(updated);
    } else {
      setStep(step + 1);
      setInput(updated[step + 1] || "");
    }
  };

  const handleBack = () => {
    if (step === 0) return;

    const updated = [...answers];
    updated[step] = input;

    const previousStep = step - 1;
    setAnswers(updated);
    setStep(previousStep);
    setInput(updated[previousStep] || "");
  };

  const generateClarity = async (finalAnswers: string[]) => {
    setLoading(true);
    setResult("");

    try {
      await new Promise((resolve) => setTimeout(resolve, 2000));

      const response = await fetch(API_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          answers: finalAnswers,
        }),
      });

      const data = await response.json();
      setResult(typeof data.result === "string" ? data.result : JSON.stringify(data, null, 2));
    } catch (error) {
      setResult("Something went wrong while generating clarity.");
    } finally {
      setLoading(false);
    }
  };

  const handleRestart = () => {
    setStep(0);
    setAnswers(Array(QUESTIONS.length).fill(""));
    setInput("");
    setResult("");
    setLoading(false);
  };

  if (result) {
    const sections: Record<string, string> = {
      reflection: "",
      fact: "",
      mindStory: "",
      clarityAnchor: "",
      oneSmallAction: "",
    };

    const lines = result
      .split("\n")
      .map((l) => l.trim())
      .filter(Boolean);

    let current = "";

    for (const rawLine of lines) {
      const normalizedLine = rawLine
        .replace(/\*\*/g, "")
        .replace(/^[#\-\s]+/, "")
        .replace(/:$/, "")
        .trim()
        .toUpperCase();

      if (normalizedLine === "REFLECTION") current = "reflection";
      else if (normalizedLine === "FACT") current = "fact";
      else if (normalizedLine === "MIND STORY") current = "mindStory";
      else if (normalizedLine === "CLARITY ANCHOR") current = "clarityAnchor";
      else if (normalizedLine === "ONE SMALL ACTION") current = "oneSmallAction";
      else if (current) {
        const cleanedContent = rawLine.replace(/^[\-\s]+/, "").trim();
        sections[current] += (sections[current] ? "\n" : "") + cleanedContent;
      }
    }

    const hasParsedSections = Object.values(sections).some((value) => value.trim().length > 0);

    if (!hasParsedSections) {
      return (
        <ScrollView contentContainerStyle={styles.container}>
          <View style={styles.card}>
            <Text style={styles.eyebrow}>THOUGHTCLARITY</Text>
            <Text style={styles.title}>Raw Response</Text>
            <Text style={styles.subtitle}>
              The AI responded, but the section parser did not match the format yet.
            </Text>

            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Full Response</Text>
              <Text style={styles.sectionText}>{result}</Text>
            </View>

            <TouchableOpacity style={styles.button} onPress={handleRestart}>
              <Text style={styles.buttonText}>Start Again</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      );
    }

    return (
      <ScrollView contentContainerStyle={styles.container}>
        <View style={styles.card}>
          <Text style={styles.eyebrow}>THOUGHTCLARITY</Text>
          <Text style={styles.title}>Your Clarity</Text>
          <Text style={styles.subtitle}>
            Read slowly. Let the clarity anchor land before moving on.
          </Text>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Reflection</Text>
            <Text style={styles.sectionText}>{sections.reflection}</Text>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Fact</Text>
            <Text style={styles.sectionText}>{sections.fact}</Text>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Mind Story</Text>
            <Text style={styles.sectionText}>{sections.mindStory}</Text>
          </View>

          <View style={styles.anchorBox}>
            <Text style={styles.anchorLabel}>Clarity Anchor</Text>
            <Text style={styles.anchorText}>{sections.clarityAnchor}</Text>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>One Small Action</Text>
            <Text style={styles.sectionText}>{sections.oneSmallAction}</Text>
          </View>

          <Text style={styles.reinforcementText}>
            Notice what changes in your body when you read the clarity anchor.
          </Text>

          <TouchableOpacity style={styles.button} onPress={handleRestart}>
            <Text style={styles.buttonText}>Start Again</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <View style={styles.card}>
        <Text style={styles.eyebrow}>THOUGHTCLARITY</Text>
        <Text style={styles.title}>See the thought clearly.</Text>
        <Text style={styles.subtitle}>
          Move through six reflective questions. Then the engine separates direct
          experience from mind story and gives you a cleaner read.
        </Text>

        <View style={styles.progressRow}>
          <Text style={styles.progressText}>Question {progress}</Text>
          <View style={styles.progressTrack}>
            <View
              style={[
                styles.progressFill,
                { width: `${((step + 1) / QUESTIONS.length) * 100}%` },
              ]}
            />
          </View>
        </View>

        <View style={styles.questionBox}>
          <Text style={styles.questionLabel}>Current Question</Text>
          <Text style={styles.questionText}>{QUESTIONS[step]}</Text>
        </View>

        <TextInput
          style={styles.input}
          placeholder="Type your answer here..."
          placeholderTextColor="#7A7F8A"
          multiline
          value={input}
          onChangeText={setInput}
          textAlignVertical="top"
        />

        {loading ? (
          <View style={styles.loadingBox}>
            <ActivityIndicator />
            <Text style={styles.loadingText}>Analyzing clarity...</Text>
          </View>
        ) : (
          <View style={styles.buttonRow}>
            <TouchableOpacity
              style={[styles.secondaryButton, step === 0 && styles.buttonDisabled]}
              onPress={handleBack}
              disabled={step === 0}
            >
              <Text style={styles.secondaryButtonText}>Back</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.button, !input.trim() && styles.buttonDisabled]}
              onPress={handleNext}
              disabled={!input.trim()}
            >
              <Text style={styles.buttonText}>
                {isLastStep ? "Generate Clarity" : "Next Question"}
              </Text>
            </TouchableOpacity>
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
    padding: 24,
  },
  card: {
    width: "100%",
    maxWidth: 760,
    backgroundColor: "#151922",
    borderRadius: 28,
    padding: 24,
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
    letterSpacing: 1.6,
    marginBottom: 10,
  },
  title: {
    color: "#F5F7FB",
    fontSize: 30,
    fontWeight: "800",
    marginBottom: 10,
  },
  subtitle: {
    color: "#A8B0BD",
    fontSize: 15,
    lineHeight: 22,
    marginBottom: 20,
  },
  progressRow: {
    marginBottom: 18,
  },
  progressText: {
    color: "#A8B0BD",
    fontSize: 13,
    marginBottom: 8,
  },
  progressTrack: {
    height: 8,
    backgroundColor: "#0F131B",
    borderRadius: 999,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "#232938",
  },
  progressFill: {
    height: "100%",
    backgroundColor: "#7C8BFF",
    borderRadius: 999,
  },
  questionBox: {
    backgroundColor: "#0F131B",
    borderWidth: 1,
    borderColor: "#232938",
    borderRadius: 18,
    padding: 18,
    marginBottom: 16,
  },
  questionLabel: {
    color: "#7C8BFF",
    fontSize: 13,
    fontWeight: "700",
    marginBottom: 8,
    letterSpacing: 0.5,
  },
  questionText: {
    color: "#F5F7FB",
    fontSize: 20,
    fontWeight: "700",
    lineHeight: 28,
  },
  input: {
    minHeight: 160,
    backgroundColor: "#0F131B",
    borderWidth: 1,
    borderColor: "#232938",
    borderRadius: 18,
    padding: 16,
    color: "#F5F7FB",
    fontSize: 16,
    marginBottom: 18,
  },
  buttonRow: {
    flexDirection: "row",
    gap: 12,
  },
  button: {
    flex: 1,
    backgroundColor: "#7C8BFF",
    borderRadius: 16,
    paddingVertical: 16,
    alignItems: "center",
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
  buttonDisabled: {
    opacity: 0.45,
  },
  buttonText: {
    color: "#0B0D12",
    fontSize: 16,
    fontWeight: "800",
  },
  secondaryButtonText: {
    color: "#E8ECF3",
    fontSize: 15,
    fontWeight: "700",
  },
  loadingBox: {
    paddingVertical: 18,
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
  },
  loadingText: {
    color: "#A8B0BD",
    fontSize: 14,
  },
  reinforcementText: {
    color: "#A8B0BD",
    fontSize: 14,
    lineHeight: 20,
    marginTop: 8,
    marginBottom: 20,
  },
  section: {
    backgroundColor: "#0F131B",
    borderWidth: 1,
    borderColor: "#232938",
    borderRadius: 16,
    padding: 16,
    marginBottom: 14,
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
    fontSize: 15,
    lineHeight: 24,
  },
  anchorBox: {
    backgroundColor: "#171D2B",
    borderWidth: 1,
    borderColor: "#7C8BFF",
    borderRadius: 20,
    padding: 22,
    marginBottom: 16,
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
    fontSize: 24,
    fontWeight: "800",
    textAlign: "center",
    lineHeight: 32,
  },
});