import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';

interface CalendarEvent {
  id: string;
  projectId: string;
  projectName: string;
  projectTicker: string;
  title: string;
  description: string;
  date: string;
  time: string;
  eventType: string;
  status: string;
  votes: number;
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const search = searchParams.get('search') || '';
    const limit = parseInt(searchParams.get('limit') || '10');

    const db = adminDb();
    if (!db) {
      return NextResponse.json({ error: 'Database connection failed' }, { status: 500 });
    }

    // Get all events from the calendar collection
    const eventsQuery = db.collection('projectEvents');
    const snapshot = await eventsQuery.get();

    let events: CalendarEvent[] = [];

    snapshot.docs.forEach((doc) => {
      const data = doc.data();
      events.push({
        id: doc.id,
        projectId: data.projectId || '',
        projectName: data.projectName || '',
        projectTicker: data.projectTicker || '',
        title: data.title || '',
        description: data.description || '',
        date: data.date || '',
        time: data.time || '',
        eventType: data.eventType || '',
        status: data.status || '',
        votes: data.votes || 0
      });
    });

    // Filter by search query if provided
    if (search) {
      const searchLower = search.toLowerCase();
      events = events.filter(event => 
        event.title.toLowerCase().includes(searchLower) ||
        event.description.toLowerCase().includes(searchLower) ||
        event.projectName.toLowerCase().includes(searchLower) ||
        event.projectTicker.toLowerCase().includes(searchLower) ||
        event.eventType.toLowerCase().includes(searchLower)
      );
    }

    // Sort by date (most recent first) and limit results
    events.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    events = events.slice(0, limit);

    return NextResponse.json({
      success: true,
      events,
      total: events.length
    });

  } catch (error) {
    console.error('Error fetching calendar events:', error);
    return NextResponse.json({ error: 'Error fetching calendar events' }, { status: 500 });
  }
}
