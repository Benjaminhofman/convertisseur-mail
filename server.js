import express from 'express';

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json({ limit: '1mb' }));
app.use(express.static('.'));

app.post('/api/reformuler', async (req, res) => {
  const texte = (req.body?.texte || '').trim();
  const ton = (req.body?.ton || '').trim() || 'professionnel et courtois';

  if (!texte || texte.length > 15000) {
    return res.status(400).json({ error: 'Texte manquant ou trop long.' });
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'Clé API non configurée sur le serveur.' });
  }

  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        temperature: 0.4,
        messages: [
          {
            role: 'system',
            content:
              "Tu reformules des emails professionnels rédigés par un expert-comptable français. Améliore la clarté, la structure et " +
              "l'orthographe en conservant STRICTEMENT le sens, les montants, les dates et les délais. Conserve tels quels les marqueurs " +
              "de mise en forme en début de ligne (##, ###, >, !!, [[...]]) et les **gras**. Adapte le ton selon la consigne. " +
              "Quel que soit le ton demandé, conserve les formules de politesse d'usage dans la correspondance professionnelle " +
              "française et ne rends jamais le propos familier. Réponds UNIQUEMENT avec le texte reformulé, sans préambule ni commentaire."
          },
          {
            role: 'user',
            content: `Consigne de ton : ${ton}. Texte à reformuler :\n\n${texte}`
          }
        ]
      })
    });

    const data = await response.json();

    if (!response.ok) {
      if (response.status === 401) {
        return res.status(401).json({ error: 'Clé API invalide.' });
      }
      if (response.status === 429) {
        return res.status(429).json({ error: 'Quota OpenAI dépassé.' });
      }
      return res.status(response.status).json({ error: data?.error?.message || 'Erreur lors de la reformulation.' });
    }

    res.json({ texte: data.choices[0].message.content.trim() });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erreur lors de la reformulation.' });
  }
});

app.listen(PORT, () => {
  console.log(`Serveur démarré sur http://localhost:${PORT}`);
});
