'use client';
import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import TwitterPost from '@/components/platforms/TwitterPost';
import DcinsidePost from '@/components/platforms/DcinsidePost';
import NaverNewsPost from '@/components/platforms/NaverNewsPost';
import InstagramPost from '@/components/platforms/InstagramPost';
import KakaoChat from '@/components/platforms/KakaoChat';
import TelegramChat from '@/components/platforms/TelegramChat';

interface Post { id: number; platform: string; content: string; ai_prompt: string | null; created_at: string }

export default function PostPage() {
  const { id } = useParams<{ id: string }>();
  const [post, setPost] = useState<Post | null>(null);

  useEffect(() => {
    fetch(`/api/posts/${id}`).then(r => r.json()).then(setPost);
  }, [id]);

  if (!post) return <div className="flex items-center justify-center h-64 text-gray-400">로딩 중...</div>;

  let content: unknown;
  try { content = JSON.parse(post.content); } catch { content = {}; }

  function renderContent() {
    switch (post!.platform) {
      case 'twitter': return <TwitterPost content={content as Parameters<typeof TwitterPost>[0]['content']} />;
      case 'dcinside': return <DcinsidePost content={content as Parameters<typeof DcinsidePost>[0]['content']} />;
      case 'navernews': return <NaverNewsPost content={content as Parameters<typeof NaverNewsPost>[0]['content']} />;
      case 'instagram': return <InstagramPost content={content as Parameters<typeof InstagramPost>[0]['content']} />;
      case 'kakao': return <KakaoChat content={content as Parameters<typeof KakaoChat>[0]['content']} />;
      case 'telegram': return <TelegramChat content={content as Parameters<typeof TelegramChat>[0]['content']} />;
      default: return <pre className="text-xs bg-gray-100 p-4 rounded">{JSON.stringify(content, null, 2)}</pre>;
    }
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-6">
      <div className="flex items-center gap-3 mb-6">
        <Link href="/" className="text-gray-500 hover:text-gray-700">← 목록으로</Link>
      </div>
      <div className="flex justify-center">
        {renderContent()}
      </div>
      {post.ai_prompt && (
        <div className="mt-4 text-xs text-gray-400 border border-gray-200 rounded p-3">
          <span className="font-medium">AI 프롬프트:</span> {post.ai_prompt}
        </div>
      )}
    </div>
  );
}
