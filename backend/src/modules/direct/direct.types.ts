export interface CreateConversationDto {
  participantId: string;
}

export interface SendDirectMessageDto {
  content: string;
  type?: 'TEXT' | 'IMAGE' | 'FILE' | 'AUDIO';
  fileUrl?: string;
}
