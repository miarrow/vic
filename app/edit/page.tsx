'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';

const PLATFORM_LABELS: Record<string, string> = {
  twitter: '트위터', dcinside: '디시인사이드', navernews: '네이버뉴스',
  instagram: '인스타그램', kakao: '카카오톡', telegram: '텔레그램',
};

const PLATFORM_COLORS: Record<string, string> = {
  twitter: 'bg-blue-100 text-blue-700', dcinside: 'bg-orange-100 text-orange-700',
  navernews: 'bg-green-100 text-green-700', instagram: 'bg-pink-100 text-pink-700',
  kakao: 'bg-yellow-100 text-yellow-700', telegram: 'bg-sky-100 text-sky-700',
};

interface Post { id: number; platform: string; content: string; created_at: string }

function postPreview(post: Post): string {
  try {
    const c = JSON.parse(post.content);
    return c.title ?? c.text ?? c.caption ?? c.room_name ?? '(내용 없음)';
  } catch { return '(파싱 오류)'; }
}

export default function EditPage() {
  const [posts, setPosts] = useState<Post[]>([]);

  const load = () => fetch('/api/posts').then(r => r.json()).then(setPosts);
  useEffect(() => { load(); }, []);

  const del = async (id: number) => {
    if (!confirm('삭제하시겠습니까?')) return;
    await fetch(`/api/posts/${id}`, { method: 'DELETE' });
    load();
  };

  return (
    <div className="max-w-4xl mx-auto px-4 py-6">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Link href="/" className="text-gray-500 hover:text-gray-700 text-sm">← 열람 모드</Link>
          <h1 className="text-2xl font-bold text-gray-800">수정 모드</h1>
        </div>
        <Link href="/edit/new" className="bg-blue-600 text-white px-4 py-1.5 rounded-lg text-sm hover:bg-blue-500">
          + 새 게시글
        </Link>
      </div>

      {posts.length === 0 ? (
        <div className="text-center text-gray-400 py-20">게시글이 없습니다.</div>
      ) : (
        <div className="space-y-2">
          {posts.map(post => (
            <div key={post.id} className="bg-white border border-gray-200 rounded-xl px-4 py-3 flex items-center gap-3">
              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${PLATFORM_COLORS[post.platform] ?? 'bg-gray-100 text-gray-600'}`}>
                {PLATFORM_LABELS[post.platform] ?? post.platform}
              </span>
              <Link href={`/post/${post.id}`} className="flex-1 text-sm text-gray-700 hover:underline line-clamp-1">
                {postPreview(post)}
              </Link>
              <span className="text-xs text-gray-400">{new Date(post.created_at).toLocaleString('ko-KR')}</span>
              <button onClick={() => del(post.id)} className="text-red-400 hover:text-red-600 text-sm px-2">삭제</button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
