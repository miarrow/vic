'use client';
import Image from 'next/image';
import { useState } from 'react';

interface Reply { author: string; text: string }
interface Comment { author: string; text: string; likes: number; replies?: Reply[] }
interface NaverContent {
  source: string;
  title: string;
  author: string;
  body: string;
  images: string[];
  views: number;
  likes: number;
  published_at: string;
  comments: Comment[];
}

export default function NaverNewsPost({ content }: { content: NaverContent }) {
  const [openReplies, setOpenReplies] = useState<number[]>([]);
  const toggle = (i: number) => setOpenReplies(prev => prev.includes(i) ? prev.filter(x => x !== i) : [...prev, i]);

  return (
    <div className="bg-white max-w-2xl">
      <div className="flex items-center gap-2 mb-2">
        <span className="text-[#03c75a] font-bold text-lg">N</span>
        <span className="text-gray-600 text-sm">{content.source}</span>
      </div>
      <h1 className="text-2xl font-bold text-[#1a1a1a] leading-tight">{content.title}</h1>
      <div className="flex gap-3 text-xs text-gray-500 mt-2 pb-3 border-b border-gray-200">
        <span>{content.author} 기자</span>
        <span>{content.published_at}</span>
        <span>조회 {content.views}</span>
      </div>
      <div className="py-4 text-[15px] text-[#333] whitespace-pre-wrap leading-7">
        {content.images?.length > 0 && (
          <div className="float-right ml-4 mb-4 max-w-xs">
            <div className="relative w-64 h-48 bg-gray-100">
              <Image src={content.images[0]} alt="" fill className="object-cover" />
            </div>
            {content.images.length > 1 && (
              <div className="mt-1 grid grid-cols-2 gap-1">
                {content.images.slice(1).map((src, i) => (
                  <div key={i} className="relative h-24 bg-gray-100">
                    <Image src={src} alt="" fill className="object-cover" />
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
        {content.body}
      </div>
      <div className="flex items-center gap-3 py-3 border-t border-gray-200">
        <button className="flex items-center gap-1 border border-gray-300 rounded-full px-4 py-1.5 text-sm hover:bg-gray-50">
          <span>👍</span> 좋아요 {content.likes}
        </button>
      </div>
      {content.comments?.length > 0 && (
        <div className="border-t border-gray-200 pt-3">
          <div className="font-bold text-sm mb-3 text-[#1a1a1a]">
            댓글 <span className="text-[#03c75a]">{content.comments.length}</span>
          </div>
          {content.comments.map((c, i) => (
            <div key={i} className="py-3 border-b border-gray-100">
              <div className="flex justify-between">
                <span className="text-sm font-bold">{c.author}</span>
                <span className="text-xs text-gray-400">👍 {c.likes}</span>
              </div>
              <p className="text-sm mt-1">{c.text}</p>
              {c.replies && c.replies.length > 0 && (
                <button onClick={() => toggle(i)} className="text-xs text-[#03c75a] mt-1">
                  {openReplies.includes(i) ? '▲ 답글 접기' : `▼ 답글 ${c.replies.length}개`}
                </button>
              )}
              {openReplies.includes(i) && c.replies?.map((r, j) => (
                <div key={j} className="mt-2 pl-4 border-l-2 border-gray-200">
                  <span className="text-xs font-bold">{r.author}</span>
                  <p className="text-sm">{r.text}</p>
                </div>
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
