'use client';
import Image from 'next/image';
import { useState } from 'react';

interface Reply { author: string; text: string }
interface Comment { author: string; text: string; recommend: number; replies?: Reply[] }
interface DcContent {
  gallery: string;
  title: string;
  author: string;
  body: string;
  images: string[];
  views: number;
  recommend: number;
  not_recommend: number;
  comments: Comment[];
}

export default function DcinsidePost({ content }: { content: DcContent }) {
  const [openReplies, setOpenReplies] = useState<number[]>([]);
  const toggle = (i: number) => setOpenReplies(prev => prev.includes(i) ? prev.filter(x => x !== i) : [...prev, i]);

  return (
    <div className="bg-white border border-gray-300 max-w-2xl">
      <div className="bg-[#edf0f5] px-3 py-1 text-xs text-[#555] border-b border-gray-300">
        {content.gallery}갤러리
      </div>
      <div className="border-b border-gray-300 px-4 py-3">
        <h1 className="text-lg font-bold text-[#333]">{content.title}</h1>
        <div className="flex gap-3 text-xs text-gray-500 mt-1">
          <span>{content.author}</span>
          <span>조회 {content.views}</span>
          <span>추천 {content.recommend}</span>
        </div>
      </div>
      <div className="px-4 py-4 min-h-32 whitespace-pre-wrap text-[15px] text-[#333]">
        {content.body}
        {content.images?.length > 0 && (
          <div className="mt-3 space-y-2">
            {content.images.map((src, i) => (
              <div key={i} className="relative w-full max-h-96 overflow-hidden">
                <Image src={src} alt="" width={600} height={400} className="object-contain w-full" />
              </div>
            ))}
          </div>
        )}
      </div>
      <div className="border-t border-gray-300 px-4 py-3 flex gap-4 justify-center">
        <button className="border border-[#e84040] text-[#e84040] px-6 py-1.5 text-sm hover:bg-[#e84040] hover:text-white transition">
          추천 {content.recommend}
        </button>
        <button className="border border-gray-400 text-gray-500 px-6 py-1.5 text-sm hover:bg-gray-100 transition">
          비추천 {content.not_recommend}
        </button>
      </div>
      {content.comments?.length > 0 && (
        <div className="border-t border-gray-300">
          <div className="bg-[#f7f8fa] px-3 py-1.5 text-xs font-bold text-[#555] border-b border-gray-200">
            댓글 {content.comments.length}개
          </div>
          {content.comments.map((c, i) => (
            <div key={i} className="border-b border-gray-100">
              <div className="px-3 py-2">
                <div className="flex justify-between text-xs">
                  <span className="font-bold text-[#333]">{c.author}</span>
                  <span className="text-gray-400">추천 {c.recommend}</span>
                </div>
                <p className="text-sm mt-0.5">{c.text}</p>
                {c.replies && c.replies.length > 0 && (
                  <button onClick={() => toggle(i)} className="text-xs text-blue-600 mt-1">
                    {openReplies.includes(i) ? '▲ 접기' : `▼ 대댓글 ${c.replies.length}개`}
                  </button>
                )}
              </div>
              {openReplies.includes(i) && c.replies?.map((r, j) => (
                <div key={j} className="pl-8 pr-3 py-2 bg-gray-50 border-t border-gray-100">
                  <span className="text-xs font-bold text-[#333]">└ {r.author}</span>
                  <p className="text-sm mt-0.5">{r.text}</p>
                </div>
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
