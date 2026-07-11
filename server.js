import express from "express";

const app = express();
app.use(express.json({ limit: "1mb" }));
app.use(express.static("."));

const TONS = {
  "professionnel et courtois": `Ton professionnel et courtois, registre standard de la correspondance de cabinet. Formules d'usage classiques.`,

  "amical et chaleureux, tout en restant professionnel": `Ton chaleureux et personnel. TU DOIS notamment :
- remplacer l'ouverture protocolaire par une ouverture cordiale (ex. "Chère cliente, cher client," ou "Bonjour," suivi d'une phrase d'attention sincère) ;
- remplacer la formule finale protocolaire ("Nous vous prions d'agréer...") par une clôture chaleureuse (ex. "Nous restons à vos côtés — au plaisir de vous lire," ou "Bien chaleureusement,") ;
- privilégier des tournures directes et positives ("nous serons ravis de", "n'hésitez surtout pas", "avec plaisir") ;
- alléger les lourdeurs administratives ("S'agissant de" → "Côté cotisations sociales", "Par ailleurs" → "Autre point important").`,

  "formel et solennel, adapté à une administration ou un courrier officiel": `Ton solennel : tournures impersonnelles, vocabulaire juridique précis, formules protocolaires complètes, aucune familiarité.`,

  "ferme mais courtois, adapté à une relance": `Ton ferme : rappels explicites des demandes antérieures, échéances mises en avant, conséquences d'un retard mentionnées factuellement, courtoisie maintenue mais sans adoucissement excessif.`,

  "rassurant et empathique, adapté à un client en difficulté": `Ton rassurant : reconnaître la situation sans dramatiser, insister sur l'accompagnement du cabinet et les solutions concrètes, formulations apaisantes ("nous allons avancer ensemble", "des solutions existent").`,

  "pédagogue et accessible, en vulgarisant les notions techniques": `Ton pédagogue : expliquer brièvement chaque notion technique entre parenthèses ou par une phrase simple, phrases courtes, exemples concrets si utile.`,

  "concis et factuel, en allant à l'essentiel": `Ton concis : phrases courtes, suppression des tournures de remplissage, une idée par phrase, réduire la longueur totale d'au moins 30 %.`
};

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
      const consigneTon = TONS[tonFinal] || TONS["professionnel et courtois"];
      systemPrompt =
`Tu reformules des emails professionnels rédigés par un expert-comptable français.

INVARIANTS ABSOLUS (priorité maximale) :
- Les montants, taux, dates, délais, références légales et noms propres sont conservés STRICTEMENT à l'identique.
- Le sens de chaque information est conservé : ne reformule jamais une phrase au point d'en changer la portée (qui fait quoi, qui doit transmettre quoi à qui).
- Les marqueurs de mise en forme (##, ###, >, !!, [[...]], **gras**) sont conservés tels quels.
- Conserve les formules de politesse de la correspondance professionnelle française, sans jamais devenir familier.

STYLE À APPLIQUER (dans le respect des invariants) :
${consigneTon}
Le ton doit être perceptible dès la première ligne. Les formules d'ouverture et de clôture DOIVENT être adaptées au ton demandé.

Réponds UNIQUEMENT avec le texte reformulé.`;
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
