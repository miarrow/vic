'use client';
import Image from 'next/image';
import { useState } from 'react';

interface Comment {
  author: { nickname: string; handle: string };
  text: string;
  likes: number;
  replies?: Comment[];
}

interface TwitterContent {
  author: { nickname: string; handle: string; avatar_seed: string };
  text: string;
  images: string[];
  likes: number;
  retweets: number;
  views: number;
  comments: Comment[];
}

function avatarColor(seed: string) {
  const colors = ['#1da1f2', '#e0245e', '#17bf63', '#ffad1f', '#794bc4', '#f45d22'];
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) % colors.length;
  return colors[h];
}

function Avatar({ seed, size = 40 }: { seed: string; size?: number }) {
  return (
    <div
      style={{ width: size, height: size, backgroundColor: avatarColor(seed), borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 700, fontSize: size * 0.4 }}
    >
      {seed[0]?.toUpperCase()}
    </div>
  );
}

function CommentItem({ comment, depth = 0 }: { comment: Comment; depth?: number }) {
  const [open, setOpen] = useState(false);
  return (
    <div style={{ marginLeft: depth * 20 }} className="py-2 border-b border-gray-100">
      <div className="flex gap-2">
        <Avatar seed={comment.author.handle} size={32} />
        <div className="flex-1">
          <span className="font-bold text-sm">{comment.author.nickname}</span>{' '}
          <span className="text-gray-500 text-sm">{comment.author.handle}</span>
          <p className="text-sm mt-0.5">{comment.text}</p>
          <div className="flex gap-4 text-gray-500 text-xs mt-1">
            <span>♥ {comment.likes}</span>
            {comment.replies && comment.replies.length > 0 && (
              <button onClick={() => setOpen(!open)} className="text-blue-500 hover:underline">
                {open ? '답글 숨기기' : `답글 ${comment.replies.length}개`}
              </button>
            )}
          </div>
          {open && comment.replies?.map((r, i) => <CommentItem key={i} comment={r} depth={1} />)}
        </div>
      </div>
    </div>
  );
}

export default function TwitterPost({ content }: { content: TwitterContent }) {
  const [showComments, setShowComments] = useState(false);
  return (
    <div className="bg-white border border-gray-200 rounded-2xl p-4 max-w-xl">
      <div className="flex gap-3">
        <Avatar seed={content.author.avatar_seed} />
        <div className="flex-1">
          <div className="flex items-center gap-1">
            <span className="font-bold">{content.author.nickname}</span>
            <span className="text-blue-400">✓</span>
            <span className="text-gray-500 text-sm">{content.author.handle}</span>
          </div>
          <p className="mt-1 whitespace-pre-wrap">{content.text}</p>
          {content.images?.length > 0 && (
            <div className={`mt-2 grid gap-1 ${content.images.length > 1 ? 'grid-cols-2' : 'grid-cols-1'}`}>
              {content.images.map((src, i) => (
                <div key={i} className="relative aspect-video rounded-xl overflow-hidden bg-gray-100">
                  <Image src={src} alt="" fill className="object-cover" />
                </div>
              ))}
            </div>
          )}
          <div className="flex gap-6 mt-3 text-gray-500 text-sm">
            <span>💬 {content.comments?.length ?? 0}</span>
            <span>🔁 {content.retweets}</span>
            <span>🩵 {content.likes}</span>
            <span>👁 {content.views}</span>
          </div>
          {content.comments?.length > 0 && (
            <button onClick={() => setShowComments(!showComments)} className="mt-2 text-blue-500 text-sm hover:underline">
              {showComments ? '댓글 숨기기' : `댓글 ${content.comments.length}개 보기`}
            </button>
          )}
          {showComments && (
            <div className="mt-2">
              {content.comments.map((c, i) => <CommentItem key={i} comment={c} />)}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
