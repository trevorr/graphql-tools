import { buildSchema, GraphQLFieldResolver, GraphQLSchema } from 'graphql';

import { IMakeRemoteExecutableSchemaOptions } from './types';
import { Executor, Subscriber, delegateToSchema } from '@graphql-tools/delegate';

import { wrapSchema } from './wrapSchema';

export function makeRemoteExecutableSchema({
  schema: schemaOrTypeDefs,
  executor,
  subscriber,
  createResolver = defaultCreateRemoteResolver,
  buildSchemaOptions,
}: IMakeRemoteExecutableSchemaOptions): GraphQLSchema {
  const targetSchema =
    typeof schemaOrTypeDefs === 'string' ? buildSchema(schemaOrTypeDefs, buildSchemaOptions) : schemaOrTypeDefs;

  return wrapSchema({
    schema: targetSchema,
    createProxyingResolver: () => createResolver(executor, subscriber),
  });
}

export function defaultCreateRemoteResolver(
  executor: Executor,
  subscriber: Subscriber
): GraphQLFieldResolver<any, any> {
  return (_parent, _args, context, info) =>
    delegateToSchema({
      schema: { schema: info.schema, endpoint: { executor, subscriber } },
      context,
      info,
    });
}
