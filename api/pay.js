import admin from 'firebase-admin';

// Initialisation unique pour éviter de saturer les instances Vercel
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      // On remplace les \n pour que la clé soit valide sur Vercel
      privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    }),
  });
}

const db = admin.firestore();

export default async function handler(req, res) {
  // Config CORS pour ton frontend Davantech
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Metodo no autorisado' });
  }

  const { userId, amount } = req.body;

  // Check si les données sont là (et si amount est un chiffre)
  if (!userId || isNaN(amount)) {
    return res.status(400).json({ error: 'Datos invalidos' });
  }

  const userRef = db.collection('users').doc(userId);

  try {
    await db.runTransaction(async (t) => {
      const userDoc = await t.get(userRef);
      if (!userDoc.exists) throw new Error("Utilisador invalido");

      const currentBalance = userDoc.data().balance || 0;
      const numericAmount = Number(amount);

      if (currentBalance < numericAmount) {
        throw new Error("Sueldo demasiado bajp");
      }

      t.update(userRef, { balance: currentBalance - numericAmount });
    });

    return res.status(200).json({ success: true, message: 'Transación OK' });
  } catch (e) {
    return res.status(400).json({ error: e.message });
  }
}