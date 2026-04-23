import 'dotenv/config';

export const config = {
  port: parseInt(process.env.PORT ?? '8080', 10),
  corsOrigin: process.env.CORS_ORIGIN ?? 'http://localhost:5173',

  authServiceAddr: process.env.AUTH_SERVICE_ADDR ?? 'localhost:50051',
  userServiceAddr: process.env.USER_SERVICE_ADDR ?? 'localhost:50052',
  groupServiceAddr: process.env.GROUP_SERVICE_ADDR ?? 'localhost:50053',
  channelServiceAddr: process.env.CHANNEL_SERVICE_ADDR ?? 'localhost:50054',
  directServiceAddr: process.env.DIRECT_SERVICE_ADDR ?? 'localhost:50055',
  messageServiceAddr: process.env.MESSAGE_SERVICE_ADDR ?? 'localhost:50056',
  presenceServiceAddr: process.env.PRESENCE_SERVICE_ADDR ?? 'localhost:50057',
  deliveryServiceAddr: process.env.DELIVERY_SERVICE_ADDR ?? 'localhost:50058',
  fileServiceAddr: process.env.FILE_SERVICE_ADDR ?? 'localhost:50059',
};
