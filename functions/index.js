const functions = require('firebase-functions');
const admin = require('firebase-admin');
admin.initializeApp();

exports.processTransfer = functions.https.onRequest(async (req, res) => {
  const event = req.body; // Adjust based on your trigger
  const db = admin.firestore();
  const transferData = {
    tokenSymbol: event.tokenSymbol,
    tokenName: event.tokenName,
    tokenAddress: event.tokenAddress,
    amountToken: event.amountToken,
    amountUSD: event.amountUSD,
    fromAddress: event.fromAddress,
    toAddress: event.toAddress,
    source: event.source,
    timestamp: admin.firestore.Timestamp.fromMillis(event.timestamp),
    hash: event.hash,
    eventType: event.eventType,
    percentage: event.percentage,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
  };

  try {
    await db.collection('whaleTransactions').doc(event.hash).set(transferData);
    console.log(`Stored transfer: ${event.hash}`);
    res.status(200).send(`Stored transfer: ${event.hash}`);
  } catch (error) {
    console.error(`Error storing transfer ${event.hash}:`, error);
    res.status(500).send(`Error storing transfer: ${error.message}`);
  }
});