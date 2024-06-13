import { getDirective, MapperKind, mapSchema } from "@graphql-tools/utils";
import {
  defaultFieldResolver,
  GraphQLScalarType,
  GraphQLSchema,
} from "graphql";

export class GlobalIdDirective {
  constructor() {}

  encodeFn(id: string, typeName: string) {
    if (
      id === null ||
      id === undefined ||
      typeName === null ||
      typeName === undefined
    ) {
      return;
    }
    return Buffer.from(`${id}:${typeName}`, "utf8")
      .toString("base64")
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=+$/, "");
  }

  decodeFn(globalId: string) {
    if (globalId === undefined || globalId === null) return {};
    const paddedGlobalId = globalId + "===".slice((globalId.length + 3) % 4);
    const urlSafeGlobalId = paddedGlobalId
      .replace(/-/g, "+")
      .replace(/_/g, "/");
    const decoded = Buffer.from(urlSafeGlobalId, "base64").toString("utf8");
    const parts = decoded.split(":");

    // Check if the decoded string has the correct format
    if (parts.length !== 2) {
      throw new Error(`Invalid global ID: ${globalId}`);
    }

    return { id: parts[0], __typename: parts[1] };
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
      globalIdDecodeDirectiveTypeDefs: `directive @${directiveName}(returnIdOnly: Boolean = true) on ARGUMENT_DEFINITION | INPUT_FIELD_DEFINITION`,
      globalIdDecodeDirectiveTransformer: (schema: GraphQLSchema) =>
        mapSchema(schema, {
          [MapperKind.OBJECT_FIELD]: (fieldConfig, fieldName, typeName) => {
            const originalResolve = fieldConfig.resolve || defaultFieldResolver;
            fieldConfig.resolve = (source, args, context, info) => {
              if (fieldConfig.args) {
                // Decode all arguments that have the directive
                Object.keys(fieldConfig.args).forEach((argName) => {
                  const argConfig = fieldConfig.args![argName];
                  const globalIdDecodeDirective = getDirective(
                    schema,
                    argConfig,
                    directiveName
                  )?.[0];
                  if (globalIdDecodeDirective) {
                    const decodedObject = this.decodeFn(args[argName]);

                    // args[argName] = globalIdDecode(args[argName]);

                    // Use only the id from the decoded object if returnIdOnly is true
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
            const globalIdDecodeDirective =
              getDirective(schema, inputFieldConfig, directiveName)?.[0] ??
              typeDirectiveArgumentMaps[typeName];
            if (globalIdDecodeDirective) {
              if (inputFieldConfig.type instanceof GraphQLScalarType) {
                const originalType = inputFieldConfig.type;
                const self = this; // Capture 'this' reference
                inputFieldConfig.type = new GraphQLScalarType({
                  ...originalType.toConfig(),
                  name: `Decodable${originalType.name}`,
                  //description: `A  decoded ${originalType.name}`,
                  //  serialize: originalType.serialize.bind(originalType),
                  /*parseValue(value) {
                  return originalType.parseValue.bind(originalType)(value);
                },*/
                  parseValue: (value: unknown) => {
                    // Parse value with original parseValue method
                    const parsedValue =
                      originalType.parseValue.bind(originalType)(value);

                    // Parse global ID to raw ID
                    if (typeof parsedValue === "string") {
                      try {
                        const decodedObject = self.decodeFn(parsedValue);
                        return globalIdDecodeDirective.returnIdOnly !== false
                          ? decodedObject.id
                          : JSON.stringify(decodedObject);
                      } catch (err) {
                        throw new Error("Invalid GlobalId");
                      }
                    }
                    throw new Error("Expected string for parsing into ID");
                  },
                });
              }
              return inputFieldConfig;
            }
          },
        }),
    };
  }
}
