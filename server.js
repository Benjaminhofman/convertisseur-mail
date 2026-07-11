require('dotenv').config();
const express = require('express');
const OpenAI = require('openai');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static(__dirname));

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

app.post('/api/reformuler', async (req, res) => {
  const texte = (req.body.texte || '').trim();
  if (!texte) {
    return res.status(400).json({ erreur: 'Texte manquant.' });
  }

  try {
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      temperature: 0.5,
      messages: [
        {
          role: 'system',
          content:
            "Tu es un assistant qui reformule des mails professionnels en français pour un cabinet d'expertise comptable. " +
            "Reformule le texte fourni pour le rendre plus clair, plus professionnel et courtois, en conservant les paragraphes " +
            "et le sens d'origine. Ne réponds qu'avec le texte reformulé, sans commentaire ni guillemets."
        },
        { role: 'user', content: texte }
      ]
    });
    const resultat = completion.choices[0].message.content.trim();
    res.json({ texte: resultat });
  } catch (err) {
    console.error(err);
    res.status(500).json({ erreur: 'Échec de la reformulation.' });
  }
});

app.listen(PORT, () => {
  console.log(`Serveur démarré sur http://localhost:${PORT}`);
});
