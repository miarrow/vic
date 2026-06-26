import { NextRequest, NextResponse } from 'next/server';
import { getPosts, createPost, Platform } from '@/lib/db';

export async function GET(req: NextRequest) {
  const platform = req.nextUrl.searchParams.get('platform') ?? undefined;
  const posts = getPosts(platform);
  return NextResponse.json(posts);
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { platform, content, ai_prompt } = body;
  if (!platform || !content) return NextResponse.json({ error: 'missing fields' }, { status: 400 });
  const id = createPost(platform as Platform, content, ai_prompt);
  return NextResponse.json({ id });
}
