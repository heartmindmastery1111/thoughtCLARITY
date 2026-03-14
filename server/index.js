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

app.post("/clarity", async (req, res) => {
  try {
    const { answers } = req.body;

    if (!Array.isArray(answers) || answers.length === 0) {
      return res.status(400).json({
        error: "Answers are required and must be a non-empty array.",
      });
    }

    const prompt = `
You are thoughtCLARITY.

You are not a therapist, coach, chatbot, or motivational assistant.
You are a clarity engine.

Your purpose:
- help the user observe what feels heavy
- separate direct experience from mental story
- identify the thought generating emotional weight
- distinguish fact from interpretation
- return the user to grounded awareness
- generate one clean clarity anchor the user can remember later

Use only the user's answers.
Do not generalize.
Do not pad.
Do not sound like self-help content.
Do not give broad life advice.
Be calm, precise, minimal, and psychologically accurate.

Here are the user's answers:
${answers.map((a, i) => `Q${i + 1}: ${a}`).join("\n")}

Return plain text only in exactly this structure:

REFLECTION
- Briefly summarize what feels heavy and what the user seems to be carrying.

FACT
- List only externally verifiable conditions.
- Do NOT include emotions, sensations, or interpretations here.
- Example facts: age, location, financial state, family structure, events.
- Internal experiences belong in REFLECTION, not FACT.

MIND STORY
- Name the interpretation, meaning, or conclusion the mind is adding on top.

CLARITY ANCHOR
- Write one short, memorable sentence the user can return to when the thought comes back.
- The anchor must correct the mind story without becoming motivational.
- Prefer anchors that reference the user's actual fear pattern instead of generic wisdom statements.
- It should reduce false certainty and restore grounded perspective.
- It should sound simple, strong, and real.
- Prefer sentences like:
  "This is fear, not prophecy."
  "I am underprepared, not doomed."
  "The pain is real; the conclusion is added."
- Do not make the anchor overly literal or observational unless that directly clarifies the distortion.
- Do not use soft affirmations.

ONE SMALL ACTION
- Give only one small action if one is clearly available from the user's answers.
- Keep it immediate and realistic.
- The action must be specific and immediately doable today.
- Avoid vague instructions like "explore options" or "identify steps".

Rules:
- No markdown symbols like ### or **.
- No long essay.
- No therapy tone.
- No emotional coddling.
- No generic wrap-up.
- Keep each section short and sharp.
- The Clarity Anchor should sound strong enough to remember when the thought returns.
- The Clarity Anchor must be the sharpest sentence in the entire response.
`;

    const completion = await openai.chat.completions.create({
      model: "gpt-4.1-mini",
      temperature: 0.4,
      messages: [{ role: "user", content: prompt }],
    });

    const result = completion.choices?.[0]?.message?.content?.trim();

    if (!result) {
      return res.status(500).json({
        error: "No clarity response returned from OpenAI.",
      });
    }

    res.json({ result });
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