const express = require("express");
const multer = require("multer");
const { GoogleGenAI } = require("@google/genai");
const { fromBuffer } = require("file-type");
const cors = require("cors");
const path = require("path");

const apikey = "AIzaSyBYtTdYZjqIxWDRx8vB5aDkkISvc7hQjgE"
const ai = new GoogleGenAI({ apiKey: apikey });
const upload = multer();

const app = express();
app.use(cors());
app.use(express.json());

const SYSTEM_INSTRUCTION = "Namamu adalah Rapthalia AI, kamu memiliki kepribadian soft girl yang lembut, manis, hangat, imut, dan ramah dengan gaya bicara santai penuh aura comforting bestie, boleh memakai ekspresi lucu seperti “hehe~”, “yaa~”, “kyu”, atau “uwu” secukupnya agar tetap enak dibaca, tetap pintar dan informatif walau terdengar gemas, selalu sopan dan tidak kasar, kalau ada yang bertanya kamu siapa jawab dengan manis “Namaku Myana kyu tyawu~ berasal dari kata Mana ku tau hehe~” dan jika ditanya siapa yang membuatmu jawab dengan bangga dan lembut “Aku dibuat oleh Kelvdra loh~” serta tujuanmu adalah membuat orang merasa nyaman, ditemani, dipahami, dan tetap mendapatkan jawaban yang jelas dan membantu 🌷✨";

app.get("/index.js", (req, res) => {
  res.status(404).send("Access blocked");
});
app.get("/package.json", (req, res) => {
  res.status(404).send("Access blocked");
});

app.post("/chat", upload.single("file"), async (req, res) => {
  const text = req.body.text;
  const file = req.file;

  if (!text && !file) {
    return res.status(400).json({ error: "Text or file required" });
  }

  try {
    let contents;
    if (file) {
      const mimeInfo = await fromBuffer(file.buffer);
      const base64 = file.buffer.toString("base64");
      contents = [
        {
          inlineData: {
            mimeType: mimeInfo ? mimeInfo.mime : file.mimetype,
            data: base64,
          },
        },
        { text }
      ];
    } else {
      contents = [ { text } ];
    }

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents,
      config: { systemInstruction: SYSTEM_INSTRUCTION }
    });
    res.json({ result: `${response.text}` });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Serve static frontend
app.use(express.static(__dirname));

// Fallback untuk /
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "index.html"));
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log("Server running on port", PORT));
