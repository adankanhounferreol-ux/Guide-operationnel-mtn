/**
 * GUIDE INTREPIDE — backend IA
 * Cloudflare Worker + Gemini
 * =========================================================
 *
 * Rôle :
 * Recevoir { question, context } depuis index.html,
 * demander à Gemini de formuler une réponse UNIQUEMENT
 * à partir du contenu du Guide Opérationnel Digital MTN Bénin,
 * puis renvoyer { answer }.
 *
 * La clé Gemini reste côté Cloudflare dans :
 * Runtime variables and secrets → Production
 *
 * Nom du secret :
 * GEMINI_API_KEY
 */

const ALLOWED_ORIGIN =
  'https://adankanhounferreol-ux.github.io';

/*
 * Modèle Gemini actuellement utilisé.
 */
const MODEL = 'gemini-3.6-flash';

export default {
  async fetch(request, env) {

    // =====================================================
    // CORS — requête OPTIONS
    // =====================================================

    if (request.method === 'OPTIONS') {
      return new Response(null, {
        status: 204,
        headers: corsHeaders(),
      });
    }

    // =====================================================
    // POST uniquement
    // =====================================================

    if (request.method !== 'POST') {
      return json(
        {
          error: 'Méthode non autorisée'
        },
        405
      );
    }

    // =====================================================
    // VÉRIFICATION DE LA CLÉ API
    // =====================================================

    const apiKey = env.GEMINI_API_KEY;

    console.log(
      'GEMINI_API_KEY présente :',
      Boolean(apiKey)
    );

    if (!apiKey) {
      console.error(
        'GEMINI_API_KEY introuvable dans les Runtime variables and secrets.'
      );

      return json(
        {
          error: 'Configuration serveur incorrecte',
          detail:
            'Le secret GEMINI_API_KEY est introuvable dans l’environnement Production.'
        },
        500
      );
    }

    // =====================================================
    // LECTURE DU JSON
    // =====================================================

    let body;

    try {
      body = await request.json();
    } catch (e) {
      console.error(
        'Erreur lecture JSON :',
        e?.message || e
      );

      return json(
        {
          error: 'JSON invalide'
        },
        400
      );
    }

    // =====================================================
    // RÉCUPÉRATION QUESTION + CONTEXTE
    // =====================================================

    const question =
      (body.question || '')
        .toString()
        .slice(0, 2000);

    const context =
      (body.context || '')
        .toString()
        .slice(0, 60000);

    console.log(
      'Question reçue :',
      question.substring(0, 200)
    );

    console.log(
      'Taille du contexte :',
      context.length
    );

    // =====================================================
    // VALIDATION QUESTION
    // =====================================================

    if (!question.trim()) {
      return json(
        {
          error: 'Question manquante'
        },
        400
      );
    }

    // =====================================================
    // PROMPT SYSTÈME
    // =====================================================

    const systemPrompt = `
Tu es GUIDE INTREPIDE, l'assistant interne du Guide Opérationnel Digital MTN Bénin.

RÈGLES STRICTES :

- Réponds UNIQUEMENT à partir des informations contenues dans le CONTENU DU GUIDE fourni ci-dessous.
- Si l'information demandée ne figure pas dans le contenu du guide, dis clairement que ce point n'est pas couvert par le guide et invite à vérifier auprès d'un superviseur.
- N'invente jamais un chiffre, un montant, une condition, un code USSD ou une procédure.
- Ne complète pas une information manquante avec tes propres connaissances.
- Réponds exclusivement en français.
- Utilise un style clair, professionnel, naturel et facile à comprendre.
- Ne fais pas de copier-coller brut du guide : reformule les informations.
- Sois concis, idéalement entre 3 et 8 phrases.
- Utilise des listes à puces lorsque cela améliore la compréhension.
- Lorsque cela est pertinent, termine par une courte "formulation client" prête à être dite ou écrite au client.
- Ne prétends jamais avoir accès à une information qui n'est pas présente dans le CONTENU DU GUIDE.

CONTENU DU GUIDE :

"""
${context}
"""
`;

    // =====================================================
    // APPEL À GEMINI
    // =====================================================

    const geminiUrl =
      `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`;

    console.log(
      'Modèle Gemini utilisé :',
      MODEL
    );

    console.log(
      'Appel Gemini en cours...'
    );

    try {

      const resp = await fetch(
        geminiUrl,
        {
          method: 'POST',

          headers: {
            'Content-Type': 'application/json',

            'x-goog-api-key': apiKey,
          },

          body: JSON.stringify({

            systemInstruction: {
              parts: [
                {
                  text: systemPrompt
                }
              ]
            },

            contents: [
              {
                role: 'user',

                parts: [
                  {
                    text: question
                  }
                ]
              }
            ],

            generationConfig: {
              maxOutputTokens: 700
            }

          })
        }
      );

      // ===================================================
      // LECTURE DE LA RÉPONSE GEMINI
      // ===================================================

      const responseText =
        await resp.text();

      console.log(
        'Statut Gemini :',
        resp.status
      );

      // ===================================================
      // ERREUR GEMINI
      // ===================================================

      if (!resp.ok) {

        console.error(
          `Erreur Gemini (statut ${resp.status}) :`,
          responseText.substring(0, 3000)
        );

        return json(
          {
            error: 'Erreur API Gemini',

            geminiStatus:
              resp.status,

            detail:
              responseText.substring(0, 3000)
          },
          502
        );
      }

      // ===================================================
      // PARSING JSON GEMINI
      // ===================================================

      let data;

      try {

        data =
          JSON.parse(responseText);

      } catch (e) {

        console.error(
          'Réponse Gemini non JSON :',
          responseText.substring(0, 3000)
        );

        return json(
          {
            error:
              'Réponse Gemini invalide',

            detail:
              responseText.substring(0, 3000)
          },
          502
        );
      }

      // ===================================================
      // EXTRACTION DE LA RÉPONSE
      // ===================================================

      const candidate =
        (data.candidates || [])[0];

      const answer =
        (
          candidate?.content?.parts || []
        )
          .map(
            part => part.text || ''
          )
          .join('\n')
          .trim();

      // ===================================================
      // AUCUNE RÉPONSE
      // ===================================================

      if (!answer) {

        console.error(
          'Gemini n’a fourni aucune réponse.',
          JSON.stringify(data).substring(0, 3000)
        );

        return json(
          {
            error:
              "Gemini n'a fourni aucune réponse."
          },
          502
        );
      }

      // ===================================================
      // SUCCÈS
      // ===================================================

      console.log(
        'Réponse Gemini reçue avec succès.'
      );

      return json(
        {
          answer
        },
        200
      );

    } catch (e) {

      // ===================================================
      // ERREUR RÉSEAU / SERVEUR
      // ===================================================

      console.error(
        'Erreur serveur Gemini :',
        e?.stack ||
        e?.message ||
        String(e)
      );

      return json(
        {
          error:
            'Erreur serveur lors de la communication avec Gemini',

          detail:
            e?.message ||
            String(e)
        },
        500
      );
    }
  },
};


// =======================================================
// CORS
// =======================================================

function corsHeaders() {

  return {

    'Access-Control-Allow-Origin':
      ALLOWED_ORIGIN,

    'Access-Control-Allow-Methods':
      'POST, OPTIONS',

    'Access-Control-Allow-Headers':
      'Content-Type',

  };
}


// =======================================================
// RÉPONSE JSON
// =======================================================

function json(
  obj,
  status = 200
) {

  return new Response(
    JSON.stringify(obj),

    {
      status,

      headers: {
        'Content-Type':
          'application/json',

        ...corsHeaders()
      }
    }
  );
}
