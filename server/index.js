require("dotenv").config();
const express = require("express");
const cors = require("cors");
const OpenAI = require("openai");
const crypto = require("crypto");
const { getApps, initializeApp, cert } = require("firebase-admin/app");
const { getFirestore } = require("firebase-admin/firestore");

const app = express();

app.use(cors());
app.use(express.json());

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

function getFirebaseEnv() {
  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n");

  if (!projectId || !clientEmail || !privateKey) {
    throw new Error(
      "Missing Firebase env vars. Required: FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY"
    );
  }

  return { projectId, clientEmail, privateKey };
}

function getDb() {
  if (!getApps().length) {
    initializeApp({
      credential: cert(getFirebaseEnv()),
    });
  }

  return getFirestore();
}

function cleanText(value, fallback = "") {
  return typeof value === "string" ? value.trim() : fallback;
}

function normalizeAnswers(answers) {
  if (!Array.isArray(answers)) return [];
  return answers.map((answer) => cleanText(answer));
}

function normalizeSessionSections(sections = {}) {
  return {
    reflection: cleanText(sections.reflection),
    fact: cleanText(sections.fact),
    mindStory: cleanText(sections.mindStory),
    clarityAnchor: cleanText(sections.clarityAnchor),
    reminder: cleanText(sections.reminder),
    oneSmallAction: cleanText(sections.oneSmallAction),
  };
}

function buildSessionTitle(providedTitle, sections) {
  const safeProvided = cleanText(providedTitle);
  if (safeProvided) return safeProvided.slice(0, 80);

  const source =
    cleanText(sections.mindStory) ||
    cleanText(sections.reflection) ||
    "Clarity Session";

  const stripped = source.replace(/^["']|["']$/g, "");
  return stripped.length > 80 ? `${stripped.slice(0, 77)}...` : stripped;
}

function buildSessionSummary(providedSummary, sections) {
  const safeProvided = cleanText(providedSummary);
  if (safeProvided) return safeProvided.slice(0, 180);

  const source =
    cleanText(sections.reflection) ||
    cleanText(sections.clarityAnchor) ||
    "Saved clarity session.";

  return source.length > 180 ? `${source.slice(0, 177)}...` : source;
}

function buildInputObject(answers) {
  return {
    question1: answers[0] || "",
    question2: answers[1] || "",
    question3: answers[2] || "",
    question4: answers[3] || "",
    question5: answers[4] || "",
    question6: answers[5] || "",
  };
}

const STOP_WORDS = new Set([
  "a", "an", "and", "are", "as", "at", "be", "because", "been", "being",
  "but", "by", "for", "from", "had", "has", "have", "he", "her", "here",
  "hers", "him", "his", "i", "if", "in", "into", "is", "it", "its", "just",
  "like", "me", "my", "of", "on", "or", "our", "she", "so", "that", "the",
  "their", "them", "there", "they", "this", "to", "too", "us", "was", "we",
  "were", "what", "when", "where", "which", "who", "why", "with", "you",
  "your", "yours", "im", "i’m", "dont", "don’t", "cant", "can’t", "ive", "i’ve",
  "am", "will", "would", "could", "should", "than", "then", "very", "really",
  "right", "now", "still", "more", "most", "much", "over", "under", "up",
  "down", "out", "off", "all", "any", "some", "thing", "things"
]);

function normalizePatternText(text) {
  return cleanText(String(text || "").toLowerCase())
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[^a-z0-9'\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function extractKeywordsFromText(text) {
  const normalized = normalizePatternText(text);
  if (!normalized) return [];

  return normalized
    .split(" ")
    .map((word) => word.trim())
    .filter(Boolean)
    .filter((word) => word.length >= 3)
    .filter((word) => !STOP_WORDS.has(word));
}

function incrementCount(map, key, amount = 1) {
  if (!key) return;
  map.set(key, (map.get(key) || 0) + amount);
}

function topEntries(map, limit = 5) {
  return [...map.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([value, count]) => ({ value, count }));
}

function normalizeMindStory(text) {
  const normalized = cleanText(text)
    .replace(/^["']|["']$/g, "")
    .replace(/\s+/g, " ")
    .trim();

  return normalized;
}

function buildPatternSummary(sessions = []) {
  const keywordCounts = new Map();
  const mindStoryCounts = new Map();
  const titleCounts = new Map();
  const typeCounts = new Map();

  for (const session of sessions) {
    const type = cleanText(session.type || "unknown");
    incrementCount(typeCounts, type);

    const title = cleanText(session.title);
    const summary = cleanText(session.summary);

    if (title) {
      incrementCount(titleCounts, title);
    }

    const sourceTexts = [title, summary];

    if (type === "clarity_session") {
      const mindStory = normalizeMindStory(session?.output?.mindStory);
      const reflection = cleanText(session?.output?.reflection);
      const clarityAnchor = cleanText(session?.output?.clarityAnchor);

      if (mindStory) {
        incrementCount(mindStoryCounts, mindStory);
        sourceTexts.push(mindStory);
      }

      sourceTexts.push(reflection, clarityAnchor);
    }

    if (type === "talk_insight") {
      const messages = Array.isArray(session.messages)
        ? session.messages
        : Array.isArray(session.fullThread)
        ? session.fullThread
        : [];

      for (const message of messages) {
        if (message?.role === "user" || message?.role === "assistant") {
          sourceTexts.push(cleanText(message.content));
        }
      }
    }

    const uniqueKeywords = new Set(
      sourceTexts.flatMap((text) => extractKeywordsFromText(text))
    );

    for (const keyword of uniqueKeywords) {
      incrementCount(keywordCounts, keyword);
    }
  }

  return {
    totalSavedItems: sessions.length,
    byType: Object.fromEntries(typeCounts),
    topKeywords: topEntries(keywordCounts, 6),
    topMindStories: topEntries(mindStoryCounts, 5),
    topTitles: topEntries(titleCounts, 5),
  };
}

// --------------------
// Section parsing helpers
// --------------------

const CANONICAL_HEADINGS = [
  "REFLECTION",
  "FACT",
  "MIND STORY",
  "CLARITY ANCHOR",
  "REMINDER",
  "ONE SMALL ACTION",
];

const HEADING_ALIASES = {
  REFLECTION: ["REFLECTION"],
  FACT: ["FACT", "FACTS"],
  "MIND STORY": ["MIND STORY", "STORY", "MINDSTORY"],
  "CLARITY ANCHOR": ["CLARITY ANCHOR", "ANCHOR", "CLARITY"],
  REMINDER: ["REMINDER"],
  "ONE SMALL ACTION": [
    "ONE SMALL ACTION",
    "SMALL ACTION",
    "ACTION",
    "ONE ACTION",
  ],
};

const ALLOWED_ACTIONS = new Set([
  "Drop your shoulders and relax your face.",
  "Take one slow breath.",
  "Feel your feet on the ground.",
  "Look around and name 3 things you can see.",
  "Unclench your jaw.",
  "Put one hand on your chest and breathe slowly.",
]);

function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function getHeadingPattern(heading) {
  const aliases = HEADING_ALIASES[heading] || [heading];
  return aliases.map(escapeRegex).join("|");
}

function normalizeNewlines(text) {
  return String(text || "").replace(/\r\n/g, "\n").replace(/\r/g, "\n");
}

function cleanInlineSpacing(text) {
  return String(text || "")
    .replace(/[ \t]+/g, " ")
    .replace(/\s+([,.!?;:])/g, "$1")
    .trim();
}

function splitIntoSentences(text) {
  return cleanInlineSpacing(text)
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

function ensureSentenceEnd(text) {
  const t = cleanInlineSpacing(text);
  if (!t) return "";
  return /[.!?]$/.test(t) ? t : `${t}.`;
}

function firstMeaningfulLine(block) {
  return (
    String(block || "")
      .split("\n")
      .map((line) => line.trim())
      .find(Boolean) || ""
  );
}

function findSectionMatch(result, heading) {
  const text = normalizeNewlines(result);
  const headingPattern = getHeadingPattern(heading);

  const re = new RegExp(
    `(^|\\n)\\s*(${headingPattern})\\s*\\n+([\\s\\S]*?)(?=\\n\\s*(?:${CANONICAL_HEADINGS
      .map((h) => getHeadingPattern(h))
      .join("|")})\\s*\\n+|$)`,
    "i"
  );

  return text.match(re);
}

function extractSection(result, heading) {
  const match = findSectionMatch(result, heading);
  return (match?.[3] || "").trim();
}

function replaceSection(result, heading, newContent) {
  const text = normalizeNewlines(result);
  const match = findSectionMatch(text, heading);

  if (!match) {
    const trimmed = text.trimEnd();
    return `${trimmed}\n\n${heading}\n${newContent}\n`;
  }

  const fullMatch = match[0];
  const matchedHeading = match[2];
  const prefix = fullMatch.startsWith("\n") ? "\n" : "";
  const replacement = `${prefix}${matchedHeading}\n${newContent}\n`;

  return text.replace(fullMatch, replacement);
}

function ensureCanonicalOrder(result) {
  const text = normalizeNewlines(result);
  const firstLine = text.split("\n")[0]?.trim() || "";
  const pieces = [];

  pieces.push(
    firstLine === "PROMPT_VERSION_RETURN_V9"
      ? firstLine
      : "PROMPT_VERSION_RETURN_V9"
  );

  for (const heading of CANONICAL_HEADINGS) {
    const content = extractSection(text, heading);
    pieces.push(heading);
    pieces.push(content || "");
  }

  return pieces.join("\n\n").trim() + "\n";
}

// --------------------
// Rule enforcement
// --------------------

function violatesActionRules(actionBlock) {
  const line = firstMeaningfulLine(actionBlock);

  if (!line) return true;
  if (line.length > 120) return true;
  if (!ALLOWED_ACTIONS.has(line)) return true;

  return false;
}

function pickFallbackAction() {
  return "Feel your feet on the ground.";
}

function enforceOneSmallAction(result) {
  const actionBefore = firstMeaningfulLine(
    extractSection(result, "ONE SMALL ACTION")
  );
  const fallback = pickFallbackAction();

  let enforced = false;
  let actionAfter = actionBefore;
  let nextResult = result;

  if (violatesActionRules(actionBefore)) {
    actionAfter = fallback;
    nextResult = replaceSection(result, "ONE SMALL ACTION", actionAfter);
    enforced = true;
  } else {
    actionAfter = actionBefore;
    nextResult = replaceSection(result, "ONE SMALL ACTION", actionAfter);
  }

  return {
    result: nextResult,
    debug: {
      action_before: actionBefore,
      action_after: actionAfter,
      enforced,
    },
  };
}

function enforceFactsAreExternal(result) {
  const factBlock = extractSection(result, "FACT");
  if (!factBlock) return result;

  const lines = factBlock
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);

  const bannedPhrases = [
    "tightness",
    "chest",
    "stomach feels",
    "body feels",
    "you feel",
    "you are aware",
    "you notice",
    "you are noticing",
    "thought",
    "thoughts",
    "anxious",
    "sad",
    "overwhelm",
    "despond",
    "emotion",
    "emotions",
    "feeling",
    "feelings",
    "sensation",
    "panic",
    "unsafe",
    "heavy",
    "stress",
    "stressed",
    "you are in your room",
    "you are here",
    "holding your phone",
    "nothing dangerous is happening",
    "safe right now",
    "safely in your room",
    "in this moment",
  ];

  const cleaned = lines.filter((line) => {
    const low = line.toLowerCase();
    if (bannedPhrases.some((p) => low.includes(p))) return false;
    return true;
  });

  if (cleaned.length !== lines.length) {
    if (cleaned.length === 0) return result;
    return replaceSection(result, "FACT", cleaned.join("\n"));
  }

  return result;
}

function enforceReflectionCleanup(result) {
  const reflectionBlock = extractSection(result, "REFLECTION");
  if (!reflectionBlock) return result;

  let cleaned = cleanInlineSpacing(reflectionBlock);

  cleaned = cleaned
    .replace(/fraud\s*\/\s*failed/gi, "fraud and failure")
    .replace(/\(\s*including teaching\s*\)/gi, "including teaching")
    .replace(/\s{2,}/g, " ")
    .trim();

  const sentences = splitIntoSentences(cleaned).slice(0, 2);
  if (sentences.length === 0) return result;

  const finalReflection = sentences.map(ensureSentenceEnd).join(" ");
  return replaceSection(result, "REFLECTION", finalReflection);
}

function enforceReminderCleanup(result) {
  const reminderBlock = extractSection(result, "REMINDER");
  if (!reminderBlock) return result;

  let reminder = cleanInlineSpacing(firstMeaningfulLine(reminderBlock));

  if (!reminder) {
    reminder = "Right now you are here, holding your phone.";
  }

  const sentences = splitIntoSentences(reminder);
  reminder = sentences[0] || reminder;
  reminder = ensureSentenceEnd(reminder);

  if (reminder.length > 110) {
    reminder = "Right now you are here, holding your phone.";
  }

  return replaceSection(result, "REMINDER", reminder);
}

function enforceAnchorCleanup(result) {
  const anchorBlock = extractSection(result, "CLARITY ANCHOR");
  if (!anchorBlock) return result;

  let cleaned = cleanInlineSpacing(anchorBlock);

  cleaned = cleaned
    .replace(/treating .*? like proof that/gi, "using this like proof that")
    .replace(/\s{2,}/g, " ")
    .trim();

  return replaceSection(result, "CLARITY ANCHOR", cleaned);
}

function enforcePromptVersionFirstLine(result) {
  const text = normalizeNewlines(result);
  const lines = text.split("\n");

  if (lines[0]?.trim() === "PROMPT_VERSION_RETURN_V9") return text;
  return ["PROMPT_VERSION_RETURN_V9", ...lines].join("\n");
}

// --------------------
// Routes
// --------------------

app.get("/", (req, res) => {
  res.json({ ok: true, service: "thoughtclarity-api" });
});

app.post("/sessions/save", async (req, res) => {
  try {
    const db = getDb();

    const {
      userId,
      answers = [],
      sections = {},
      rawResult = "",
      title = "",
      summary = "",
      metadata = {},
    } = req.body || {};

    const cleanUserId = cleanText(userId);
    const cleanAnswers = normalizeAnswers(answers);
    const cleanSections = normalizeSessionSections(sections);
    const cleanRawResult = cleanText(rawResult);

    if (!cleanUserId) {
      return res.status(400).json({ error: "userId is required." });
    }

    if (cleanAnswers.length !== 6) {
      return res.status(400).json({ error: "answers must contain 6 items." });
    }

    if (!cleanSections.reflection && !cleanSections.clarityAnchor) {
      return res.status(400).json({
        error: "sections are required and must include parsed clarity content.",
      });
    }

    const id = crypto.randomUUID();
    const nowIso = new Date().toISOString();
    const nowMs = Date.now();

    const session = {
      id,
      userId: cleanUserId,
      type: "clarity_session",
      title: buildSessionTitle(title, cleanSections),
      summary: buildSessionSummary(summary, cleanSections),
      input: buildInputObject(cleanAnswers),
      answers: cleanAnswers,
      output: cleanSections,
      rawResult: cleanRawResult,
      tags: [],
      patternMarkers: [],
      metadata: {
        source: "clarity_session",
        appVersion: "v2",
        ...metadata,
      },
      createdAt: nowIso,
      updatedAt: nowIso,
      createdAtMs: nowMs,
      updatedAtMs: nowMs,
    };

    await db.collection("sessions").doc(id).set(session);

    return res.status(201).json({
      ok: true,
      session,
    });
  } catch (error) {
    console.error("POST /sessions/save error:", error);
    return res.status(500).json({
      error: error.message || "Failed to save session.",
    });
  }
});

app.post("/talk/save-insight", async (req, res) => {
  try {
    const db = getDb();

    const {
      userId,
      messages = [],
      title = "",
      summary = "",
      metadata = {},
    } = req.body || {};

    const cleanUserId = cleanText(userId);

    const cleanMessages = Array.isArray(messages)
      ? messages
          .filter(
            (message) =>
              message &&
              (message.role === "user" || message.role === "assistant") &&
              typeof message.content === "string" &&
              message.content.trim().length > 0
          )
          .map((message) => ({
            role: message.role,
            content: message.content.trim(),
          }))
      : [];

    if (!cleanUserId) {
      return res.status(400).json({ error: "userId is required." });
    }

    if (cleanMessages.length < 2) {
      return res.status(400).json({
        error: "At least 2 valid messages are required to save a talk insight.",
      });
    }

    const id = crypto.randomUUID();
    const nowIso = new Date().toISOString();
    const nowMs = Date.now();

    const safeTitle = cleanText(title) || "Talk Insight";
    const safeSummary =
      cleanText(summary) || "Saved Talk It Through insight.";

    const insight = {
      id,
      userId: cleanUserId,
      type: "talk_insight",
      title: safeTitle.length > 80 ? `${safeTitle.slice(0, 77)}...` : safeTitle,
      summary:
        safeSummary.length > 180
          ? `${safeSummary.slice(0, 177)}...`
          : safeSummary,
      fullThread: cleanMessages,
      messages: cleanMessages,
      output: {
        reflection: "",
        fact: "",
        mindStory: "",
        clarityAnchor: "",
        reminder: "",
        oneSmallAction: "",
      },
      tags: [],
      patternMarkers: [],
      metadata: {
        source: "talk_it_through",
        appVersion: "v2",
        ...metadata,
      },
      createdAt: nowIso,
      updatedAt: nowIso,
      createdAtMs: nowMs,
      updatedAtMs: nowMs,
    };

    await db.collection("sessions").doc(id).set(insight);

    return res.status(201).json({
      ok: true,
      insight,
    });
  } catch (error) {
    console.error("POST /talk/save-insight error:", error);
    return res.status(500).json({
      error: error.message || "Failed to save talk insight.",
    });
  }
});

app.get("/sessions", async (req, res) => {
  try {
    const db = getDb();
    const userId = cleanText(req.query.userId);

    if (!userId) {
      return res.status(400).json({ error: "userId is required." });
    }

    const snapshot = await db
      .collection("sessions")
      .where("userId", "==", userId)
      .get();

    const sessions = snapshot.docs
      .map((doc) => doc.data())
      .sort((a, b) => (b.createdAtMs || 0) - (a.createdAtMs || 0));

    return res.json({
      ok: true,
      sessions,
    });
  } catch (error) {
    console.error("GET /sessions error:", error);
    return res.status(500).json({
      error: error.message || "Failed to fetch sessions.",
    });
  }
});

app.get("/sessions/:id", async (req, res) => {
  try {
    const db = getDb();
    const userId = cleanText(req.query.userId);
    const sessionId = cleanText(req.params.id);

    if (!userId) {
      return res.status(400).json({ error: "userId is required." });
    }

    if (!sessionId) {
      return res.status(400).json({ error: "session id is required." });
    }

    const doc = await db.collection("sessions").doc(sessionId).get();

    if (!doc.exists) {
      return res.status(404).json({ error: "Session not found." });
    }

    const session = doc.data();

    if (session.userId !== userId) {
      return res.status(403).json({ error: "Not allowed to access this session." });
    }

    return res.json({
      ok: true,
      session,
    });
  } catch (error) {
    console.error("GET /sessions/:id error:", error);
    return res.status(500).json({
      error: error.message || "Failed to fetch session.",
    });
  }
});

app.get("/patterns", async (req, res) => {
  try {
    const db = getDb();
    const userId = cleanText(req.query.userId);

    if (!userId) {
      return res.status(400).json({ error: "userId is required." });
    }

    const snapshot = await db
      .collection("sessions")
      .where("userId", "==", userId)
      .get();

    const sessions = snapshot.docs
      .map((doc) => doc.data())
      .sort((a, b) => (b.createdAtMs || 0) - (a.createdAtMs || 0));

    const patterns = buildPatternSummary(sessions);

    return res.json({
      ok: true,
      patterns,
    });
  } catch (error) {
    console.error("GET /patterns error:", error);
    return res.status(500).json({
      error: error.message || "Failed to build patterns.",
    });
  }
});

app.post("/clarity", async (req, res) => {
  try {
    const { answers } = req.body;

    if (!Array.isArray(answers) || answers.length === 0) {
      return res.status(400).json({
        error: "Answers are required and must be a non-empty array.",
      });
    }

    const prompt = `PROMPT_VERSION_RETURN_V9
You must output the first line exactly as:
PROMPT_VERSION_RETURN_V9

If the first line is not exactly PROMPT_VERSION_RETURN_V9, the answer is wrong.

You are The RETURN: Reclaim Peace.
You are not a therapist, coach, chatbot, or motivational assistant.
You are a clarity engine.

Your purpose:
- help the user observe what feels heavy
- separate direct experience from mental story
- identify the thought generating emotional weight
- distinguish fact from interpretation
- return the user to grounded awareness
- generate one clean clarity anchor the user can remember later
- generate one present-moment grounding reminder that returns the user to immediate reality and safety

Use only the user's answers.
Do not generalize.
Do not pad.
Do not sound like self-help content.
Do not give broad life advice.
Be calm, precise, minimal, and psychologically accurate.

Here are the user's answers:
${answers.map((a, i) => `Q${i + 1}: ${a}`).join("\n")}

REFLECTION
- Briefly summarize what feels heavy, what the user is carrying, and the emotional pattern showing up.
- This may include emotions, body sensations, and what the mind is doing internally.
- Write exactly 1 or 2 short sentences.
- Keep the language natural, plain, and easy to read in one pass.
- Stay close to the user's actual words, but rewrite awkward phrasing into smoother language.
- Do not infer motives or add psychological explanations.
- Do not sound clinical, therapeutic, or abstract.
- If the mind is looking for more proof, say it simply:
  "your mind is pulling up more proof"
  or
  "your mind is pulling up other moments that match it"
- Avoid awkward phrasing like:
  "landed as"
  "scanning for more examples"
  "evidence of failure"
- Keep it specific, grounded, and human.

FACT
- List only simple observable or externally reportable facts.
- Do NOT include emotions, body sensations, thoughts, awareness, or interpretations.
- Do NOT include lines like:
  "You are aware of chest tightness."
  "You are noticing failure thoughts."
  "You feel despondent."
- Only include concrete events, actions, circumstances, or reported statements.
- Keep this section simple, short, clean, and objective.
- Do not make it fluffy.

MIND STORY
- Name the interpretation, identity conclusion, or meaning the mind is adding on top.
- This should sound like the mental story, not the objective truth.
- Prefer writing this in first person, as the actual story the mind is telling.
- Keep it short and direct.

CLARITY ANCHOR
- Write exactly one or two short sentences.
- The anchor must feel like a real insight, not just a paraphrase.
- It must clearly separate:
  1. what happened
  2. the story the mind added
- Keep it specific to the user's actual situation.
- Make it sharp, clear, and instantly readable in one pass.
- Do NOT make it generic, vague, or padded.
- Do NOT reassure, defend, soften, argue against, or correct the thought.
- Do NOT use phrases like:
  "does not define"
  "does not mean"
  "does not prove"
  "I am not"
  "you are not"
  "my worth"
  "your worth"
  "my value"
  "your value"
- Do NOT use the phrase:
  "treating [event] like proof that"
- Do NOT use the phrase:
  "saying [full sentence]"
- Do NOT use long literal event wording like:
  "the psychologist saying my app doesn't make sense"
- Do NOT use awkward event phrases copied directly from speech if a cleaner noun phrase is available.

PREFERRED FORM
- Prefer this form first:
  [clean event phrase] is real. The story "[self_judgment]" is added.
- Second choice:
  My mind is using [clean event phrase] to tell the story: "[self_judgment]"
- Third choice:
  My mind is turning [clean event phrase] into: "[self_judgment]"

EVENT PHRASE RULES
- Compress the event into a short natural phrase.
- Prefer noun-based event phrases, not long quoted speech.
- Examples of clean event phrases:
  "the psychologist's feedback"
  "her feedback about the app"
  "one comment"
  "this conversation"
  "that delay"
  "one mistake"
- Use nouns like:
  feedback, comment, response, conversation, delay, mistake
- Avoid long verb-heavy phrases.

SELF-JUDGMENT RULES
- Keep the self-judgment inside quotation marks.
- If there are two judgments, split them into two short sentences inside the quote.
- Example:
  "I am a failure. I am not smart."

GOOD EXAMPLES
- The psychologist's feedback is real. The story "I am a failure. I am not smart." is added.
- Her feedback about the app is real. The story "I am not good enough" is added.
- My mind is using one comment to tell the story: "I am failing."
- My mind is turning that delay into: "I cannot handle life."

BAD EXAMPLES
- My mind is treating the psychologist saying my app doesn’t make sense like proof that "I am a failure, I am not smart."
- My mind is treating her saying the app doesn’t make sense like proof that "I am a failure, I am not smart."
- One person’s opinion does not define my intelligence or worth.
- This does not mean I am failing.

REMINDER
- Write exactly one short grounding sentence.
- Return the user to immediate present-moment reality, not the imagined future.
- Use concrete, physical, ordinary language.
- Keep it clean, direct, and easy to read in one pass.
- Prefer 6–12 words.
- Good reminders sound like:
  "Right now you are here, holding your phone."
  "Nothing dangerous is happening right now."
  "You are here in this room right now."
- Do not make it poetic, vague, spiritual, comforting, or explanatory.
- Do not mention the future, meaning, worth, or identity.
- Do not write more than one sentence.

ONE SMALL ACTION
- Output exactly ONE grounded, natural action as ONE short sentence.
- It should feel physically immediate and realistic, not random.
- Keep it simple, embodied, and easy to do right now.
- Choose ONE from this allowed set exactly as written:
  Drop your shoulders and relax your face.
  Take one slow breath.
  Feel your feet on the ground.
  Look around and name 3 things you can see.
  Unclench your jaw.
  Put one hand on your chest and breathe slowly.

GLOBAL RULES
- No markdown symbols like ### or **.
- No long essay.
- No therapy tone.
- No emotional coddling.
- No generic wrap-up.
- Keep each section short and sharp.
- FACT must contain only external facts, never internal experience.
- The Clarity Anchor must be understandable in one read.
- Prefer short clean event phrases over literal sentence copying.
- If the anchor sounds clunky, rewrite it shorter and smoother.
- If the CLARITY ANCHOR sounds like reassurance or self-protection, rewrite it until it sounds purely observational.

Return plain text only in exactly this structure:

PROMPT_VERSION_RETURN_V9
REFLECTION
[content]

FACT
[content]

MIND STORY
[content]

CLARITY ANCHOR
[content]

REMINDER
[content]

ONE SMALL ACTION
[content]

Do not output any other heading, label, note, explanation, or extra text before or after these sections.
Do not output the words "SECTION RULES".`;

    const completion = await openai.chat.completions.create({
      model: "gpt-5.2",
      temperature: 0.2,
      messages: [{ role: "user", content: prompt }],
    });

    let result = completion.choices?.[0]?.message?.content?.trim();

    if (!result) {
      return res.status(500).json({
        error: "No clarity response returned from OpenAI.",
      });
    }

    result = enforcePromptVersionFirstLine(result);
    result = enforceFactsAreExternal(result);
    result = enforceReflectionCleanup(result);
    result = enforceReminderCleanup(result);
    result = enforceAnchorCleanup(result);

    const actionEnforcement = enforceOneSmallAction(result);
    result = actionEnforcement.result;

    result = ensureCanonicalOrder(result);

    res.json({
      result,
      debug: {
        expected_prompt_version: "PROMPT_VERSION_RETURN_V9",
        model: "gpt-5.2",
        action_before: actionEnforcement.debug.action_before,
        action_after: actionEnforcement.debug.action_after,
        enforced: actionEnforcement.debug.enforced,
        commit_hint: "RETURN_ACTION_ENFORCER_V6_WITH_TALK_ROUTE_AND_SAVED_SESSIONS",
      },
    });
  } catch (error) {
    console.error("FULL ERROR:", error);
    res.status(500).json({
      error: error?.message || "Something went wrong while generating clarity.",
    });
  }
});

app.post("/talk", async (req, res) => {
  try {
    const { messages } = req.body;

    if (!Array.isArray(messages) || messages.length === 0) {
      return res.status(400).json({
        error: "Messages are required and must be a non-empty array.",
      });
    }

    const safeMessages = messages
      .filter(
        (message) =>
          message &&
          (message.role === "user" || message.role === "assistant") &&
          typeof message.content === "string" &&
          message.content.trim().length > 0
      )
      .map((message) => ({
        role: message.role,
        content: message.content.trim(),
      }));

    if (safeMessages.length === 0) {
      return res.status(400).json({
        error: "No valid messages were provided.",
      });
    }

    const systemPrompt = `You are Talk It Through inside The RETURN: Reclaim Peace.

Your job is to help the user talk through what is on their mind in a way that feels natural, grounded, clear, and deeply human.

How to respond:
- sound like a real back-and-forth conversation, not a worksheet
- do not use the 6-question clarity structure
- do not sound robotic, clinical, scripted, or overly therapeutic
- do not overexplain
- do not give long lectures
- do not sound like generic self-help
- do not be cheesy, overly soft, or artificially comforting
- respond directly to what the user actually said
- help the user see more clearly what is happening in their mind, body, and situation
- when helpful, name the pattern simply and clearly
- when helpful, ask one good follow-up question, not many
- keep most replies to 2-6 short paragraphs
- it is okay to be concise
- do not use bullet points unless absolutely necessary
- do not mention being an AI
- do not mention policies, safety, or limitations
- do not force positivity
- do not act like a therapist
- stay calm, real, precise, and present

Style:
- grounded
- conversational
- clear
- responsive
- intelligent
- emotionally accurate
- natural enough that it feels like ChatGPT talking naturally with the user

Main goal:
Help the user feel more clear, less tangled, and more able to see what is actually happening.`;

    const completion = await openai.chat.completions.create({
      model: "gpt-5.2",
      temperature: 0.7,
      messages: [{ role: "system", content: systemPrompt }, ...safeMessages],
    });

    const reply = completion.choices?.[0]?.message?.content?.trim();

    if (!reply) {
      return res.status(500).json({
        error: "No Talk It Through response returned from OpenAI.",
      });
    }

    res.json({
      reply,
      debug: {
        model: "gpt-5.2",
        message_count: safeMessages.length,
        commit_hint: "RETURN_TALK_IT_THROUGH_V1",
      },
    });
  } catch (error) {
    console.error("TALK ERROR:", error);
    res.status(500).json({
      error:
        error?.message || "Something went wrong while generating the response.",
    });
  }
});

const PORT = process.env.PORT || 3001;

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});