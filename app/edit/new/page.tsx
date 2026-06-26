'use client';
import { useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import TwitterPost from '@/components/platforms/TwitterPost';
import DcinsidePost from '@/components/platforms/DcinsidePost';
import NaverNewsPost from '@/components/platforms/NaverNewsPost';
import InstagramPost from '@/components/platforms/InstagramPost';
import KakaoChat from '@/components/platforms/KakaoChat';
import TelegramChat from '@/components/platforms/TelegramChat';

const PLATFORMS = ['twitter', 'dcinside', 'navernews', 'instagram', 'kakao', 'telegram'] as const;
type Platform = typeof PLATFORMS[number];

const PLATFORM_LABELS: Record<Platform, string> = {
  twitter: '트위터', dcinside: '디시인사이드', navernews: '네이버뉴스',
  instagram: '인스타그램', kakao: '카카오톡', telegram: '텔레그램',
};

function renderPreview(platform: Platform, content: unknown) {
  switch (platform) {
    case 'twitter': return <TwitterPost content={content as Parameters<typeof TwitterPost>[0]['content']} />;
    case 'dcinside': return <DcinsidePost content={content as Parameters<typeof DcinsidePost>[0]['content']} />;
    case 'navernews': return <NaverNewsPost content={content as Parameters<typeof NaverNewsPost>[0]['content']} />;
    case 'instagram': return <InstagramPost content={content as Parameters<typeof InstagramPost>[0]['content']} />;
    case 'kakao': return <KakaoChat content={content as Parameters<typeof KakaoChat>[0]['content']} />;
    case 'telegram': return <TelegramChat content={content as Parameters<typeof TelegramChat>[0]['content']} />;
  }
}

export default function NewPostPage() {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [platform, setPlatform] = useState<Platform>('twitter');
  const [prompt, setPrompt] = useState('');
  const [imageFiles, setImageFiles] = useState<File[]>([]);
  const [imagePreviews, setImagePreviews] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [generated, setGenerated] = useState<unknown>(null);
  const [saving, setSaving] = useState(false);

  const handleFiles = (files: FileList | null) => {
    if (!files) return;
    const arr = Array.from(files).slice(0, 5);
    setImageFiles(arr);
    setImagePreviews(arr.map(f => URL.createObjectURL(f)));
  };

  const generate = async () => {
    if (!prompt.trim()) { setError('지시 내용을 입력해주세요.'); return; }
    setError('');
    setLoading(true);
    setGenerated(null);
    try {
      let uploadedPaths: string[] = [];
      if (imageFiles.length > 0) {
        const fd = new FormData();
        imageFiles.forEach(f => fd.append('files', f));
        const upRes = await fetch('/api/upload', { method: 'POST', body: fd });
        const upData = await upRes.json();
        if (!upRes.ok) throw new Error(upData.error ?? '업로드 실패');
        uploadedPaths = upData.paths;
      }
      const genRes = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ platform, prompt, image_paths: uploadedPaths }),
      });
      const genData = await genRes.json();
      if (!genRes.ok) throw new Error(genData.error ?? 'AI 생성 실패');
      setGenerated(genData.content);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : '오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  };

  const save = async () => {
    if (!generated) return;
    setSaving(true);
    const res = await fetch('/api/posts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ platform, content: generated, ai_prompt: prompt }),
    });
    if (res.ok) {
      router.push('/edit');
    } else {
      setError('저장 실패');
      setSaving(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto px-4 py-6">
      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => router.back()} className="text-gray-500 hover:text-gray-700 text-sm">← 뒤로</button>
        <h1 className="text-xl font-bold text-gray-800">새 게시글 만들기</h1>
      </div>

      <div className="space-y-5">
        {/* 플랫폼 선택 */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">플랫폼</label>
          <div className="flex flex-wrap gap-2">
            {PLATFORMS.map(p => (
              <button key={p} onClick={() => setPlatform(p)}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition ${platform === p ? 'bg-gray-800 text-white' : 'bg-white border border-gray-300 text-gray-600 hover:bg-gray-50'}`}>
                {PLATFORM_LABELS[p]}
              </button>
            ))}
          </div>
        </div>

        {/* 이미지 업로드 */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">이미지 (선택, 최대 5장)</label>
          <div className="flex flex-wrap gap-2 mb-2">
            {imagePreviews.map((src, i) => (
              <div key={i} className="relative w-20 h-20 rounded-lg overflow-hidden border border-gray-200">
                <Image src={src} alt="" fill className="object-cover" />
                <button onClick={() => {
                  const newFiles = imageFiles.filter((_, j) => j !== i);
                  const newPreviews = imagePreviews.filter((_, j) => j !== i);
                  setImageFiles(newFiles);
                  setImagePreviews(newPreviews);
                }} className="absolute top-0.5 right-0.5 bg-black bg-opacity-50 text-white w-4 h-4 rounded-full text-xs flex items-center justify-center">×</button>
              </div>
            ))}
            {imageFiles.length < 5 && (
              <button onClick={() => fileRef.current?.click()}
                className="w-20 h-20 border-2 border-dashed border-gray-300 rounded-lg flex items-center justify-center text-gray-400 hover:border-gray-400 text-2xl">
                +
              </button>
            )}
          </div>
          <input ref={fileRef} type="file" accept="image/*" multiple className="hidden" onChange={e => handleFiles(e.target.files)} />
        </div>

        {/* 프롬프트 입력 */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">AI 지시 내용</label>
          <textarea value={prompt} onChange={e => setPrompt(e.target.value)}
            rows={4} placeholder="예: 고양이 밈에 대한 트위터 게시글을 만들어줘. 이미지는 본문에 넣어줘."
            className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 resize-none" />
        </div>

        {error && <p className="text-red-500 text-sm">{error}</p>}

        <button onClick={generate} disabled={loading}
          className="w-full bg-blue-600 text-white py-2.5 rounded-xl font-medium hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition">
          {loading ? 'AI가 생성 중...' : 'AI로 생성하기'}
        </button>
      </div>

      {generated != null && (
        <div className="mt-8">
          <h2 className="text-base font-semibold text-gray-700 mb-3">미리보기</h2>
          <div className="flex justify-center mb-4">
            {renderPreview(platform, generated)}
          </div>
          <div className="flex gap-3">
            <button onClick={generate} disabled={loading}
              className="flex-1 border border-gray-300 text-gray-700 py-2 rounded-xl text-sm hover:bg-gray-50 disabled:opacity-50">
              다시 생성
            </button>
            <button onClick={save} disabled={saving}
              className="flex-1 bg-green-600 text-white py-2 rounded-xl text-sm hover:bg-green-500 disabled:opacity-50">
              {saving ? '저장 중...' : '저장'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
