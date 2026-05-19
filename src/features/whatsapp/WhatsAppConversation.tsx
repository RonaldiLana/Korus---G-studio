import React, { useEffect, useRef } from 'react';
import { Phone, Video, MoreVertical } from 'lucide-react';
import { WhatsAppConversation, WhatsAppMessage } from '../../types';

interface WhatsAppConversationProps {
  conversation: WhatsAppConversation | undefined;
  messages: WhatsAppMessage[];
}

export const WhatsAppConversation: React.FC<WhatsAppConversationProps> = ({
  conversation,
  messages,
}) => {
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  if (!conversation) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-black">
        <div className="text-center">
          <div className="text-4xl mb-4">💬</div>
          <p className="text-gray-400">Selecione uma conversa para começar</p>
        </div>
      </div>
    );
  }

  const getAvatarInitials = (name: string): string => {
    return name
      .split(' ')
      .slice(0, 2)
      .map((part) => part[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  const getAvatarColor = (name: string): string => {
    const colors = [
      'bg-emerald-500',
      'bg-blue-500',
      'bg-purple-500',
      'bg-pink-500',
      'bg-amber-500',
      'bg-indigo-500',
      'bg-cyan-500',
    ];
    const index = name.charCodeAt(0) % colors.length;
    return colors[index];
  };

  return (
    <div className="w-full h-full flex flex-col bg-black">
      {/* Header */}
      <div className="px-6 py-4 border-b border-gray-800 flex items-center justify-between bg-black">
        <div className="flex items-center gap-4">
          {/* Avatar */}
          <div className={`relative w-10 h-10 rounded-full ${getAvatarColor(conversation.contact.name)} flex items-center justify-center`}>
            <span className="text-white font-bold text-xs">
              {getAvatarInitials(conversation.contact.name)}
            </span>
            {conversation.isOnline && (
              <div className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-emerald-400 rounded-full border-2 border-black"></div>
            )}
          </div>

          {/* Info */}
          <div>
            <p className="text-white font-medium">{conversation.contact.name}</p>
            <p className="text-gray-500 text-xs">
              {conversation.isOnline ? 'Online' : 'Offline'}
            </p>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-4">
          <button className="text-gray-400 hover:text-white transition-colors">
            <Phone size={20} />
          </button>
          <button className="text-gray-400 hover:text-white transition-colors">
            <Video size={20} />
          </button>
          <button className="text-gray-400 hover:text-white transition-colors">
            <MoreVertical size={20} />
          </button>
        </div>
      </div>

      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto p-6 flex flex-col gap-4">
        {messages.length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <p className="text-gray-500 text-sm">Nenhuma mensagem ainda</p>
          </div>
        ) : (
          messages.map((message) => (
            <div
              key={message.id}
              className={`flex ${message.sender === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-xs px-4 py-2 rounded-lg ${
                  message.sender === 'user'
                    ? 'bg-cyan-600 text-white'
                    : 'bg-gray-800 text-gray-100'
                }`}
              >
                <p className="text-sm break-words">{message.content}</p>
                <p className="text-xs mt-1 opacity-70">{message.timestamp}</p>
              </div>
            </div>
          ))
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <div className="px-6 py-4 border-t border-gray-800 bg-black">
        <div className="flex items-center gap-3">
          <input
            type="text"
            placeholder="Abre no web.whatsapp.com para enviar mensagens"
            disabled
            className="flex-1 bg-gray-900 text-gray-500 text-sm px-4 py-3 rounded-full border border-gray-800 focus:outline-none cursor-not-allowed"
          />
          <button disabled className="text-gray-600 cursor-not-allowed">
            😊
          </button>
          <button disabled className="text-gray-600 cursor-not-allowed">
            📎
          </button>
          <button disabled className="text-gray-600 cursor-not-allowed">
            🎤
          </button>
        </div>
      </div>
    </div>
  );
};
