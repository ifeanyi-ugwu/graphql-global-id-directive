import { getDirective, MapperKind, mapSchema } from "@graphql-tools/utils";
import { defaultFieldResolver, GraphQLSchema } from "graphql";
import {
  globalIdDecode,
  GlobalIdDecodeResult,
  globalIdEncode,
  wrapType,
} from "./utils.js";

export class GlobalIdDirective {
  private encodeFn: (id: string, typeName: string) => string | undefined;
  private decodeFn: (globalId: string) => GlobalIdDecodeResult;

  constructor() {
    this.encodeFn = globalIdEncode;
    this.decodeFn = globalIdDecode;
  }

  globalIdEncodeDirective(directiveName: string) {
    const typeDirectiveArgumentMaps: Record<string, any> = {};

    return {
      globalIdEncodeDirectiveTypeDefs: `directive @${directiveName}(typeName: String!) on FIELD_DEFINITION`,
      globalIdEncodeDirectiveTransformer: (schema: GraphQLSchema) =>
        mapSchema(schema, {
          [MapperKind.OBJECT_FIELD]: (fieldConfig, _fieldName, typeName) => {
            const globalIdEncodeDirective =
              getDirective(schema, fieldConfig, directiveName)?.[0] ??
              typeDirectiveArgumentMaps[typeName];
            if (globalIdEncodeDirective) {
              const { typeName } = globalIdEncodeDirective;
              const { resolve = defaultFieldResolver } = fieldConfig;

              fieldConfig.resolve = async (source, args, context, info) => {
                const result = await resolve.call(
                  this,
                  source,
                  args,
                  context,
                  info
                );

                //return this.encodeFn(result.toString(), typeName);

                // Check if result is null or undefined before calling toString()
                if (result != null) {
                  return this.encodeFn(result.toString(), typeName);
                } else {
                  //throw new Error("Result is null or undefined.");
                }
              };
              return fieldConfig;
            }
          },
        }),
    };
  }

  globalIdDecodeDirective(directiveName: string) {
    const typeDirectiveArgumentMaps: Record<string, any> = {};

    return {
      globalIdDecodeDirectiveTypeDefs: `directive @${directiveName}(returnIdOnly: Boolean = true) on ARGUMENT_DEFINITION | INPUT_FIELD_DEFINITION | FIELD_DEFINITION`,
      globalIdDecodeDirectiveTransformer: (schema: GraphQLSchema) =>
        mapSchema(schema, {
          [MapperKind.OBJECT_FIELD]: (fieldConfig, fieldName, typeName) => {
            const originalResolve = fieldConfig.resolve || defaultFieldResolver;
            fieldConfig.resolve = (source, args, context, info) => {
              if (fieldConfig.args) {
                Object.keys(fieldConfig.args).forEach((argName) => {
                  const argConfig = fieldConfig.args![argName];
                  const globalIdDecodeDirective = getDirective(
                    schema,
                    argConfig,
                    directiveName
                  )?.[0];
                  if (globalIdDecodeDirective) {
                    const decodedObject = this.decodeFn(args[argName]);
                    args[argName] =
                      globalIdDecodeDirective.returnIdOnly !== false
                        ? decodedObject.id
                        : JSON.stringify(decodedObject);
                  }
                });
              }
              return originalResolve.call(this, source, args, context, info);
            };
            return fieldConfig;
          },

          [MapperKind.INPUT_OBJECT_FIELD]: (
            inputFieldConfig,
            fieldName,
            typeName
          ) => {
            const globalIdDecodeDirective = getDirective(
              schema,
              inputFieldConfig,
              directiveName
            )?.[0];
            if (globalIdDecodeDirective) {
              wrapType(inputFieldConfig, globalIdDecodeDirective, this);
            }
            return inputFieldConfig;
          },
        }),
    };
  }
}
