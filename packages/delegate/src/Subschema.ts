import { GraphQLSchema } from 'graphql';

import { SubschemaConfig, Transform, MergedTypeConfig, CreateProxyingResolverFn, Endpoint } from './types';

import { FIELD_SUBSCHEMA_MAP_SYMBOL, OBJECT_SUBSCHEMA_SYMBOL } from './symbols';
import { applySchemaTransforms } from './applySchemaTransforms';

export function getSubschema(result: any, responseKey: string): GraphQLSchema | SubschemaConfig {
  const subschema = result[FIELD_SUBSCHEMA_MAP_SYMBOL] && result[FIELD_SUBSCHEMA_MAP_SYMBOL][responseKey];
  return subschema || result[OBJECT_SUBSCHEMA_SYMBOL];
}

export function setObjectSubschema(result: any, subschema: GraphQLSchema | SubschemaConfig) {
  result[OBJECT_SUBSCHEMA_SYMBOL] = subschema;
}

export function isSubschemaConfig(value: any): value is SubschemaConfig | Subschema {
  return Boolean(value.schema && value.permutations === undefined);
}

export function cloneSubschemaConfig(subschemaConfig: SubschemaConfig): SubschemaConfig {
  const newSubschemaConfig = {
    ...subschemaConfig,
    transforms: subschemaConfig.transforms != null ? [...subschemaConfig.transforms] : undefined,
  };

  if (newSubschemaConfig.merge != null) {
    newSubschemaConfig.merge = { ...subschemaConfig.merge };
    Object.keys(newSubschemaConfig.merge).forEach(typeName => {
      newSubschemaConfig.merge[typeName] = { ...subschemaConfig.merge[typeName] };

      const fields = newSubschemaConfig.merge[typeName].fields;
      if (fields != null) {
        Object.keys(fields).forEach(fieldName => {
          fields[fieldName] = { ...fields[fieldName] };
        });
      }

      const computedFields = newSubschemaConfig.merge[typeName].computedFields;
      if (computedFields != null) {
        Object.keys(computedFields).forEach(fieldName => {
          computedFields[fieldName] = { ...computedFields[fieldName] };
        });
      }
    });
  }

  return newSubschemaConfig;
}

export function isSubschema(value: any): value is Subschema {
  return Boolean(value.transformedSchema);
}

export class Subschema {
  public schema: GraphQLSchema;

  public endpoint?: Endpoint;

  public createProxyingResolver?: CreateProxyingResolverFn;
  public transforms: Array<Transform>;
  public transformedSchema: GraphQLSchema;

  public merge?: Record<string, MergedTypeConfig>;

  constructor(config: SubschemaConfig) {
    this.schema = config.schema;

    this.endpoint = config.endpoint;

    this.createProxyingResolver = config.createProxyingResolver;
    this.transforms = config.transforms ?? [];
    this.transformedSchema = applySchemaTransforms(this.schema, this.transforms);

    this.merge = config.merge;
  }
}
