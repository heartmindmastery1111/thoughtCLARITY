require("dotenv").config();
const express = require("express");
const cors = require("cors");
const OpenAI = require("openai");

const app = express();

app.use(cors());
app.use(express.json());

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

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
  return String(block || "")
    .split("\n")
    .map((line) => line.trim())
    .find(Boolean) || "";
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
// Route
// --------------------

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
        commit_hint: "RETURN_ACTION_ENFORCER_V5",
      },
    });
  } catch (error) {
    console.error("FULL ERROR:", error);
    res.status(500).json({
      error: error?.message || "Something went wrong while generating clarity.",
    });
  }
});

app.listen(3001, () => {
  console.log("Server running on http://localhost:3001");
});