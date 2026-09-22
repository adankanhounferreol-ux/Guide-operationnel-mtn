/**
 * GUIDE INTREPIDE — backend IA minimal (Cloudflare Worker)
 * =========================================================
 *
 * Rôle : recevoir { question, context } depuis index.html,
 * demander à Gemini (Google AI Studio) de formuler une réponse
 * UNIQUEMENT à partir du contenu du guide (context), et renvoyer
 * { answer }.
 *
 * Pas de base de données : le "context" envoyé à chaque requête
 * EST la base de connaissance (le contenu du guide lui-même,
 * extrait côté navigateur). Ce worker ne fait que protéger la
 * clé API (elle ne doit jamais être visible dans index.html).
 *
 * DÉPLOIEMENT (gratuit, ~5 minutes) :
 * 1. Créer une clé API gratuite sur https://aistudio.google.com/apikey
 *    (compte Google suffit, aucune carte bancaire requise)
 * 2. Créer un compte sur https://dash.cloudflare.com (offre gratuite)
 * 3. Workers & Pages → Create → Create Worker
 * 4. Coller ce code dans l'éditeur, cliquer "Deploy"
 * 5. Settings → Variables → ajouter une variable secrète :
 *      nom : GEMINI_API_KEY
 *      valeur : la clé copiée à l'étape 1
 * 6. Copier l'URL du worker (ex: https://xxx.votre-compte.workers.dev)
 *    et la coller dans index.html, ligne :
 *      const AI_ENDPOINT = 'https://xxx.votre-compte.workers.dev';
 * 7. ALLOWED_ORIGIN ci-dessous est déjà réglé sur le domaine GitHub Pages
 *    du guide — à mettre à jour si le guide change d'adresse un jour.
 *
 * QUOTA GRATUIT : 1 500 requêtes/jour, 15/minute, renouvelé chaque jour
 * (modèle gemini-2.0-flash). Aucune carte bancaire, jamais d'expiration.
 */

const ALLOWED_ORIGIN = 'https://adankanhounferreol-ux.github.io'; // domaine GitHub Pages du guide
const MODEL = 'gemini-2.0-flash';

export default {
  async fetch(request, env) {
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders() });
    }
    if (request.method !== 'POST') {
      return json({ error: 'Méthode non autorisée' }, 405);
    }

    let body;
    try {
      body = await request.json();
    } catch (e) {
      return json({ error: 'JSON invalide' }, 400);
    }

    const question = (body.question || '').toString().slice(0, 2000);
    const context = (body.context || '').toString().slice(0, 60000);

    if (!question.trim()) {
      return json({ error: 'Question manquante' }, 400);
    }

    const systemPrompt = `Tu es GUIDE INTREPIDE, l'assistant interne du Guide Opérationnel Digital MTN Bénin.

RÈGLES STRICTES :
- Réponds UNIQUEMENT à partir des informations contenues dans le CONTENU DU GUIDE fourni ci-dessous.
- Si l'information demandée n'y figure pas, dis clairement que ce point n'est pas couvert par le guide et invite à vérifier auprès d'un superviseur. N'invente jamais un chiffre, un montant, une condition ou une procédure.
- Réponds en français, dans un style clair, professionnel et naturel — pas de copier-coller brut du texte source, reformule avec tes propres mots.
- Sois concis (idéalement 3 à 8 phrases), structure avec des puces si utile.
- Si pertinent, termine par une courte "formulation client" prête à être dite ou écrite à un client, entre guillemets.

CONTENU DU GUIDE :
"""
${context}
"""`;

    try {
      const resp = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-goog-api-key': env.GEMINI_API_KEY,
          },
          body: JSON.stringify({
            systemInstruction: { parts: [{ text: systemPrompt }] },
            contents: [{ role: 'user', parts: [{ text: question }] }],
            generationConfig: { maxOutputTokens: 700, temperature: 0.4 },
          }),
        }
      );

      if (!resp.ok) {
        const errText = await resp.text();
        return json({ error: 'Erreur API IA', detail: errText }, 502);
      }

      const data = await resp.json();
      const candidate = (data.candidates || [])[0];
      const answer = ((candidate && candidate.content && candidate.content.parts) || [])
        .map((p) => p.text || '')
        .join('\n')
        .trim();

      return json({ answer: answer || "Je n'ai pas pu formuler de réponse." });
    } catch (e) {
      return json({ error: 'Erreur serveur', detail: String(e) }, 500);
    }
  },
};

function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': ALLOWED_ORIGIN,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };
}

function json(obj, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { 'Content-Type': 'application/json', ...corsHeaders() },
  });
}
