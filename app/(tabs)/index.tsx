import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";

const QUESTIONS = [
  {
    label: "Question 1",
    text: "What feels heavy, uncomfortable, or upsetting right now?",
    example:
      "Example: “I’m feeling guilty about what happened.” / “I feel stressed about money.”",
    answerIndex: 0,
    progressNumber: 1,
  },
  {
    label: "Question 2",
    text: "What do you notice happening inside you right now?",
    example:
      "Example: “My thoughts are racing.” / “I feel anxious, sad, and overwhelmed.”",
    answerIndex: 1,
    progressNumber: 2,
  },
  {
    label: "Question 3",
    text: "Where do you feel this in your body?",
    example: "Example: “In my chest.” / “My stomach feels tight.”",
    answerIndex: 2,
    progressNumber: 3,
  },
  {
    label: "Question 4",
    text: "What thought keeps coming up about this situation?",
    example: "Example: “It’s my fault.” / “I’m not good enough.”",
    answerIndex: 3,
    progressNumber: 4,
  },
  {
    label: "Question 5",
    text: "If that thought became quieter for a moment, what would you notice instead?",
    example:
      "Example: “I would still be here feeling this emotion, but safely in my room.” / “I would just be here, feeling stressed, without the extra panic.”",
    answerIndex: 4,
    progressNumber: 5,
  },
  {
    label: "Question 6",
    text: "What is one small thing you can do right now?",
    example:
      "Example: “Take a few slow breaths.” / “Drink some water and sit down for a moment.”",
    answerIndex: 5,
    progressNumber: 6,
  },
] as const;

const API_URL = "https://thoughtclarity-api.onrender.com/clarity";

// 5 breaths total = 10 steps
// inhale 4s, exhale 6s
const BREATH_SEQUENCE = [
  { label: "Inhale", duration: 4000 },
  { label: "Exhale", duration: 6000 },
  { label: "Inhale", duration: 4000 },
  { label: "Exhale", duration: 6000 },
  { label: "Inhale", duration: 4000 },
  { label: "Exhale", duration: 6000 },
  { label: "Inhale", duration: 4000 },
  { label: "Exhale", duration: 6000 },
  { label: "Inhale", duration: 4000 },
  { label: "Exhale", duration: 6000 },
] as const;

const TOTAL_BREATHS = BREATH_SEQUENCE.filter(
  (step) => step.label === "Inhale"
).length;

type Screen =
  | "intro"
  | "breathe"
  | "reflect"
  | "loading"
  | "result"
  | "integrate";

type ParsedSections = {
  reflection: string;
  fact: string;
  mindStory: string;
  clarityAnchor: string;
  reminder: string;
  oneSmallAction: string;
};

export default function HomeScreen() {
  const [screen, setScreen] = useState<Screen>("intro");
  const [questionIndex, setQuestionIndex] = useState(0);
  const [answers, setAnswers] = useState<string[]>(Array(6).fill(""));
  const [input, setInput] = useState("");
  const [result, setResult] = useState("");
  const [loading, setLoading] = useState(false);

  const [breathIndex, setBreathIndex] = useState(0);
  const [breathingComplete, setBreathingComplete] = useState(false);
  const [countdown, setCountdown] = useState<number | null>(null);

  const breathWordOpacity = useRef(new Animated.Value(0)).current;
  const breathWordScale = useRef(new Animated.Value(1)).current;
  const breathCircleScale = useRef(new Animated.Value(1)).current;
  const breathGuideOpacity = useRef(new Animated.Value(1)).current;
  const breathingDoneOpacity = useRef(new Animated.Value(0)).current;

  const currentQuestion = QUESTIONS[questionIndex];
  const progress = `${currentQuestion.progressNumber} / 6`;

  const currentBreathLabel = useMemo(() => {
    if (screen !== "breathe") return "";
    if (breathingComplete) return "";
    return BREATH_SEQUENCE[breathIndex]?.label ?? "";
  }, [screen, breathIndex, breathingComplete]);

  const currentBreathInstruction = useMemo(() => {
    if (screen !== "breathe" || breathingComplete || countdown !== null) return "";
    return currentBreathLabel === "Inhale"
      ? "Breathe in through the nose"
      : "Exhale through the mouth";
  }, [screen, breathingComplete, countdown, currentBreathLabel]);

  const currentBreathNumber = useMemo(() => {
    if (breathingComplete) return TOTAL_BREATHS;
    return Math.min(Math.floor(breathIndex / 2) + 1, TOTAL_BREATHS);
  }, [breathIndex, breathingComplete]);

  useEffect(() => {
    if (screen !== "breathe") return;
    if (countdown === null) return;

    if (countdown <= 1) {
      const t = setTimeout(() => setCountdown(null), 1000);
      return () => clearTimeout(t);
    }

    const t = setTimeout(() => {
      setCountdown((c) => (c ? c - 1 : null));
    }, 1000);

    return () => clearTimeout(t);
  }, [screen, countdown]);

  useEffect(() => {
    if (screen !== "breathe") {
      setBreathIndex(0);
      setBreathingComplete(false);
      setCountdown(null);
      breathWordOpacity.setValue(0);
      breathWordScale.setValue(1);
      breathCircleScale.setValue(1);
      breathGuideOpacity.setValue(1);
      breathingDoneOpacity.setValue(0);
      return;
    }

    if (countdown !== null) return;

    if (breathingComplete) {
      Animated.timing(breathingDoneOpacity, {
        toValue: 1,
        duration: 450,
        useNativeDriver: true,
      }).start();
      return;
    }

    if (breathIndex >= BREATH_SEQUENCE.length) {
      setBreathingComplete(true);
      return;
    }

    const breathStep = BREATH_SEQUENCE[breathIndex];
    const isInhale = breathStep.label === "Inhale";

    breathWordOpacity.setValue(0);
    breathWordScale.setValue(isInhale ? 0.96 : 1.04);
    breathCircleScale.setValue(isInhale ? 0.84 : 1.1);

    if (breathIndex === 0) {
      Animated.timing(breathGuideOpacity, {
        toValue: 0.4,
        duration: 1400,
        useNativeDriver: true,
      }).start();
    }

    Animated.parallel([
      Animated.sequence([
        Animated.timing(breathWordOpacity, {
          toValue: 1,
          duration: 900,
          useNativeDriver: true,
        }),
        Animated.timing(breathWordOpacity, {
          toValue: 0.3,
          duration: Math.max(1200, breathStep.duration - 900),
          useNativeDriver: true,
        }),
      ]),
      Animated.timing(breathWordScale, {
        toValue: isInhale ? 1.06 : 0.95,
        duration: breathStep.duration,
        useNativeDriver: true,
      }),
      Animated.timing(breathCircleScale, {
        toValue: isInhale ? 1.16 : 0.88,
        duration: breathStep.duration,
        useNativeDriver: true,
      }),
    ]).start();

    const timer = setTimeout(() => {
      if (breathIndex === BREATH_SEQUENCE.length - 1) {
        Animated.parallel([
          Animated.timing(breathWordOpacity, {
            toValue: 0,
            duration: 350,
            useNativeDriver: true,
          }),
          Animated.timing(breathCircleScale, {
            toValue: 0.92,
            duration: 350,
            useNativeDriver: true,
          }),
        ]).start(() => {
          setBreathingComplete(true);
        });
      } else {
        setBreathIndex((prev) => prev + 1);
      }
    }, breathStep.duration);

    return () => {
      clearTimeout(timer);
      breathWordOpacity.stopAnimation();
      breathWordScale.stopAnimation();
      breathCircleScale.stopAnimation();
      breathGuideOpacity.stopAnimation();
      breathingDoneOpacity.stopAnimation();
    };
  }, [
    screen,
    countdown,
    breathIndex,
    breathingComplete,
    breathWordOpacity,
    breathWordScale,
    breathCircleScale,
    breathGuideOpacity,
    breathingDoneOpacity,
  ]);

  const startFlow = () => {
    setResult("");
    setAnswers(Array(6).fill(""));
    setInput("");
    setQuestionIndex(0);
    setBreathIndex(0);
    setBreathingComplete(false);
    setCountdown(3);
    setScreen("breathe");
  };

  const handleBreathingNext = () => {
    if (!breathingComplete) return;
    setScreen("reflect");
    setQuestionIndex(0);
    setInput(answers[0] || "");
  };

  const handleNextQuestion = () => {
    if (!input.trim()) return;

    const updated = [...answers];
    updated[currentQuestion.answerIndex] = input.trim();
    setAnswers(updated);

    const isLastQuestion = questionIndex === QUESTIONS.length - 1;

    if (isLastQuestion) {
      generateClarity(updated);
      return;
    }

    const nextIndex = questionIndex + 1;
    setQuestionIndex(nextIndex);
    setInput(updated[QUESTIONS[nextIndex].answerIndex] || "");
  };

  const handleBack = () => {
    if (screen === "intro" || screen === "loading") return;

    if (screen === "integrate") {
      setScreen("result");
      return;
    }

    if (screen === "result") {
      return;
    }

    if (screen === "breathe") {
      setScreen("intro");
      return;
    }

    if (screen === "reflect") {
      const updated = [...answers];
      updated[currentQuestion.answerIndex] = input;
      setAnswers(updated);

      if (questionIndex === 0) {
        setScreen("breathe");
        setInput("");
        return;
      }

      const previousIndex = questionIndex - 1;
      setQuestionIndex(previousIndex);
      setInput(updated[QUESTIONS[previousIndex].answerIndex] || "");
    }
  };

  const generateClarity = async (finalAnswers: string[]) => {
    setLoading(true);
    setScreen("loading");
    setResult("");

    try {
      await new Promise((resolve) => setTimeout(resolve, 1800));

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

      console.log("API_URL", API_URL);
      console.log("DEBUG", data.debug);
      console.log("FIRST_LINE", String(data.result || "").split("\n")[0]);

      setResult(
        typeof data.result === "string"
          ? data.result
          : JSON.stringify(data, null, 2)
      );
      setScreen("result");
    } catch (error) {
      setResult("Something went wrong while generating clarity.");
      setScreen("result");
    } finally {
      setLoading(false);
    }
  };

  const handleRestart = () => {
    setScreen("intro");
    setQuestionIndex(0);
    setAnswers(Array(6).fill(""));
    setInput("");
    setResult("");
    setLoading(false);
    setBreathIndex(0);
    setBreathingComplete(false);
    setCountdown(null);
    breathWordOpacity.setValue(0);
    breathWordScale.setValue(1);
    breathCircleScale.setValue(1);
    breathGuideOpacity.setValue(1);
    breathingDoneOpacity.setValue(0);
  };

  const parseSections = (rawResult: string): ParsedSections => {
    const sections: ParsedSections = {
      reflection: "",
      fact: "",
      mindStory: "",
      clarityAnchor: "",
      reminder: "",
      oneSmallAction: "",
    };

    const lines = rawResult
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean);

    let current: keyof ParsedSections | "" = "";

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

    return sections;
  };

  if (screen === "result" && result) {
    const sections = parseSections(result);

    const hasParsedSections = Object.values(sections).some(
      (value) => value.trim().length > 0
    );

    if (!hasParsedSections) {
      return (
        <ScrollView contentContainerStyle={styles.container}>
          <View style={styles.card}>
            <Text style={styles.eyebrow}>THE RETURN: RECLAIM PEACE</Text>
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
          <Text style={styles.eyebrow}>THE RETURN: RECLAIM PEACE</Text>
          <Text style={styles.title}>Your Clarity</Text>
          <Text style={styles.subtitle}>
            Read slowly. Let the clarity anchor land before moving on.
          </Text>

          <View style={styles.miniSection}>
            <Text style={styles.sectionTitle}>Reflection</Text>
            <Text style={styles.sectionText}>{sections.reflection}</Text>
          </View>

          <View style={styles.miniSection}>
            <Text style={styles.sectionTitle}>Fact</Text>
            <Text style={styles.sectionText}>{sections.fact}</Text>
          </View>

          <View style={styles.miniSection}>
            <Text style={styles.sectionTitle}>Mind Story</Text>
            <Text style={styles.sectionText}>{sections.mindStory}</Text>
          </View>

          <View style={styles.anchorBox}>
            <Text style={styles.anchorLabel}>Clarity Anchor</Text>
            <Text style={styles.anchorText}>{sections.clarityAnchor}</Text>
          </View>

          {!!sections.reminder.trim() && (
            <View style={styles.softBox}>
              <Text style={styles.softLabel}>Reminder</Text>
              <Text style={styles.softText}>{sections.reminder}</Text>
            </View>
          )}

          {!!sections.oneSmallAction.trim() && (
            <View style={styles.softBox}>
              <Text style={styles.softLabel}>One Small Action</Text>
              <Text style={styles.softText}>{sections.oneSmallAction}</Text>
            </View>
          )}

          <Text style={styles.noticeHelperText}>
            Notice what changes in your body when you read the clarity anchor.
          </Text>

          <TouchableOpacity
            style={styles.button}
            onPress={() => setScreen("integrate")}
          >
            <Text style={styles.buttonText}>
              Want to integrate or understand what happened?
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.secondaryActionButton}
            onPress={handleRestart}
          >
            <Text style={styles.secondaryActionButtonText}>Start Again</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    );
  }

  if (screen === "integrate") {
    return (
      <ScrollView contentContainerStyle={styles.container}>
        <View style={styles.card}>
          <Text style={styles.eyebrow}>THE RETURN: RECLAIM PEACE</Text>
          <Text style={styles.title}>Integrate</Text>
          <Text style={styles.subtitle}>
            This helps you understand the shift and close the loop.
          </Text>

          <View style={styles.integrateBox}>
            <Text style={styles.integrateTitle}>What just happened</Text>
            <Text style={styles.integrateText}>
              You started with something that felt heavy. Instead of reacting to
              it, you slowed down and looked at it. You saw the thought behind
              what you were feeling. And for a moment, you stepped back from it.
            </Text>
            <Text style={styles.integrateText}>
              That’s why things felt lighter.
            </Text>
            <Text style={styles.integrateText}>
              Not because the situation changed — but because you were no longer
              fully inside the thought.
            </Text>

            <Text style={styles.integrateTitle}>Why this works</Text>
            <Text style={styles.integrateText}>
              When a thought feels real, your body reacts as if it’s true. When
              you see it clearly, that reaction softens. Nothing needed to be
              fixed. You just saw what was happening.
            </Text>

            <Text style={styles.integrateTitle}>What to remember</Text>
            <Text style={styles.integrateBullet}>
              • The feeling is real — but the thought behind it isn’t always true
            </Text>
            <Text style={styles.integrateBullet}>
              • Clarity comes from seeing, not fixing
            </Text>
            <Text style={styles.integrateBullet}>
              • You are not your thoughts — you’re the one noticing them
            </Text>

            <Text style={styles.integrateClosing}>
              You can return to this whenever the thought comes back.
            </Text>
          </View>

          <View style={styles.buttonRow}>
            <TouchableOpacity
              style={styles.secondaryButton}
              onPress={() => setScreen("result")}
            >
              <Text style={styles.secondaryButtonText}>Back</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.button} onPress={handleRestart}>
              <Text style={styles.buttonText}>Start Again</Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    );
  }

  if (screen === "loading" || loading) {
    return (
      <ScrollView contentContainerStyle={styles.container}>
        <View style={styles.card}>
          <Text style={styles.eyebrow}>THE RETURN: RECLAIM PEACE</Text>
          <Text style={styles.title}>Analyzing clarity...</Text>
          <Text style={styles.subtitle}>
            Stay here for a moment while your reflection is processed.
          </Text>

          <View style={styles.loadingScreenBox}>
            <ActivityIndicator size="large" />
            <Text style={styles.loadingText}>Analyzing clarity...</Text>
          </View>
        </View>
      </ScrollView>
    );
  }

  if (screen === "intro") {
    return (
      <ScrollView contentContainerStyle={styles.container}>
        <View style={styles.card}>
          <Text style={styles.eyebrow}>THE RETURN: RECLAIM PEACE</Text>
          <Text style={styles.title}>What’s on your mind or heart?</Text>
          <Text style={styles.subtitle}>
            It guides you to identify what you’re feeling, notice the thought
            behind it, create distance from it, and return to peace.
          </Text>

          <View style={styles.infoBox}>
            <Text style={styles.infoText}>Breathe in through the nose.</Text>
            <Text style={styles.infoSpacer}> </Text>
            <Text style={styles.infoText}>Exhale through the mouth.</Text>
            <Text style={styles.infoSpacer}> </Text>
            <Text style={styles.infoText}>
              Did you know? A longer exhale can help your nervous system settle and relax.
            </Text>
            <Text style={styles.infoSpacer}> </Text>
            <Text style={styles.infoText}>
              Try 4 seconds in through the nose and 6 seconds out through the mouth.
            </Text>
          </View>

          <TouchableOpacity style={styles.button} onPress={startFlow}>
            <Text style={styles.buttonText}>Let&apos;s begin</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    );
  }

  if (screen === "breathe") {
    return (
      <ScrollView contentContainerStyle={styles.container}>
        <View style={styles.card}>
          <Text style={styles.eyebrow}>THE RETURN: RECLAIM PEACE</Text>
          <Text style={styles.title}>Breathe</Text>
          <Text style={styles.subtitle}>
            Settle first. Then reflect more clearly.
          </Text>

          <View style={styles.progressRow}>
            <Text style={styles.progressText}>Step 1 of 5</Text>
            <View style={styles.progressTrack}>
              <View style={[styles.progressFill, { width: "20%" }]} />
            </View>
          </View>

          <View style={styles.breathingPanel}>
            <Animated.Text
              style={[
                styles.breathingGuide,
                {
                  opacity: breathGuideOpacity,
                },
              ]}
            >
              Take {TOTAL_BREATHS} slow breaths.
            </Animated.Text>

            <Text style={styles.breathingLabel}>Breath Cue</Text>

            <View style={styles.breathVisualWrap}>
              <Animated.View
                style={[
                  styles.breathCircle,
                  {
                    opacity:
                      breathingComplete || countdown !== null
                        ? 0.18
                        : breathWordOpacity,
                    transform: [{ scale: breathCircleScale }],
                  },
                ]}
              />

              {countdown !== null ? (
                <Text style={styles.countdownText}>{countdown}</Text>
              ) : !breathingComplete ? (
                <Animated.Text
                  style={[
                    styles.breathingWord,
                    {
                      opacity: breathWordOpacity,
                      transform: [{ scale: breathWordScale }],
                    },
                  ]}
                >
                  {currentBreathLabel}
                </Animated.Text>
              ) : (
                <Animated.View
                  style={[
                    styles.breathingDoneWrap,
                    { opacity: breathingDoneOpacity },
                  ]}
                >
                  <Text style={styles.breathingDoneTitle}>You’re ready</Text>
                  <Text style={styles.breathingDoneText}>
                    Take this steadiness into the questions.
                  </Text>
                </Animated.View>
              )}
            </View>

            <Text style={styles.breathingInstruction}>
              {breathingComplete
                ? `You’ve completed ${TOTAL_BREATHS} breaths.`
                : countdown !== null
                ? "Get ready..."
                : currentBreathInstruction}
            </Text>

            <Text style={styles.breathingSubtext}>
              {breathingComplete
                ? "Click Next to continue."
                : countdown !== null
                ? "3... 2... 1..."
                : `Breath ${currentBreathNumber} of ${TOTAL_BREATHS}`}
            </Text>
          </View>

          <TouchableOpacity
            style={styles.skipButton}
            onPress={() => {
              setCountdown(null);
              setBreathingComplete(true);
              setBreathIndex(BREATH_SEQUENCE.length);
            }}
          >
            <Text style={styles.skipButtonText}>Skip for testing</Text>
          </TouchableOpacity>

          <View style={styles.buttonRow}>
            <TouchableOpacity
              style={styles.secondaryButton}
              onPress={handleBack}
            >
              <Text style={styles.secondaryButtonText}>Back</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.button,
                !breathingComplete && styles.buttonDisabled,
              ]}
              onPress={handleBreathingNext}
              disabled={!breathingComplete}
            >
              <Text style={styles.buttonText}>Next</Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <View style={styles.card}>
        <Text style={styles.eyebrow}>THE RETURN: RECLAIM PEACE</Text>
        <Text style={styles.title}>Reflect</Text>
        <Text style={styles.subtitle}>
          Answer what comes up. There are no right or wrong answers.{"\n"}
          This works best when you move through it slowly and honestly.{"\n"}
          Try to focus on what you are feeling and experiencing inside, not only
          the situation itself.
        </Text>

        <View style={styles.progressRow}>
          <Text style={styles.progressText}>Question {progress}</Text>
          <View style={styles.progressTrack}>
            <View
              style={[
                styles.progressFill,
                {
                  width: `${(currentQuestion.progressNumber / 6) * 100}%`,
                },
              ]}
            />
          </View>
        </View>

        <View style={styles.questionBox}>
          <Text style={styles.questionLabel}>{currentQuestion.label}</Text>
          <Text style={styles.questionText}>{currentQuestion.text}</Text>
          <Text style={styles.exampleText}>{currentQuestion.example}</Text>
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

        <View style={styles.buttonRow}>
          <TouchableOpacity style={styles.secondaryButton} onPress={handleBack}>
            <Text style={styles.secondaryButtonText}>Back</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.button, !input.trim() && styles.buttonDisabled]}
            onPress={handleNextQuestion}
            disabled={!input.trim()}
          >
            <Text style={styles.buttonText}>
              {questionIndex === QUESTIONS.length - 1
                ? "Generate Clarity"
                : "Next"}
            </Text>
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
  infoBox: {
    backgroundColor: "#0F131B",
    borderWidth: 1,
    borderColor: "#232938",
    borderRadius: 18,
    padding: 16,
    marginBottom: 18,
  },
  infoText: {
    color: "#E8ECF3",
    fontSize: 15,
    lineHeight: 23,
    textAlign: "center",
  },
  infoSpacer: {
    height: 10,
  },
  progressRow: {
    marginBottom: 16,
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
    padding: 16,
    marginBottom: 14,
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
    fontWeight: "800",
    lineHeight: 28,
    marginBottom: 10,
  },
  exampleText: {
    color: "#A8B0BD",
    fontSize: 15,
    lineHeight: 22,
    fontStyle: "italic",
  },
  input: {
    minHeight: 120,
    backgroundColor: "#0F131B",
    borderWidth: 1,
    borderColor: "#232938",
    borderRadius: 18,
    padding: 16,
    color: "#F5F7FB",
    fontSize: 16,
    marginBottom: 16,
  },
  breathingPanel: {
    minHeight: 300,
    backgroundColor: "#0F131B",
    borderWidth: 1,
    borderColor: "#232938",
    borderRadius: 18,
    padding: 18,
    marginBottom: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  breathingGuide: {
    color: "#A8B0BD",
    fontSize: 15,
    fontWeight: "600",
    marginBottom: 14,
    textAlign: "center",
  },
  breathingLabel: {
    color: "#7C8BFF",
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 1,
    textTransform: "uppercase",
    marginBottom: 10,
  },
  breathVisualWrap: {
    width: 220,
    height: 165,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 8,
  },
  breathCircle: {
    position: "absolute",
    width: 130,
    height: 130,
    borderRadius: 65,
    backgroundColor: "#7C8BFF",
  },
  countdownText: {
    color: "#FFFFFF",
    fontSize: 64,
    fontWeight: "900",
    textAlign: "center",
  },
  breathingWord: {
    color: "#FFFFFF",
    fontSize: 42,
    fontWeight: "800",
    lineHeight: 48,
    textAlign: "center",
  },
  breathingInstruction: {
    color: "#E8ECF3",
    fontSize: 16,
    fontWeight: "700",
    lineHeight: 22,
    textAlign: "center",
    marginTop: 6,
    marginBottom: 6,
  },
  breathingDoneWrap: {
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 12,
  },
  breathingDoneTitle: {
    color: "#F5F7FB",
    fontSize: 22,
    fontWeight: "800",
    textAlign: "center",
    marginBottom: 6,
  },
  breathingDoneText: {
    color: "#C9D2E3",
    fontSize: 14,
    lineHeight: 21,
    textAlign: "center",
  },
  breathingSubtext: {
    color: "#DCE2F0",
    fontSize: 14,
    fontWeight: "600",
    lineHeight: 21,
    textAlign: "center",
  },
  skipButton: {
    marginTop: 10,
    marginBottom: 12,
    backgroundColor: "#0F131B",
    borderWidth: 1,
    borderColor: "#232938",
    borderRadius: 14,
    paddingVertical: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  skipButtonText: {
    color: "#E8ECF3",
    fontSize: 14,
    fontWeight: "800",
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
    justifyContent: "center",
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
  secondaryActionButton: {
    marginTop: 12,
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
    textAlign: "center",
    paddingHorizontal: 12,
  },
  secondaryButtonText: {
    color: "#E8ECF3",
    fontSize: 15,
    fontWeight: "700",
  },
  secondaryActionButtonText: {
    color: "#E8ECF3",
    fontSize: 15,
    fontWeight: "700",
  },
  loadingScreenBox: {
    minHeight: 220,
    alignItems: "center",
    justifyContent: "center",
    gap: 14,
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
  noticeHelperText: {
    color: "#B8C1D6",
    fontSize: 14,
    lineHeight: 21,
    textAlign: "center",
    marginTop: 2,
    marginBottom: 16,
  },
  integrateBox: {
    backgroundColor: "#0F131B",
    borderWidth: 1,
    borderColor: "#232938",
    borderRadius: 18,
    padding: 18,
    marginBottom: 20,
  },
  integrateTitle: {
    color: "#7C8BFF",
    fontSize: 14,
    fontWeight: "800",
    marginBottom: 8,
    marginTop: 4,
  },
  integrateText: {
    color: "#E8ECF3",
    fontSize: 14,
    lineHeight: 22,
    marginBottom: 10,
  },
  integrateBullet: {
    color: "#E8ECF3",
    fontSize: 14,
    lineHeight: 22,
    marginBottom: 6,
  },
  integrateClosing: {
    color: "#F5F7FB",
    fontSize: 15,
    fontWeight: "800",
    lineHeight: 22,
    marginTop: 10,
  },
});