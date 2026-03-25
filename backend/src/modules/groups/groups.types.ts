export interface CreateGroupDto {
  name: string;
  description?: string;
}

export interface AddMemberDto {
  userId: string;
}

export interface CreateChannelDto {
  name: string;
  description?: string;
}
