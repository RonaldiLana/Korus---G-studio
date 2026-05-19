import { WhatsAppConversation, WhatsAppMessage } from '../../../types';

export const mockConversations: WhatsAppConversation[] = [
  {
    id: '1',
    contact: {
      name: 'RASCUNHO - THAMIRES',
      phone: '+55 11 93833-3218',
      avatar: 'T',
    },
    lastMessage: 'Você: Visto de turismo am...',
    lastMessageTime: '09:30',
    unreadCount: 2,
    isOnline: true,
  },
  {
    id: '2',
    contact: {
      name: 'SOMA VENDAS - MUNDIAL VISTOS',
      phone: 'Grupo',
      avatar: 'SV',
    },
    lastMessage: 'Igor Santos: Amanda - 70 igo...',
    lastMessageTime: '16:17',
    unreadCount: 0,
    isOnline: false,
  },
  {
    id: '3',
    contact: {
      name: '+55 11 99528-1197',
      phone: '+55 11 99528-1197',
      avatar: 'K',
    },
    lastMessage: 'OK, Kellym! Ainda estamos...',
    lastMessageTime: '10:00',
    unreadCount: 3,
    isOnline: true,
  },
  {
    id: '4',
    contact: {
      name: '+55 31 8361-8081',
      phone: '+55 31 8361-8081',
      avatar: 'B',
    },
    lastMessage: 'Bom dia! Tudo bem? Meu no...',
    lastMessageTime: '09:28',
    unreadCount: 0,
    isOnline: true,
  },
  {
    id: '5',
    contact: {
      name: '+55 14 99162-9980',
      phone: '+55 14 99162-9980',
      avatar: 'R',
    },
    lastMessage: 'Bom dia! Tudo bem? Meu no...',
    lastMessageTime: '09:28',
    unreadCount: 0,
    isOnline: true,
  },
  {
    id: '6',
    contact: {
      name: 'Loja online MV',
      phone: 'Grupo',
      avatar: 'LM',
    },
    lastMessage: '~Mondial Vistos. Sim...',
    lastMessageTime: '08:39',
    unreadCount: 0,
    isOnline: false,
  },
  {
    id: '7',
    contact: {
      name: '+55 11 96728-7514',
      phone: '+55 11 96728-7514',
      avatar: 'O',
    },
    lastMessage: 'Olá, tudo bem? 👋🙌 Obrígado por entrar em cont...',
    lastMessageTime: 'Ontem',
    unreadCount: 0,
    isOnline: false,
  },
];

export const mockMessages: Record<string, WhatsAppMessage[]> = {
  '1': [
    {
      id: '1-1',
      conversationId: '1',
      sender: 'contact',
      content: 'Olá! Tudo bem?',
      timestamp: '09:15',
    },
    {
      id: '1-2',
      conversationId: '1',
      sender: 'user',
      content: 'Opa, tudo certo!',
      timestamp: '09:20',
    },
    {
      id: '1-3',
      conversationId: '1',
      sender: 'contact',
      content: 'Você estava me falando sobre um visto de turismo',
      timestamp: '09:25',
    },
    {
      id: '1-4',
      conversationId: '1',
      sender: 'user',
      content: 'Visto de turismo am...',
      timestamp: '09:30',
    },
  ],
  '2': [
    {
      id: '2-1',
      conversationId: '2',
      sender: 'contact',
      content: 'Igor Santos: Amanda - 70 igo...',
      timestamp: '16:17',
    },
  ],
  '3': [
    {
      id: '3-1',
      conversationId: '3',
      sender: 'contact',
      content: 'Olá, tudo bem?',
      timestamp: '09:45',
    },
    {
      id: '3-2',
      conversationId: '3',
      sender: 'user',
      content: 'Tudo certo! Como posso te ajudar?',
      timestamp: '09:50',
    },
    {
      id: '3-3',
      conversationId: '3',
      sender: 'contact',
      content: 'Gostaria de saber mais sobre vistos',
      timestamp: '09:55',
    },
    {
      id: '3-4',
      conversationId: '3',
      sender: 'user',
      content: 'OK, Kellym! Ainda estamos...',
      timestamp: '10:00',
    },
  ],
  '4': [
    {
      id: '4-1',
      conversationId: '4',
      sender: 'contact',
      content: 'Bom dia! Tudo bem?',
      timestamp: '09:15',
    },
    {
      id: '4-2',
      conversationId: '4',
      sender: 'user',
      content: 'Opa, tudo certo!',
      timestamp: '09:20',
    },
    {
      id: '4-3',
      conversationId: '4',
      sender: 'contact',
      content: 'Meu nome é Rafael',
      timestamp: '09:25',
    },
  ],
  '5': [
    {
      id: '5-1',
      conversationId: '5',
      sender: 'contact',
      content: 'Bom dia!',
      timestamp: '09:15',
    },
    {
      id: '5-2',
      conversationId: '5',
      sender: 'user',
      content: 'Opa, tudo bem!',
      timestamp: '09:20',
    },
  ],
  '6': [
    {
      id: '6-1',
      conversationId: '6',
      sender: 'contact',
      content: '~Mondial Vistos. Sim...',
      timestamp: '08:39',
    },
  ],
  '7': [
    {
      id: '7-1',
      conversationId: '7',
      sender: 'contact',
      content: 'Olá, tudo bem? 👋🙌',
      timestamp: '18:30',
    },
    {
      id: '7-2',
      conversationId: '7',
      sender: 'contact',
      content: 'Obrigado por entrar em contato conosco!',
      timestamp: '18:31',
    },
  ],
};
