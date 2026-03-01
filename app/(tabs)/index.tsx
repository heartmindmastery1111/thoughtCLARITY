import { useState } from "react";
import { StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";

export default function HomeScreen() {
  const [step, setStep] = useState(0);
  const [currentInput, setCurrentInput] = useState("");
  const [answers, setAnswers] = useState<string[]>([]);
const [result, setResult] = useState("");
const [loading, setLoading] = useState(false);
  const questions = [
    "What specifically feels heavy or threatening?",
    "What are you predicting will happen?",
    "If that happened, what would it mean about you?",
    "What objective evidence supports this happening right now?",
    "Is there a concrete action available right now?",
  ];

  const handleNext = () => {
    if (!currentInput.trim()) return;

    setAnswers([...answers, currentInput]);
    setCurrentInput("");

    if (step < questions.length - 1) {
      setStep(step + 1);
    } else {
      setStep(step + 1); // move past final step
    }
  };

  if (step >= questions.length) {

  const generateClarity = async () => {
    setLoading(true);
    try {
      const response = await fetch("http://localhost:3001/clarity", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ answers }),
      });

      const data = await response.json();
      setResult(data.result);
    } catch (error) {
      console.error(error);
    }
    setLoading(false);
  };

  return (
    <View style={styles.container}>
      <Text style={styles.question}>Clarity Analysis</Text>

      {result ? (
        <Text style={{ color: "white" }}>{result}</Text>
      ) : (
        <TouchableOpacity style={styles.button} onPress={generateClarity}>
          <Text style={styles.buttonText}>
            {loading ? "Analyzing..." : "Generate Clarity"}
          </Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

  return (
    <View style={styles.container}>
      <Text style={styles.progress}>
        Step {step + 1} of {questions.length}
      </Text>

      <Text style={styles.question}>
        {questions[step]}
      </Text>

      <TextInput
        style={styles.input}
        multiline
        value={currentInput}
        onChangeText={setCurrentInput}
        placeholder="Type here..."
        placeholderTextColor="#666"
      />

      <TouchableOpacity style={styles.button} onPress={handleNext}>
        <Text style={styles.buttonText}>Next</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#0f0f0f",
    padding: 24,
    justifyContent: "center",
  },
  progress: {
    color: "#666",
    marginBottom: 10,
  },
  question: {
    color: "white",
    fontSize: 20,
    marginBottom: 20,
  },
  input: {
    backgroundColor: "#1e1e1e",
    color: "white",
    padding: 16,
    borderRadius: 12,
    minHeight: 120,
    textAlignVertical: "top",
  },
  button: {
    marginTop: 20,
    backgroundColor: "white",
    padding: 14,
    borderRadius: 12,
    alignItems: "center",
  },
  buttonText: {
    color: "black",
    fontWeight: "600",
  },
  response: {
    color: "#aaa",
    marginTop: 20,
  },
});