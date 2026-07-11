import express from "express";

const app = express();
app.use(express.json({ limit: "1mb" }));
app.use(express.static("."));

app.post("/api/reformuler", async (req, res) => {
  try {
    const { texte, ton } = req.body || {};
    if (!texte || !String(texte).trim())
      return res.status(400).json({ error: "Texte manquant." });
    if (String(texte).length > 15000)
      return res.status(400).json({ error: "Texte trop long (max 15 000 caractères)." });

    const cle = process.env.OPENAI_API_KEY;
    if (!cle)
      return res.status(500).json({ error: "Clé API non configurée sur le serveur." });

    const tonFinal = (ton && String(ton).trim()) || "professionnel et courtois";

    const r = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer " + cle
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        temperature: 0.7,
        messages: [
          {
            role: "system",
            content:
`Tu reformules des emails professionnels rédigés par un expert-comptable français.
Améliore la clarté, la structure et l'orthographe en conservant STRICTEMENT le sens, les montants, les dates et les délais.
Conserve tels quels les marqueurs de mise en forme en début de ligne (##, ###, >, !!, [[...]]) et les **gras**.
Conserve les formules de politesse de la correspondance professionnelle française, sans jamais devenir familier.
Réponds UNIQUEMENT avec le texte reformulé, sans préambule ni commentaire.

CONSIGNE DE TON IMPÉRATIVE : rédige l'ensemble du mail sur un ton ${tonFinal}. Le ton doit être clairement perceptible dès la première phrase.`
          },
          { role: "user", content: "Texte à reformuler :\n\n" + texte }
        ]
      })
    });

    const data = await r.json();
    if (!r.ok) {
      const msg = r.status === 401 ? "Clé API invalide ou expirée."
        : r.status === 429 ? "Quota OpenAI dépassé — réessayez dans un instant."
        : (data.error && data.error.message) || "Erreur OpenAI.";
      return res.status(r.status).json({ error: msg });
    }
    return res.json({ texte: data.choices[0].message.content.trim() });
  } catch (e) {
    return res.status(500).json({ error: "Erreur serveur : " + e.message });
  }
});

app.listen(process.env.PORT || 3000);
