/**
 * GUIDE INTREPIDE — backend IA
 * Cloudflare Worker + Gemini
 */

const ALLOWED_ORIGIN =
  'https://adankanhounferreol-ux.github.io';

const MODEL = 'gemini-2.5-flash';

export default {
  async fetch(request, env) {

    // =========================
    // CORS
    // =========================

    if (request.method === 'OPTIONS') {
      return new Response(null, {
        status: 204,
        headers: corsHeaders(),
      });
    }

    // =========================
    // METHOD POST UNIQUEMENT
    // =========================

    if (request.method !== 'POST') {
      return json(
        { error: 'Méthode non autorisée' },
        405
      );
    }

    // =========================
    // VERIFICATION CLE API
    // =========================

    const apiKey = env.GEMINI_API_KEY;

    console.log(
      'GEMINI_API_KEY présente :',
      Boolean(apiKey)
    );

    console.log(
      'Longueur de GEMINI_API_KEY :',
      apiKey ? apiKey.length : 0
    );

    if (!apiKey) {
      console.error(
        'GEMINI_API_KEY introuvable dans le Worker'
      );

      return json(
        {
          error: 'Configuration serveur incorrecte',
          detail:
            'Le secret GEMINI_API_KEY est introuvable.'
        },
        500
      );
    }

    // =========================
    // LECTURE JSON
    // =========================

    let body;

    try {
      body = await request.json();
    } catch (e) {

      console.error(
        'JSON invalide :',
        e?.message || e
      );

      return json(
        {
          error: 'JSON invalide'
        },
        400
      );
    }

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

    if (!question.trim()) {
      return json(
        {
          error: 'Question manquante'
        },
        400
      );
    }

    // =========================
    // PROMPT SYSTEME
    // =========================

    const systemPrompt = `
Tu es GUIDE INTREPIDE, l'assistant interne du Guide Opérationnel Digital MTN Bénin.

RÈGLES STRICTES :

- Réponds UNIQUEMENT à partir des informations contenues dans le CONTENU DU GUIDE fourni ci-dessous.
- Si l'information demandée n'y figure pas, dis clairement que ce point n'est pas couvert par le guide et invite à vérifier auprès d'un superviseur.
- N'invente jamais un chiffre, un montant, une condition ou une procédure.
- Réponds en français.
- Utilise un style clair, professionnel et naturel.
- Ne fais pas de copier-coller brut du guide.
- Sois concis, idéalement 3 à 8 phrases.
- Utilise des puces lorsque cela améliore la compréhension.
- Si pertinent, termine par une courte formulation client prête à être utilisée.

CONTENU DU GUIDE :

"""
${context}
"""
`;

    // =========================
    // APPEL GEMINI
    // =========================

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
              maxOutputTokens: 700,
              temperature: 0.4
            }

          })
        }
      );

      console.log(
        'Statut Gemini :',
        resp.status
      );

      // =========================
      // LECTURE REPONSE GEMINI
      // =========================

      const responseText =
        await resp.text();

      console.log(
        'Réponse Gemini :',
        responseText.substring(0, 3000)
      );

      // =========================
      // ERREUR GEMINI
      // =========================

      if (!resp.ok) {

        return json(
          {
            error: 'Erreur API Gemini',

            geminiStatus:
              resp.status,

            detail:
              responseText
          },
          502
        );
      }

      // =========================
      // PARSING
      // =========================

      let data;

      try {

        data =
          JSON.parse(responseText);

      } catch (e) {

        console.error(
          'Réponse Gemini non JSON'
        );

        return json(
          {
            error:
              'Réponse Gemini invalide',

            detail:
              responseText.substring(0, 2000)
          },
          502
        );
      }

      // =========================
      // EXTRACTION REPONSE
      // =========================

      const candidate =
        (data.candidates || [])[0];

      const answer =
        (
          candidate?.content?.parts || []
        )
          .map(
            p => p.text || ''
          )
          .join('\n')
          .trim();

      if (!answer) {

        console.error(
          'Gemini n’a fourni aucune réponse.',
          JSON.stringify(data)
        );

        return json(
          {
            error:
              "Gemini n'a fourni aucune réponse."
          },
          502
        );
      }

      // =========================
      // SUCCES
      // =========================

      return json({
        answer
      });

    } catch (e) {

      console.error(
        'Erreur réseau Gemini :',
        e?.stack ||
        e?.message ||
        e
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
  }
};


// ==================================
// CORS
// ==================================

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


// ==================================
// JSON RESPONSE
// ==================================

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
