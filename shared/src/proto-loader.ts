import * as path from 'path';
import * as grpc from '@grpc/grpc-js';
import * as protoLoader from '@grpc/proto-loader';

const DEFAULT_PROTO_DIR = path.resolve(__dirname, '../../proto');

export interface LoadProtoOptions {
  /** Directory containing .proto files. Defaults to repo's proto/. */
  protoDir?: string;
}

/**
 * Load a .proto file (and its imports) and return the grpc package object.
 * Usage:
 *   const pkg = loadProto('auth.proto');
 *   const service = pkg.messageme.auth.AuthService;
 */
export function loadProto(
  fileName: string,
  options: LoadProtoOptions = {}
): grpc.GrpcObject {
  const protoDir = options.protoDir ?? process.env.PROTO_DIR ?? DEFAULT_PROTO_DIR;
  const filePath = path.join(protoDir, fileName);
  const packageDefinition = protoLoader.loadSync(filePath, {
    keepCase: false,
    longs: String,
    enums: String,
    defaults: true,
    oneofs: true,
    includeDirs: [protoDir],
  });
  return grpc.loadPackageDefinition(packageDefinition);
}

/** Resolve a nested package path like "messageme.auth.AuthService". */
export function resolveService(pkg: grpc.GrpcObject, fqn: string): grpc.ServiceClientConstructor {
  const parts = fqn.split('.');
  let current: any = pkg;
  for (const part of parts) {
    current = current?.[part];
    if (!current) throw new Error(`Service path not found: ${fqn}`);
  }
  return current as grpc.ServiceClientConstructor;
}
