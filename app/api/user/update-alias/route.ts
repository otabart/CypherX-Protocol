import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';

export async function POST(request: Request) {
  try {
    const { walletAddress, alias } = await request.json();

    if (!walletAddress || !alias) {
      return NextResponse.json(
        { error: 'Wallet address and alias are required' },
        { status: 400 }
      );
    }

    if (alias.length > 20) {
      return NextResponse.json(
        { error: 'Alias must be 20 characters or less' },
        { status: 400 }
      );
    }

    const db = adminDb();
    if (!db) {
      return NextResponse.json({ error: 'Database connection failed' }, { status: 500 });
    }

    // Update user document
    const usersQuery = await db.collection('users').where('walletAddress', '==', walletAddress).get();
    
    if (!usersQuery.empty) {
      const userDoc = usersQuery.docs[0];
      await userDoc.ref.update({
        alias: alias.trim(),
        lastUpdated: new Date()
      });
    }

    // Update author document if user is an author
    const authorsQuery = await db.collection('authors').where('walletAddress', '==', walletAddress).get();
    
    if (!authorsQuery.empty) {
      const authorDoc = authorsQuery.docs[0];
      await authorDoc.ref.update({
        alias: alias.trim(),
        lastUpdated: new Date()
      });
    }

    return NextResponse.json({ 
      success: true, 
      message: 'Alias updated successfully' 
    });

  } catch (error) {
    console.error('Error updating alias:', error);
    return NextResponse.json(
      { error: 'Failed to update alias' },
      { status: 500 }
    );
  }
}
