import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";

const STEPS = [
  {
    type: "question",
    label: "Current Question",
    text: "What feels most heavy in you right now?",
    answerIndex: 0,
    progressNumber: 1,
  },
  {
    type: "question",
    label: "Current Question",
    text: "What is happening inside you right now, in this moment?",
    answerIndex: 1,
    progressNumber: 2,
  },
  {
    type: "question",
    label: "Current Question",
    text: "Where do you feel it in your body?",
    answerIndex: 2,
    progressNumber: 3,
  },
  {
    type: "question",
    label: "Current Question",
    text: "What thought is your mind repeating about this?",
    answerIndex: 3,
    progressNumber: 4,
  },
  {
    type: "action",
    label: "Important Action",
    text: "Take a moment and breathe slowly for 3 breaths, making each exhale longer than the inhale, so that the next question can be answered clearly.",
    progressNumber: 4,
  },
  {
    type: "breathing",
    label: "Breath Cue",
    text: "Follow the breathing rhythm below.",
    progressNumber: 4,
  },
  {
    type: "question",
    label: "Current Question",
    text: "If you didn’t believe that thought for a moment, what would remain?",
    answerIndex: 4,
    progressNumber: 5,
  },
  {
    type: "question",
    label: "Current Question",
    text: "Is there one small action available to you right now?",
    answerIndex: 5,
    progressNumber: 6,
  },
] as const;

const API_URL = "https://thoughtclarity-api.onrender.com/clarity";

const BREATH_SEQUENCE = [
  { label: "Inhale", duration: 4000 },
  { label: "Exhale", duration: 6000 },
  { label: "Inhale", duration: 4000 },
  { label: "Exhale", duration: 6000 },
  { label: "Inhale", duration: 4000 },
  { label: "Exhale", duration: 6000 },
] as const;

export default function HomeScreen() {
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<string[]>(Array(6).fill(""));
  const [input, setInput] = useState("");
  const [result, setResult] = useState("");
  const [loading, setLoading] = useState(false);

  const [breathIndex, setBreathIndex] = useState(0);
  const [breathingComplete, setBreathingComplete] = useState(false);

  const currentStep = STEPS[step];
  const isLastStep = step === STEPS.length - 1;
  const progress = `${currentStep.progressNumber} / 6`;

  const currentBreathLabel = useMemo(() => {
    if (currentStep.type !== "breathing") return "";
    if (breathingComplete) return "Complete";
    return BREATH_SEQUENCE[breathIndex]?.label ?? "";
  }, [currentStep.type, breathIndex, breathingComplete]);

  useEffect(() => {
    if (currentStep.type !== "breathing") {
      setBreathIndex(0);
      setBreathingComplete(false);
      return;
    }

    if (breathingComplete) return;

    if (breathIndex >= BREATH_SEQUENCE.length) {
      setBreathingComplete(true);
      return;
    }

    const timer = setTimeout(() => {
      if (breathIndex === BREATH_SEQUENCE.length - 1) {
        setBreathingComplete(true);
      } else {
        setBreathIndex((prev) => prev + 1);
      }
    }, BREATH_SEQUENCE[breathIndex].duration);

    return () => clearTimeout(timer);
  }, [currentStep.type, breathIndex, breathingComplete]);

  const handleNext = () => {
    if (currentStep.type === "action") {
      const nextStep = step + 1;
      setStep(nextStep);
      setInput("");
      return;
    }

    if (currentStep.type === "breathing") {
      if (!breathingComplete) return;

      const nextStep = step + 1;
      setStep(nextStep);

      if (STEPS[nextStep].type === "question") {
        const nextAnswerIndex = STEPS[nextStep].answerIndex;
        setInput(answers[nextAnswerIndex] || "");
      } else {
        setInput("");
      }
      return;
    }

    if (!input.trim()) return;

    const updated = [...answers];
    updated[currentStep.answerIndex] = input.trim();
    setAnswers(updated);

    if (isLastStep) {
      generateClarity(updated);
      return;
    }

    const nextStep = step + 1;
    setStep(nextStep);

    if (STEPS[nextStep].type === "question") {
      const nextAnswerIndex = STEPS[nextStep].answerIndex;
      setInput(updated[nextAnswerIndex] || "");
    } else {
      setInput("");
    }
  };

  const handleBack = () => {
    if (step === 0) return;

    const updated = [...answers];

    if (currentStep.type === "question") {
      updated[currentStep.answerIndex] = input;
    }

    const previousStep = step - 1;
    setAnswers(updated);
    setStep(previousStep);

    if (STEPS[previousStep].type === "question") {
      const previousAnswerIndex = STEPS[previousStep].answerIndex;
      setInput(updated[previousAnswerIndex] || "");
    } else {
      setInput("");
    }
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
    setAnswers(Array(6).fill(""));
    setInput("");
    setResult("");
    setLoading(false);
    setBreathIndex(0);
    setBreathingComplete(false);
  };

  if (result) {
    const sections: Record<string, string> = {
      reflection: "",
      fact: "",
      mindStory: "",
      clarityAnchor: "",
      reminder: "",
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
      else if (normalizedLine === "REMINDER") current = "reminder";
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

          <View style={styles.reminderBox}>
            <Text style={styles.reminderLabel}>Reminder</Text>
            <Text style={styles.reminderText}>{sections.reminder}</Text>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>One Small Action</Text>
            <Text style={styles.sectionText}>{sections.oneSmallAction}</Text>
          </View>

          <View style={styles.noticeBox}>
            <Text style={styles.noticeText}>
              Notice what changes in your body when you read the clarity anchor.
            </Text>
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
                {
                  width: `${(currentStep.progressNumber / 6) * 100}%`,
                },
              ]}
            />
          </View>
        </View>

        <View
          style={
            currentStep.type === "action" || currentStep.type === "breathing"
              ? styles.actionBox
              : styles.questionBox
          }
        >
          <Text style={styles.questionLabel}>{currentStep.label}</Text>
          <Text
            style={
              currentStep.type === "action" || currentStep.type === "breathing"
                ? styles.actionText
                : styles.questionText
            }
          >
            {currentStep.text}
          </Text>
        </View>

        {currentStep.type === "question" ? (
          <TextInput
            style={styles.input}
            placeholder="Type your answer here..."
            placeholderTextColor="#7A7F8A"
            multiline
            value={input}
            onChangeText={setInput}
            textAlignVertical="top"
          />
        ) : currentStep.type === "action" ? (
          <View style={styles.actionInstructionBox}>
            <Text style={styles.actionInstructionText}>
              When you are ready to begin the 3 breaths, click the button below.
            </Text>
          </View>
        ) : (
          <View style={styles.breathingPanel}>
            <Text style={styles.breathingLabel}>Breath Cue</Text>
            <Text style={styles.breathingWord}>{currentBreathLabel}</Text>
            <Text style={styles.breathingSubtext}>
              {breathingComplete
                ? "You’ve completed 3 breaths. Click Next."
                : "Follow the word on the screen."}
            </Text>
          </View>
        )}

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
              style={[
                styles.button,
                ((currentStep.type === "question" && !input.trim()) ||
                  (currentStep.type === "breathing" && !breathingComplete)) &&
                  styles.buttonDisabled,
              ]}
              onPress={handleNext}
              disabled={
                (currentStep.type === "question" && !input.trim()) ||
                (currentStep.type === "breathing" && !breathingComplete)
              }
            >
              <Text style={styles.buttonText}>
                {currentStep.type === "action"
                  ? "I am ready"
                  : isLastStep
                  ? "Generate Clarity"
                  : "Next"}
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
  actionBox: {
    backgroundColor: "#171D2B",
    borderWidth: 1,
    borderColor: "#7C8BFF",
    borderRadius: 20,
    padding: 22,
    marginBottom: 16,
  },
  questionLabel: {
    color: "#7C8BFF",
    fontSize: 13,
    fontWeight: "700",
    marginBottom: 8,
    letterSpacing: 0.5,
    textTransform: "uppercase",
  },
  questionText: {
    color: "#F5F7FB",
    fontSize: 20,
    fontWeight: "700",
    lineHeight: 28,
  },
  actionText: {
    color: "#F5F7FB",
    fontSize: 24,
    fontWeight: "800",
    lineHeight: 34,
  },
  actionInstructionBox: {
    minHeight: 160,
    backgroundColor: "#0F131B",
    borderWidth: 1,
    borderColor: "#232938",
    borderRadius: 18,
    padding: 20,
    marginBottom: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  actionInstructionText: {
    color: "#E8ECF3",
    fontSize: 18,
    fontWeight: "700",
    lineHeight: 28,
    textAlign: "center",
  },
  breathingPanel: {
    minHeight: 160,
    backgroundColor: "#0F131B",
    borderWidth: 1,
    borderColor: "#232938",
    borderRadius: 18,
    padding: 20,
    marginBottom: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  breathingLabel: {
    color: "#7C8BFF",
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 1,
    textTransform: "uppercase",
    marginBottom: 14,
  },
  breathingWord: {
    color: "#F5F7FB",
    fontSize: 40,
    fontWeight: "800",
    lineHeight: 48,
    marginBottom: 14,
    textAlign: "center",
  },
  breathingSubtext: {
    color: "#E8ECF3",
    fontSize: 16,
    fontWeight: "600",
    lineHeight: 24,
    textAlign: "center",
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
  reminderBox: {
    backgroundColor: "#121A28",
    borderWidth: 1,
    borderColor: "#8FA8FF",
    borderRadius: 20,
    padding: 22,
    marginBottom: 16,
  },
  reminderLabel: {
    color: "#C5D0FF",
    fontSize: 12,
    fontWeight: "700",
    marginBottom: 10,
    textTransform: "uppercase",
    textAlign: "center",
  },
  reminderText: {
    color: "#F5F7FB",
    fontSize: 20,
    fontWeight: "700",
    textAlign: "center",
    lineHeight: 30,
  },
  noticeBox: {
    backgroundColor: "#171D2B",
    borderWidth: 1,
    borderColor: "#AEB8FF",
    borderRadius: 20,
    padding: 22,
    marginBottom: 20,
  },
  noticeText: {
    color: "#F5F7FB",
    fontSize: 24,
    fontWeight: "800",
    textAlign: "center",
    lineHeight: 32,
  },
});