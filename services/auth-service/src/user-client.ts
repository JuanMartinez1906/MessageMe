import * as grpc from '@grpc/grpc-js';
import { loadProto, resolveService } from '@messageme/shared';
import { config } from './config';

const userPkg = loadProto('user.proto');
const UserServiceCtor = resolveService(userPkg, 'messageme.user.UserService');

export const userClient = new UserServiceCtor(
  config.userServiceAddr,
  grpc.credentials.createInsecure()
);

type UnaryFn<Req, Res> = (
  req: Req,
  cb: (err: grpc.ServiceError | null, res: Res) => void
) => void;

function call<Req, Res>(fn: UnaryFn<Req, Res>, req: Req): Promise<Res> {
  return new Promise((resolve, reject) => {
    fn.call(userClient, req, (err, res) => (err ? reject(err) : resolve(res)));
  });
}

export interface CreateProfileArgs {
  userId: string;
  email: string;
  username: string;
  displayName: string;
}

export interface UserProfile {
  userId: string;
  email: string;
  username: string;
  displayName: string;
  avatarUrl: string;
  createdAt?: { seconds: string; nanos: number };
}

export const userRpc = {
  createProfile: (args: CreateProfileArgs) =>
    call<CreateProfileArgs, UserProfile>((userClient as any).createProfile, args),
};
