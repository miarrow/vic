'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';

const PLATFORMS = ['all', 'twitter', 'dcinside', 'navernews', 'instagram', 'kakao', 'telegram'] as const;
type PlatformFilter = typeof PLATFORMS[number];

const PLATFORM_LABELS: Record<string, string> = {
  all: '전체', twitter: '트위터', dcinside: '디시인사이드',
  navernews: '네이버뉴스', instagram: '인스타그램', kakao: '카카오톡', telegram: '텔레그램',
};

const PLATFORM_COLORS: Record<string, string> = {
  twitter: 'bg-blue-100 text-blue-700',
  dcinside: 'bg-orange-100 text-orange-700',
  navernews: 'bg-green-100 text-green-700',
  instagram: 'bg-pink-100 text-pink-700',
  kakao: 'bg-yellow-100 text-yellow-700',
  telegram: 'bg-sky-100 text-sky-700',
};

interface Post { id: number; platform: string; content: string; created_at: string }

function postPreview(post: Post): string {
  try {
    const c = JSON.parse(post.content);
    return c.title ?? c.text ?? c.caption ?? c.room_name ?? '(내용 없음)';
  } catch { return '(파싱 오류)'; }
}

export default function Home() {
  const [filter, setFilter] = useState<PlatformFilter>('all');
  const [posts, setPosts] = useState<Post[]>([]);

  useEffect(() => {
    fetch(`/api/posts?platform=${filter}`)
      .then(r => r.json())
      .then(setPosts);
  }, [filter]);

  return (
    <div className="max-w-4xl mx-auto px-4 py-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-800">VIC</h1>
        <Link href="/edit" className="bg-gray-800 text-white px-4 py-1.5 rounded-lg text-sm hover:bg-gray-700">
          수정 모드
        </Link>
      </div>

      <div className="flex flex-wrap gap-2 mb-6">
        {PLATFORMS.map(p => (
          <button key={p} onClick={() => setFilter(p)}
            className={`px-3 py-1 rounded-full text-sm font-medium transition ${filter === p ? 'bg-gray-800 text-white' : 'bg-white border border-gray-300 text-gray-600 hover:bg-gray-100'}`}>
            {PLATFORM_LABELS[p]}
          </button>
        ))}
      </div>

      {posts.length === 0 ? (
        <div className="text-center text-gray-400 py-20">게시글이 없습니다. 수정 모드에서 추가해보세요.</div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
          {posts.map(post => (
            <Link key={post.id} href={`/post/${post.id}`}
              className="bg-white border border-gray-200 rounded-xl p-4 hover:shadow-md transition">
              <div className="flex items-center gap-2 mb-2">
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${PLATFORM_COLORS[post.platform] ?? 'bg-gray-100 text-gray-600'}`}>
                  {PLATFORM_LABELS[post.platform] ?? post.platform}
                </span>
              </div>
              <p className="text-sm text-gray-700 line-clamp-3">{postPreview(post)}</p>
              <p className="text-xs text-gray-400 mt-2">{new Date(post.created_at).toLocaleString('ko-KR')}</p>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
