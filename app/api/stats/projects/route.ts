import { NextResponse } from 'next/server';
import { getFirestore, collection, getDocs } from 'firebase/firestore';
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
    const eventsCollection = collection(db, 'projectEvents');
    const eventsSnapshot = await getDocs(eventsCollection);
    
    // Extract unique project IDs and creators
    const uniqueProjects = new Set<string>();
    const uniqueCreators = new Set<string>();
    
    eventsSnapshot.forEach((doc) => {
      const eventData = doc.data();
      if (eventData.projectId) {
        uniqueProjects.add(eventData.projectId);
      }
      if (eventData.createdBy) {
        uniqueCreators.add(eventData.createdBy);
      }
    });

    const totalProjects = uniqueProjects.size;
    const totalKOLs = uniqueCreators.size;

    return NextResponse.json({
      success: true,
      totalProjects,
      totalKOLs,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error fetching projects/KOLs count:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to fetch projects/KOLs count',
        totalProjects: 0,
        totalKOLs: 0
      },
      { status: 500 }
    );
  }
}
