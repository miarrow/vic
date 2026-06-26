'use client';
import Image from 'next/image';
import { useState } from 'react';

interface Reply { author: string; text: string }
interface Comment { author: string; text: string; replies?: Reply[] }
interface InstaContent {
  author: { nickname: string; avatar_seed: string };
  images: string[];
  caption: string;
  likes: number;
  comments: Comment[];
}

function avatarColor(seed: string) {
  const colors = ['#fd5949', '#d6249f', '#285aeb', '#f77737', '#fcaf45'];
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) % colors.length;
  return colors[h];
}

export default function InstagramPost({ content }: { content: InstaContent }) {
  const [imgIdx, setImgIdx] = useState(0);
  const [showAll, setShowAll] = useState(false);
  const [openReplies, setOpenReplies] = useState<number[]>([]);
  const toggle = (i: number) => setOpenReplies(prev => prev.includes(i) ? prev.filter(x => x !== i) : [...prev, i]);

  return (
    <div className="bg-white border border-gray-200 max-w-sm rounded-sm">
      <div className="flex items-center gap-2 px-3 py-2">
        <div className="w-8 h-8 rounded-full p-0.5" style={{ background: `linear-gradient(45deg, ${avatarColor(content.author.avatar_seed)}, #fcaf45)` }}>
          <div className="w-full h-full rounded-full bg-white flex items-center justify-center text-xs font-bold" style={{ color: avatarColor(content.author.avatar_seed) }}>
            {content.author.nickname[0]?.toUpperCase()}
          </div>
        </div>
        <span className="text-sm font-bold">{content.author.nickname}</span>
        <span className="ml-auto text-gray-500">···</span>
      </div>

      <div className="relative aspect-square bg-gray-100">
        {content.images?.length > 0 ? (
          <Image src={content.images[imgIdx]} alt="" fill className="object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-gray-400">이미지 없음</div>
        )}
        {content.images?.length > 1 && (
          <div className="absolute bottom-2 left-0 right-0 flex justify-center gap-1">
            {content.images.map((_, i) => (
              <button key={i} onClick={() => setImgIdx(i)}
                className={`w-1.5 h-1.5 rounded-full ${i === imgIdx ? 'bg-blue-500' : 'bg-white opacity-70'}`} />
            ))}
          </div>
        )}
        {content.images?.length > 1 && imgIdx < content.images.length - 1 && (
          <button onClick={() => setImgIdx(i => i + 1)} className="absolute right-2 top-1/2 -translate-y-1/2 bg-white rounded-full p-1 text-sm opacity-80">›</button>
        )}
        {imgIdx > 0 && (
          <button onClick={() => setImgIdx(i => i - 1)} className="absolute left-2 top-1/2 -translate-y-1/2 bg-white rounded-full p-1 text-sm opacity-80">‹</button>
        )}
      </div>

      <div className="px-3 py-2">
        <div className="flex gap-3 text-xl mb-1">
          <span>🤍</span><span>💬</span><span>📤</span><span className="ml-auto">🔖</span>
        </div>
        <p className="text-sm font-bold">좋아요 {content.likes}개</p>
        <p className="text-sm mt-1">
          <span className="font-bold">{content.author.nickname}</span>{' '}{content.caption}
        </p>
        {content.comments?.length > 0 && (
          <>
            {!showAll && (
              <button onClick={() => setShowAll(true)} className="text-gray-500 text-sm">
                댓글 {content.comments.length}개 모두 보기
              </button>
            )}
            {showAll && content.comments.map((c, i) => (
              <div key={i} className="mt-1">
                <p className="text-sm"><span className="font-bold">{c.author}</span> {c.text}</p>
                {c.replies && c.replies.length > 0 && (
                  <button onClick={() => toggle(i)} className="text-xs text-gray-400 ml-1">
                    {openReplies.includes(i) ? '▲ 접기' : `답글 ${c.replies.length}개`}
                  </button>
                )}
                {openReplies.includes(i) && c.replies?.map((r, j) => (
                  <p key={j} className="text-sm ml-4 text-gray-600"><span className="font-bold">{r.author}</span> {r.text}</p>
                ))}
              </div>
            ))}
          </>
        )}
      </div>
    </div>
  );
}
