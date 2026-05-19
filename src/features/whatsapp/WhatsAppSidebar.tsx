import React from 'react';
import { Search, MoreVertical } from 'lucide-react';
import { WhatsAppConversation } from '../../types';

interface WhatsAppSidebarProps {
  conversations: WhatsAppConversation[];
  selectedConversationId?: string;
  onSelectConversation: (id: string) => void;
}

export const WhatsAppSidebar: React.FC<WhatsAppSidebarProps> = ({
  conversations,
  selectedConversationId,
  onSelectConversation,
}) => {
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
    <div className="w-full h-full flex flex-col bg-gray-900 border-r border-gray-700">
      {/* Header */}
      <div className="p-4 border-b border-gray-700 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-emerald-500 flex items-center justify-center">
            <span className="text-white font-bold text-lg">W</span>
          </div>
          <span className="text-white font-black text-xl">WhatsApp</span>
        </div>
        <button className="text-gray-400 hover:text-white transition-colors">
          <MoreVertical size={20} />
        </button>
      </div>

      {/* Search Bar */}
      <div className="p-4 border-b border-gray-700">
        <div className="relative">
          <Search size={18} className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-500" />
          <input
            type="text"
            placeholder="Pesquisar ou começar uma conversa"
            className="w-full bg-gray-800 text-white text-sm pl-10 pr-4 py-2 rounded-full border border-gray-700 focus:border-emerald-500 focus:outline-none transition-colors"
          />
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 px-4 pt-4 pb-3 border-b border-gray-700 overflow-x-auto">
        <button className="px-3 py-1 text-sm font-medium text-white bg-gray-800 rounded-full hover:bg-gray-700 transition-colors whitespace-nowrap">
          Tudo
        </button>
        <button className="px-3 py-1 text-sm font-medium text-gray-400 hover:text-white transition-colors whitespace-nowrap">
          Não lidas
        </button>
        <button className="px-3 py-1 text-sm font-medium text-gray-400 hover:text-white transition-colors whitespace-nowrap">
          Favoritos
        </button>
        <button className="px-3 py-1 text-sm font-medium text-gray-400 hover:text-white transition-colors whitespace-nowrap">
          Grupos
        </button>
      </div>

      {/* Conversations List */}
      <div className="flex-1 overflow-y-auto">
        {conversations.map((conversation) => (
          <button
            key={conversation.id}
            onClick={() => onSelectConversation(conversation.id)}
            className={`w-full px-4 py-3 border-b border-gray-800 hover:bg-gray-800 transition-colors text-left ${
              selectedConversationId === conversation.id ? 'bg-gray-800' : ''
            }`}
          >
            <div className="flex items-start gap-3">
              {/* Avatar */}
              <div className={`relative w-12 h-12 rounded-full ${getAvatarColor(conversation.contact.name)} flex items-center justify-center flex-shrink-0`}>
                <span className="text-white font-bold text-sm">
                  {getAvatarInitials(conversation.contact.name)}
                </span>
                {/* Online Indicator */}
                {conversation.isOnline && (
                  <div className="absolute bottom-0 right-0 w-3 h-3 bg-emerald-400 rounded-full border-2 border-gray-900"></div>
                )}
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2 mb-1">
                  <p className="text-white font-medium text-sm truncate">
                    {conversation.contact.name}
                  </p>
                  <span className="text-gray-500 text-xs flex-shrink-0">
                    {conversation.lastMessageTime}
                  </span>
                </div>
                <p className="text-gray-400 text-xs truncate">
                  {conversation.lastMessage}
                </p>
              </div>

              {/* Unread Badge */}
              {conversation.unreadCount > 0 && (
                <div className="w-5 h-5 rounded-full bg-emerald-500 flex items-center justify-center flex-shrink-0">
                  <span className="text-white text-xs font-bold">
                    {conversation.unreadCount > 9 ? '9+' : conversation.unreadCount}
                  </span>
                </div>
              )}
            </div>
          </button>
        ))}
      </div>
    </div>
  );
};
