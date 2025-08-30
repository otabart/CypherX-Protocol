import { NextResponse } from 'next/server';
import { getFirestore, collection, getDocs, query, where, Timestamp } from 'firebase/firestore';
import { initializeApp, getApps } from 'firebase/app';

// Firebase config
const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

// Initialize Firebase
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];
const db = getFirestore(app);

export async function GET() {
  try {
    // Get the first day of current month
    const now = new Date();
    const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const firstDayTimestamp = Timestamp.fromDate(firstDayOfMonth);

    // Query events created this month
    const eventsCollection = collection(db, 'projectEvents');
    const eventsQuery = query(
      eventsCollection,
      where('createdAt', '>=', firstDayTimestamp)
    );
    
    const eventsSnapshot = await getDocs(eventsQuery);
    const eventsThisMonth = eventsSnapshot.size;

    // Get total events count
    const allEventsSnapshot = await getDocs(eventsCollection);
    const totalEvents = allEventsSnapshot.size;

    return NextResponse.json({
      success: true,
      eventsThisMonth,
      totalEvents,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error fetching events count:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to fetch events count',
        eventsThisMonth: 0,
        totalEvents: 0
      },
      { status: 500 }
    );
  }
}
