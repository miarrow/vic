import { GoogleGenerativeAI } from '@google/generative-ai';
import fs from 'fs';
import path from 'path';

const SCHEMAS: Record<string, string> = {
  twitter: `{
  "author": { "nickname": "표시이름", "handle": "@아이디", "avatar_seed": "임의문자열" },
  "text": "트윗 본문",
  "images": ["/uploads/파일명 또는 빈배열"],
  "likes": 숫자, "retweets": 숫자, "views": 숫자,
  "comments": [{ "author": { "nickname": "", "handle": "" }, "text": "", "likes": 숫자, "replies": [] }]
}`,
  dcinside: `{
  "gallery": "갤러리명",
  "title": "제목",
  "author": "닉네임",
  "body": "본문 (마크다운 가능)",
  "images": ["/uploads/파일명 또는 빈배열"],
  "views": 숫자, "recommend": 숫자, "not_recommend": 숫자,
  "comments": [{ "author": "", "text": "", "recommend": 숫자, "replies": [{ "author": "", "text": "" }] }]
}`,
  navernews: `{
  "source": "언론사명",
  "title": "뉴스 제목",
  "author": "기자명",
  "body": "기사 본문",
  "images": ["/uploads/파일명 또는 빈배열"],
  "views": 숫자, "likes": 숫자,
  "published_at": "YYYY-MM-DD HH:mm",
  "comments": [{ "author": "", "text": "", "likes": 숫자, "replies": [{ "author": "", "text": "" }] }]
}`,
  instagram: `{
  "author": { "nickname": "", "avatar_seed": "임의문자열" },
  "images": ["/uploads/파일명 (최소 1장)"],
  "caption": "캡션",
  "likes": 숫자,
  "comments": [{ "author": "", "text": "", "replies": [{ "author": "", "text": "" }] }]
}`,
  kakao: `{
  "room_name": "채팅방 이름",
  "messages": [
    { "sender": "이름", "text": "메시지", "image": null또는"/uploads/파일명", "time": "오후 3:22", "is_me": false },
    ...
  ]
}`,
  telegram: `{
  "room_name": "채팅방 이름",
  "messages": [
    { "sender": "이름", "text": "메시지", "image": null또는"/uploads/파일명", "time": "15:22", "is_me": false },
    ...
  ]
}`,
};

export async function generateContent(
  platform: string,
  userPrompt: string,
  imagePaths: string[]
): Promise<object> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey === 'your_api_key_here') throw new Error('GEMINI_API_KEY가 설정되지 않았습니다.');

  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });

  const schema = SCHEMAS[platform];
  const systemInstruction = `너는 ${platform} 플랫폼의 게시글/채팅 데이터를 JSON으로 생성하는 AI야.
사용자의 지시에 따라 아래 JSON 스키마를 정확히 따르는 데이터를 만들어야 해.
이미지가 제공되면 messages나 본문의 적절한 위치에 이미지 경로를 배치해.
반드시 JSON만 출력하고 다른 설명은 하지 마. 코드블록(\`\`\`json)으로 감싸도 돼.

스키마:
${schema}

이미지 경로 목록 (제공된 경우 적절히 배치):
${imagePaths.length > 0 ? imagePaths.join('\n') : '없음'}`;

  const parts: Parameters<typeof model.generateContent>[0] extends { contents: infer C } ? C : never[] = [];

  const imageParts = await Promise.all(
    imagePaths.map(async (p) => {
      const abs = path.join(process.cwd(), 'public', p);
      const data = fs.readFileSync(abs).toString('base64');
      const ext = path.extname(p).slice(1).toLowerCase();
      const mimeMap: Record<string, string> = { jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', gif: 'image/gif', webp: 'image/webp' };
      return { inlineData: { data, mimeType: mimeMap[ext] ?? 'image/jpeg' } };
    })
  );

  const result = await model.generateContent([
    { text: systemInstruction },
    ...imageParts,
    { text: `지시: ${userPrompt}` },
  ]);

  const text = result.response.text();
  const match = text.match(/```json\s*([\s\S]*?)```/) ?? text.match(/```\s*([\s\S]*?)```/);
  const jsonStr = match ? match[1] : text;

  return JSON.parse(jsonStr.trim());
}
