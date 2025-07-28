// app/api/news/route.ts
import { NextResponse } from 'next/server'
import { db } from '@/lib/firebase'
import {
  collection,
  query,
  where,
  getDocs,
  addDoc,
  orderBy,
  serverTimestamp,
} from 'firebase/firestore'
import slugify from 'slugify'

interface NewsArticle {
  title: string
  content: string
  author: string
  source: string
  thumbnailUrl?: string | null
  publishedAt: string
  slug: string
}

// GET → list all articles
export async function GET() {
  try {
    const articlesCol = collection(db, 'articles')
    const q = query(articlesCol, orderBy('publishedAt', 'desc'))
    const snapshot = await getDocs(q)

    const articles: NewsArticle[] = snapshot.docs.map((doc) => {
      const data = doc.data() as Partial<Omit<NewsArticle, 'publishedAt'>> & {
        publishedAt?: { toDate: () => Date }
      }

      return {
        title: data.title ?? 'Untitled',
        content: data.content ?? '',
        author: data.author ?? 'Unknown',
        source: data.source ?? 'Unknown',
        thumbnailUrl: data.thumbnailUrl ?? null,
        publishedAt: data.publishedAt
          ? data.publishedAt.toDate().toISOString()
          : new Date().toISOString(),
        slug: data.slug ?? doc.id,
      }
    })

    return NextResponse.json(articles)
  } catch (error) {
    console.error('Error fetching articles:', error)
    return NextResponse.json({ error: 'Error fetching articles' }, { status: 500 })
  }
}

// POST → create a new article
export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      title: string
      content: string
      author: string
      source: string
      thumbnailUrl?: string
    }

    const { title, content, author, source, thumbnailUrl } = body
    if (!title || !content || !author || !source) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    // 1) generate a base slug
    const baseSlug = slugify(title, { lower: true, strict: true })
    let slug = baseSlug
    let counter = 1

    // 2) ensure uniqueness
    while (
      !(await getDocs(query(collection(db, 'articles'), where('slug', '==', slug))))
        .empty === false
    ) {
      slug = `${baseSlug}-${counter++}`
    }

    // 3) write the document
    const docRef = await addDoc(collection(db, 'articles'), {
      title,
      content,
      author,
      source,
      thumbnailUrl: thumbnailUrl || null,
      publishedAt: serverTimestamp(),
      slug,
    })

    return NextResponse.json({ id: docRef.id, slug })
  } catch (error) {
    console.error('Error saving article:', error)
    return NextResponse.json({ error: 'Error saving article' }, { status: 500 })
  }
}


