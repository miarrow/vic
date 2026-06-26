import Image from 'next/image';

interface Message {
  sender: string;
  text: string;
  image?: string | null;
  time: string;
  is_me: boolean;
}

interface TelegramContent {
  room_name: string;
  messages: Message[];
}

export default function TelegramChat({ content }: { content: TelegramContent }) {
  const senderColors: Record<string, string> = {};
  const palette = ['#e17076', '#7bc862', '#65aadd', '#a695e7', '#ee7aae', '#6ec9cb'];
  let colorIdx = 0;
  const getColor = (name: string) => {
    if (!senderColors[name]) senderColors[name] = palette[colorIdx++ % palette.length];
    return senderColors[name];
  };

  let lastSender = '';

  return (
    <div className="bg-[#17212b] max-w-sm rounded-xl overflow-hidden">
      <div className="bg-[#232e3c] text-white flex items-center gap-2 px-4 py-3 border-b border-[#0d1117]">
        <div className="w-8 h-8 rounded-full bg-blue-500 flex items-center justify-center text-sm font-bold">
          {content.room_name[0]}
        </div>
        <span className="font-medium text-sm">{content.room_name}</span>
      </div>
      <div className="p-3 space-y-1 min-h-64 max-h-[600px] overflow-y-auto">
        {content.messages.map((msg, i) => {
          const showName = !msg.is_me && msg.sender !== lastSender;
          lastSender = msg.sender;
          return (
            <div key={i} className={`flex ${msg.is_me ? 'justify-end' : 'justify-start'} items-end gap-1`}>
              {!msg.is_me && (
                <div className="w-7 self-end mb-1">
                  {showName && (
                    <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs text-white font-bold" style={{ backgroundColor: getColor(msg.sender) }}>
                      {msg.sender[0]}
                    </div>
                  )}
                </div>
              )}
              <div className={`max-w-[72%] flex flex-col ${msg.is_me ? 'items-end' : 'items-start'}`}>
                {!msg.is_me && showName && (
                  <span className="text-xs mb-0.5 ml-2 font-medium" style={{ color: getColor(msg.sender) }}>{msg.sender}</span>
                )}
                {msg.text && (
                  <div className={`px-3 py-2 rounded-xl text-sm text-white relative ${msg.is_me ? 'bg-[#2b5278] rounded-br-sm' : 'bg-[#182533] rounded-bl-sm'}`}>
                    {msg.text}
                    <span className="text-[10px] text-gray-400 ml-2 float-right mt-1">{msg.time}</span>
                  </div>
                )}
                {msg.image && (
                  <div className="relative w-48 h-36 rounded-xl overflow-hidden mt-0.5">
                    <Image src={msg.image} alt="" fill className="object-cover" />
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
