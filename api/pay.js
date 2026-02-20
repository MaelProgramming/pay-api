import admin from 'firebase-admin';

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    }),
  });
}

const db = admin.firestore();

export default async function handler(req, res) {
  // 1. Headers CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Metodo no autorisado' });
  }

  // 2. Extraction sécurisée des données
  // Parfois req.body est déjà un objet, parfois c'est une string JSON
  let data = req.body;
  if (typeof req.body === 'string') {
    try {
      data = JSON.parse(req.body);
    } catch (e) {
      return res.status(400).json({ error: 'JSON malformé' });
    }
  }

  // On récupère les valeurs (on accepte userId ou uid pour être flexible)
  const userId = data?.userId || data?.uid;
  const amount = data?.amount;
  const numericAmount = parseFloat(amount);

  // 3. Validation stricte
  if (!userId || isNaN(numericAmount) || numericAmount <= 0) {
    return res.status(400).json({ 
      error: 'Datos invalidos', 
      details: `userId: ${userId}, amount: ${amount}`,
      received_payload: data // Pour debugger en direct
    });
  }

  try {
    const userRef = db.collection('users').doc(userId);

    await db.runTransaction(async (t) => {
      const userDoc = await t.get(userRef);
      if (!userDoc.exists) throw new Error("Utilisador invalido");

      const currentBalance = userDoc.data().balance || 0;

      if (currentBalance < numericAmount) {
        throw new Error("Sueldo demasiado bajo");
      }

      t.update(userRef, { balance: currentBalance - numericAmount });
    });

    return res.status(200).json({ success: true, message: 'Transación OK' });
  } catch (e) {
    return res.status(400).json({ error: e.message });
  }
}
