import { NextRequest, NextResponse } from 'next/server';
import { generateContent } from '@/lib/gemini';

export async function POST(req: NextRequest) {
  const { platform, prompt, image_paths } = await req.json();
  if (!platform || !prompt) return NextResponse.json({ error: 'missing fields' }, { status: 400 });

  try {
    const content = await generateContent(platform, prompt, image_paths ?? []);
    return NextResponse.json({ content });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
