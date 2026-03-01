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

    const prompt = `
You are a calm, precise cognitive clarity engine.
No therapy tone. No fluff. No over-warmth.
Separate fact from interpretation.
Expose distortions without attacking.
Restore grounded thinking.

Here are the user's answers:
${answers.map((a, i) => `Q${i + 1}: ${a}`).join("\n")}

Provide a structured clarity response.
`;

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: prompt }],
    });

    res.json({ result: completion.choices[0].message.content });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Something went wrong" });
  }
});

app.listen(3001, () => {
  console.log("Server running on http://localhost:3001");
});