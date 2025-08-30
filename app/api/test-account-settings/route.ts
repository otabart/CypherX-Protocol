import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { userId, testData } = body;

    if (!userId || !testData) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const db = adminDb();
    if (!db) {
      return NextResponse.json({ error: 'Database connection failed' }, { status: 500 });
    }

    console.log('Testing account settings update for user:', userId);
    console.log('Test data:', testData);

    // Try to update the user document
    const userDocRef = db.collection('users').doc(userId);
    
    // First check if the document exists
    const userDoc = await userDocRef.get();
    
    if (!userDoc.exists) {
      console.log('User document does not exist, creating it...');
      
      // Create the document with basic data
      await userDocRef.set({
        uid: userId,
        email: 'test@example.com',
        createdAt: new Date(),
        ...testData
      });
      
      return NextResponse.json({
        success: true,
        message: 'User document created successfully',
        action: 'created'
      });
    } else {
      console.log('User document exists, updating...');
      
      // Update the existing document
      await userDocRef.update({
        ...testData,
        updatedAt: new Date()
      });
      
      return NextResponse.json({
        success: true,
        message: 'User document updated successfully',
        action: 'updated'
      });
    }

  } catch (error) {
    console.error('Error testing account settings:', error);
    return NextResponse.json({ 
      error: 'Failed to test account settings',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');

    if (!userId) {
      return NextResponse.json({ error: 'User ID required' }, { status: 400 });
    }

    const db = adminDb();
    if (!db) {
      return NextResponse.json({ error: 'Database connection failed' }, { status: 500 });
    }

    const userDocRef = db.collection('users').doc(userId);
    const userDoc = await userDocRef.get();
    
    if (!userDoc.exists) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const userData = userDoc.data();
    
    return NextResponse.json({
      success: true,
      user: {
        uid: userData?.uid,
        displayName: userData?.displayName,
        bio: userData?.bio,
        theme: userData?.theme,
        email: userData?.email,
        updatedAt: userData?.updatedAt
      }
    });

  } catch (error) {
    console.error('Error fetching user data:', error);
    return NextResponse.json({ error: 'Failed to fetch user data' }, { status: 500 });
  }
}
