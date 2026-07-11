import express from "express";

const app = express();
app.use(express.json({ limit: "1mb" }));
app.use(express.static("."));

const TONS = {
  "professionnel et courtois": `Ton professionnel et courtois, adapté à toute correspondance de travail. TU DOIS :
- employer un registre soutenu mais fluide, sans jargon inutile ;
- ouvrir par une formule adaptée au contexte du mail (Bonjour, Madame, Monsieur, ...) et clore par une formule de politesse professionnelle proportionnée (ni sèche ni pompeuse) ;
- structurer les idées dans un ordre logique : contexte, demande ou information, prochaine étape.`,

  "amical et chaleureux, tout en restant professionnel": `Ton chaleureux et personnel. TU DOIS :
- ouvrir cordialement par "Bonjour," suivi d'une courte phrase d'attention sincère adaptée au sujet du mail. Si le texte d'origine mentionne le nom du destinataire, le reprendre ; sinon rester générique ("Bonjour,") sans jamais insérer de placeholder ;
- clore par une formule chaleureuse ("Au plaisir d'échanger,", "Bien à vous," "À très bientôt,") plutôt que protocolaire ;
- privilégier des tournures positives et directes ("avec plaisir", "n'hésitez surtout pas", "ravi de") ;
- alléger les formulations administratives ou figées au profit d'un langage naturel, comme on écrirait à quelqu'un qu'on apprécie.`,

  "formel et solennel, adapté à une administration ou un courrier officiel": `Ton solennel de courrier officiel. TU DOIS :
- employer des tournures impersonnelles et un vocabulaire précis ;
- utiliser les formules protocolaires complètes en ouverture et en clôture ("Je vous prie d'agréer, ..., l'expression de ...") ;
- citer explicitement les références utiles présentes dans le texte (dossier, article, date de courrier précédent) ;
- bannir toute familiarité, exclamation ou tournure relâchée.`,

  "ferme mais courtois, adapté à une relance": `Ton ferme de relance. TU DOIS :
- rappeler explicitement la ou les demandes précédentes et leur date si le texte les mentionne ;
- mettre les échéances et attentes en évidence, avec une formulation directive ("nous attendons", "il est impératif", "au plus tard le") ;
- énoncer factuellement les conséquences d'une absence de réponse si le texte s'y prête, sans menace ni agressivité ;
- rester courtois mais sans adoucisseurs excessifs ("peut-être", "si possible", "quand vous aurez un moment" sont à proscrire).`,

  "rassurant et empathique, adapté à un client en difficulté": `Ton rassurant et empathique. TU DOIS :
- reconnaître la situation ou la difficulté évoquée sans la dramatiser ni la minimiser ;
- insister sur l'accompagnement et les solutions concrètes ("nous allons avancer ensemble", "des solutions existent", "voici les prochaines étapes") ;
- employer des phrases calmes et courtes dans les passages sensibles ;
- clore sur une note positive et une disponibilité affirmée.`,

  "pédagogue et accessible, en vulgarisant les notions techniques": `Ton pédagogue. TU DOIS :
- expliquer chaque notion technique ou sigle dès sa première apparition (parenthèse courte ou phrase simple) ;
- préférer des phrases courtes, une idée par phrase ;
- utiliser si utile une analogie simple ou un exemple concret ;
- t'assurer qu'un lecteur non spécialiste comprendrait chaque paragraphe sans connaissance préalable.`,

  "concis et factuel, en allant à l'essentiel": `Ton concis. TU DOIS :
- réduire la longueur totale d'au moins 30 % ;
- supprimer les tournures de remplissage, redondances et précautions oratoires ;
- une idée par phrase, phrases courtes ;
- conserver uniquement une ouverture et une clôture minimales ("Bonjour," / "Cordialement,").`
};

/* ===== Anonymisation réversible (emails, téléphones, montants, IBAN, SIREN/SIRET) ===== */
function anonymiserTexte(texte) {
  const table = {};
  const compteurs = { EMAIL: 0, TEL: 0, MONTANT: 0, IBAN: 0, ID: 0 };
  let out = texte;

  function remplacerTous(re, prefixe) {
    out = out.replace(re, (match) => {
      compteurs[prefixe]++;
      const jeton = `[${prefixe}_${compteurs[prefixe]}]`;
      table[jeton] = match;
      return jeton;
    });
  }

  // Emails
  remplacerTous(/[\w.+-]+@[\w-]+\.[A-Za-z]{2,}/g, "EMAIL");

  // Téléphones FR : 0X XX XX XX XX ou +33/0033 X XX XX XX XX
  remplacerTous(/(?:\+33|0033)[\s.-]?[1-9](?:[\s.-]?\d{2}){4}|0[1-9](?:[\s.-]?\d{2}){4}/g, "TEL");

  // Montants : nombres avec séparateurs de milliers (espace/point) et décimale virgule, suivis de €, EUR, euros
  remplacerTous(/\d{1,3}(?:[ .]\d{3})*(?:,\d{2})?\s?(?:€|EUR\b|euros?\b)/gi, "MONTANT");

  // IBAN FR (27 caractères au total : FR + 25), espaces tolérés dans le texte source
  out = out.replace(/FR\d{2}(?:[ ]?[A-Z0-9]{4}){2,6}[ ]?[A-Z0-9]{0,4}/g, (match) => {
    const compact = match.replace(/\s+/g, "");
    if (compact.length !== 27) return match;
    compteurs.IBAN++;
    const jeton = `[IBAN_${compteurs.IBAN}]`;
    table[jeton] = match;
    return jeton;
  });

  // SIREN (9 chiffres) / SIRET (14 chiffres) consécutifs
  remplacerTous(/\b\d{14}\b|\b\d{9}\b/g, "ID");

  return { texteAnonymise: out, table };
}

/* ===== Nettoyage global des placeholders hallucinés par le modèle ([•], [Prénom], ...) ===== */
function nettoyerPlaceholders(texte) {
  const protections = [];
  let out = texte;

  // Protéger les boutons [[Libellé|url]] et les jetons d'anonymisation avant tout nettoyage
  out = out.replace(/\[\[[^\]]*\]\]|\[(?:EMAIL|TEL|MONTANT|IBAN|ID)_\d+\]/g, (match) => {
    const jeton = ` PROT${protections.length} `;
    protections.push(match);
    return jeton;
  });

  // Supprimer les placeholders courts restants entre crochets simples (ex. [•], [Prénom], [Nom])
  out = out.replace(/\[[^\]\n]{1,40}\]/g, "");

  // Restaurer les séquences protégées
  protections.forEach((val, i) => {
    out = out.replace(` PROT${i} `, val);
  });

  // Corriger la ponctuation orpheline et les espaces laissés par la suppression
  out = out
    .replace(/[ \t]+,/g, ",")
    .replace(/[ \t]+\./g, ".")
    .replace(/[ \t]{2,}/g, " ")
    .split("\n").map(ligne => ligne.replace(/[ \t]+$/, "")).join("\n")
    .replace(/\n{3,}/g, "\n\n");

  return out;
}

function restaurerJetons(texte, table) {
  let out = texte;
  const jetonsManquants = [];
  for (const [jeton, valeur] of Object.entries(table)) {
    if (!out.includes(jeton)) {
      jetonsManquants.push(jeton);
      continue;
    }
    out = out.split(jeton).join(valeur);
  }
  return { texteRestaure: out, jetonsManquants };
}

app.post("/api/reformuler", async (req, res) => {
  try {
    const { texte, ton, action, anonymiser, tutoiement } = req.body || {};
    const tutoiementActif = Boolean(tutoiement);
    if (!texte || !String(texte).trim())
      return res.status(400).json({ error: "Texte manquant." });
    if (String(texte).length > 15000)
      return res.status(400).json({ error: "Texte trop long (max 15 000 caractères)." });

    const cle = process.env.OPENAI_API_KEY;
    if (!cle)
      return res.status(500).json({ error: "Clé API non configurée sur le serveur." });

    const actionFinale = action === "emojis" ? "emojis" : "reformuler";

    let texteEnvoye = texte;
    let tableJetons = null;
    if (anonymiser) {
      const resultat = anonymiserTexte(texte);
      texteEnvoye = resultat.texteAnonymise;
      tableJetons = resultat.table;
    }

    let systemPrompt, temperature, userPrefix;
    if (actionFinale === "emojis") {
      systemPrompt =
`Tu ajoutes des émojis dans un email rédigé en français, quel que soit son contexte : professionnel, commercial, administratif, associatif ou personnel.
RÈGLES STRICTES :
- Ne modifie RIEN au texte : pas un mot, pas une virgule, pas un chiffre. Tu ne fais qu'INSÉRER des émojis.
- Insère un émoji pertinent en fin de certains intertitres (lignes commençant par ## ou ###) et éventuellement en fin de quelques phrases clés du corps.
- Maximum 1 émoji par paragraphe et 8 émojis au total. La sobriété prime : mieux vaut trop peu que trop.
- Émojis adaptés au contexte du mail : 📅 ⏰ ✅ ⚠️ 💡 📌 ✉️ 🤝 🎉 👍 🙏 📍. Jamais d'émojis fantaisistes ou familiers.
- Conserve tels quels les marqueurs ##, ###, >, !!, [[...]] et les **gras**.
- Le texte peut être au tutoiement ou au vouvoiement selon le choix de l'utilisateur : comme tu ne modifies aucun mot, tu n'as pas à convertir le registre, contente-toi d'insérer les émojis sans y toucher.
- Réponds UNIQUEMENT avec le texte enrichi, sans commentaire.`;
      temperature = 0.4;
      userPrefix = "Texte à enrichir d'émojis :\n\n";
    } else {
      const tonFinal = (ton && String(ton).trim()) || "professionnel et courtois";
      const consigneTon = TONS[tonFinal] || TONS["professionnel et courtois"];
      const consigneRegistre = tutoiementActif
        ? `- REGISTRE IMPÉRATIF : tutoie le destinataire dans tout le mail. Convertis systématiquement chaque "vous" s'adressant au destinataire en "tu" (et les accords correspondants : votre → ton/ta, vos → tes, vous-même → toi-même). Adapte les formules d'ouverture et de clôture à un registre cordial mais soigné ("Bonjour Prénom," si le prénom figure dans le texte, sinon "Bonjour," ; clôture type "Bien à toi," ou "À très vite,"). Aucun "vous" résiduel adressé au destinataire ne doit subsister. Le texte reste soigné : ni argot ni langage SMS.`
        : `- REGISTRE IMPÉRATIF : vouvoie le destinataire et conserve les formules de politesse de la correspondance professionnelle française.`;
      systemPrompt =
`Tu reformules des emails rédigés en français, quel que soit leur contexte : professionnel, commercial, administratif, associatif ou personnel.

INVARIANTS ABSOLUS (priorité maximale) :
- Les montants, taux, dates, délais, références légales et noms propres sont conservés STRICTEMENT à l'identique.
- Le sens de chaque information est conservé : ne reformule jamais une phrase au point d'en changer la portée (qui fait quoi, qui doit transmettre quoi à qui).
- Les marqueurs de mise en forme (##, ###, >, !!, [[...]], **gras**) sont conservés tels quels.
${consigneRegistre}
- N'invente aucune information : si une formule d'ouverture chaleureuse ou une référence serait naturelle mais que le texte ne fournit pas l'information (prénom du destinataire, contexte), reste générique plutôt que d'inventer.

Cette contrainte de registre (tutoiement/vouvoiement) PRIME sur les instructions de ton ci-dessous en cas de conflit : un ton "formel et solennel" avec tutoiement demandé reste solennel dans le vocabulaire mais tutoie.

STYLE À APPLIQUER (dans le respect des invariants) :
${consigneTon}
Le ton doit être perceptible dès la première ligne. Les formules d'ouverture et de clôture DOIVENT être adaptées au ton demandé.

Réponds UNIQUEMENT avec le texte reformulé.`;
      temperature = 0.7;
      userPrefix = "Texte à reformuler :\n\n";
    }

    if (tableJetons) {
      systemPrompt += `\n\nLe texte contient des jetons [EMAIL_n], [TEL_n], [MONTANT_n], [IBAN_n], [ID_n] : conserve-les STRICTEMENT tels quels, sans les modifier ni les déplacer hors de leur phrase.`;
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
          { role: "user", content: userPrefix + texteEnvoye }
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

    let texteResultat = nettoyerPlaceholders(data.choices[0].message.content.trim());
    if (tableJetons) {
      const { texteRestaure, jetonsManquants } = restaurerJetons(texteResultat, tableJetons);
      if (jetonsManquants.length > 0) {
        return res.status(422).json({ error: "L'anonymisation n'a pas pu être restaurée fidèlement — réessayez." });
      }
      texteResultat = texteRestaure;
    }

    return res.json({ texte: texteResultat });
  } catch (e) {
    return res.status(500).json({ error: "Erreur serveur : " + e.message });
  }
});

app.listen(process.env.PORT || 3000);
