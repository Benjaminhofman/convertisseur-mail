import express from "express";

const app = express();
app.use(express.json({ limit: "1mb" }));
app.use(express.static("."));

app.post("/api/reformuler", async (req, res) => {
  try {
    const { texte, ton, action } = req.body || {};
    if (!texte || !String(texte).trim())
      return res.status(400).json({ error: "Texte manquant." });
    if (String(texte).length > 15000)
      return res.status(400).json({ error: "Texte trop long (max 15 000 caractères)." });

    const cle = process.env.OPENAI_API_KEY;
    if (!cle)
      return res.status(500).json({ error: "Clé API non configurée sur le serveur." });

    const actionFinale = action === "emojis" ? "emojis" : "reformuler";

    let systemPrompt, temperature, userPrefix;
    if (actionFinale === "emojis") {
      systemPrompt =
`Tu ajoutes des émojis dans un email professionnel rédigé par un expert-comptable français.
RÈGLES STRICTES :
- Ne modifie RIEN au texte : pas un mot, pas une virgule, pas un chiffre. Tu ne fais qu'INSÉRER des émojis.
- Insère un émoji pertinent en fin de certains intertitres (lignes commençant par ## ou ###) et éventuellement en fin de quelques phrases clés du corps.
- Maximum 1 émoji par paragraphe et 8 émojis au total. La sobriété prime : mieux vaut trop peu que trop.
- Émojis adaptés au contexte professionnel et comptable : 📅 ⏰ 📊 📈 ✅ ⚠️ 💡 📌 🧾 ✉️ 🤝. Jamais d'émojis fantaisistes ou familiers.
- Conserve tels quels les marqueurs ##, ###, >, !!, [[...]] et les **gras**.
- Réponds UNIQUEMENT avec le texte enrichi, sans commentaire.`;
      temperature = 0.4;
      userPrefix = "Texte à enrichir d'émojis :\n\n";
    } else {
      const tonFinal = (ton && String(ton).trim()) || "professionnel et courtois";
      systemPrompt =
`Tu reformules des emails professionnels rédigés par un expert-comptable français.
Améliore la clarté, la structure et l'orthographe en conservant STRICTEMENT le sens, les montants, les dates et les délais.
Conserve tels quels les marqueurs de mise en forme en début de ligne (##, ###, >, !!, [[...]]) et les **gras**.
Conserve les formules de politesse de la correspondance professionnelle française, sans jamais devenir familier.
Réponds UNIQUEMENT avec le texte reformulé, sans préambule ni commentaire.

CONSIGNE DE TON IMPÉRATIVE : rédige l'ensemble du mail sur un ton ${tonFinal}. Le ton doit être clairement perceptible dès la première phrase.`;
      temperature = 0.7;
      userPrefix = "Texte à reformuler :\n\n";
    }

    const r = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer " + cle
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        temperature,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrefix + texte }
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
