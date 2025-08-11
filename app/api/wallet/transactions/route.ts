import { NextResponse } from 'next/server';
import { adminDb } from '../../../../lib/firebase-admin';
import type { QueryDocumentSnapshot } from 'firebase-admin/firestore';

export async function POST(request: Request) {
  try {
    const { walletAddress, transaction } = await request.json();
    
    if (!walletAddress || !transaction) {
      return NextResponse.json({ error: 'Wallet address and transaction data are required' }, { status: 400 });
    }

    const db = adminDb();
    if (!db) {
      throw new Error('Firebase database not initialized');
    }

    // Store the transaction in Firestore
    const transactionRef = await db.collection('wallet_transactions').add({
      walletAddress,
      ...transaction,
      timestamp: new Date(),
      status: 'pending'
    });

    return NextResponse.json({
      success: true,
      transactionId: transactionRef.id
    });

  } catch (error) {
    console.error('Error storing transaction:', error);
    return NextResponse.json(
      { error: 'Failed to store transaction' }, 
      { status: 500 }
    );
  }
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const walletAddress = searchParams.get('walletAddress');
    
    if (!walletAddress) {
      return NextResponse.json({ error: 'Wallet address is required' }, { status: 400 });
    }

    const db = adminDb();
    if (!db) {
      throw new Error('Firebase database not initialized');
    }

    // Get transaction history from Firestore
    const transactionsSnapshot = await db
      .collection('wallet_transactions')
      .where('walletAddress', '==', walletAddress)
      .orderBy('timestamp', 'desc')
      .limit(50)
      .get();

    const transactions = transactionsSnapshot.docs.map((doc: QueryDocumentSnapshot) => ({
      id: doc.id,
      ...doc.data(),
      timestamp: doc.data().timestamp?.toDate?.() || doc.data().timestamp
    }));

    return NextResponse.json({
      success: true,
      transactions
    });

  } catch (error) {
    console.error('Error fetching transactions:', error);
    return NextResponse.json(
      { error: 'Failed to fetch transactions' }, 
      { status: 500 }
    );
  }
}
