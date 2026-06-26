import Image from 'next/image';

interface Message {
  sender: string;
  text: string;
  image?: string | null;
  time: string;
  is_me: boolean;
}

interface KakaoContent {
  room_name: string;
  messages: Message[];
}

export default function KakaoChat({ content }: { content: KakaoContent }) {
  const senderColors: Record<string, string> = {};
  const palette = ['#e8a0bf', '#96ceb4', '#88d8b0', '#ff9999', '#a29bfe', '#74b9ff'];
  let colorIdx = 0;
  const getColor = (name: string) => {
    if (!senderColors[name]) senderColors[name] = palette[colorIdx++ % palette.length];
    return senderColors[name];
  };

  let lastSender = '';

  return (
    <div className="bg-[#b2c7d9] max-w-sm rounded-xl overflow-hidden">
      <div className="bg-[#5c7e9a] text-white text-center py-3 text-sm font-medium">
        {content.room_name}
      </div>
      <div className="p-3 space-y-1 min-h-64 max-h-[600px] overflow-y-auto">
        {content.messages.map((msg, i) => {
          const showName = !msg.is_me && msg.sender !== lastSender;
          lastSender = msg.sender;
          return (
            <div key={i} className={`flex ${msg.is_me ? 'justify-end' : 'justify-start'} items-end gap-1`}>
              {!msg.is_me && (
                <div className="flex flex-col items-center w-8 self-start mt-1">
                  {showName && (
                    <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs text-white font-bold mb-0.5" style={{ backgroundColor: getColor(msg.sender) }}>
                      {msg.sender[0]}
                    </div>
                  )}
                  {!showName && <div className="w-8" />}
                </div>
              )}
              <div className={`max-w-[70%] ${msg.is_me ? 'items-end' : 'items-start'} flex flex-col`}>
                {!msg.is_me && showName && <span className="text-xs text-gray-700 mb-0.5 ml-1">{msg.sender}</span>}
                {msg.text && (
                  <div className={`px-3 py-2 rounded-2xl text-sm ${msg.is_me ? 'bg-[#ffeb00] rounded-br-sm' : 'bg-white rounded-bl-sm'}`}>
                    {msg.text}
                  </div>
                )}
                {msg.image && (
                  <div className="relative w-48 h-36 rounded-xl overflow-hidden mt-0.5">
                    <Image src={msg.image} alt="" fill className="object-cover" />
                  </div>
                )}
                <span className={`text-[10px] text-gray-500 mt-0.5 ${msg.is_me ? 'text-right' : 'text-left'}`}>{msg.time}</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
