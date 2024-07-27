import { GraphQLList, GraphQLNonNull, GraphQLScalarType } from "graphql";

export function getDecodedType(
  originalType: GraphQLScalarType,
  directiveArgumentMap: any,
  self: any
) {
  return new GraphQLScalarType({
    ...originalType.toConfig(),
    name: `Decodable${originalType.name}`,
    parseValue: (value: unknown) => {
      const parsedValue = originalType.parseValue(value);

      if (typeof parsedValue === "string") {
        try {
          const decodedObject = self.decodeFn(parsedValue);
          return directiveArgumentMap.returnIdOnly !== false
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

export function wrapType(
  fieldConfig: any,
  directiveArgumentMap: any,
  self: any
) {
  const { type } = fieldConfig;
  if (type instanceof GraphQLScalarType) {
    fieldConfig.type = getDecodedType(type, directiveArgumentMap, self);
  } else if (
    type instanceof GraphQLNonNull &&
    type.ofType instanceof GraphQLScalarType
  ) {
    fieldConfig.type = new GraphQLNonNull(
      getDecodedType(type.ofType, directiveArgumentMap, self)
    );
  } else if (
    type instanceof GraphQLList &&
    type.ofType instanceof GraphQLScalarType
  ) {
    fieldConfig.type = new GraphQLList(
      getDecodedType(type.ofType, directiveArgumentMap, self)
    );
  } else if (
    type instanceof GraphQLNonNull &&
    type.ofType instanceof GraphQLList &&
    type.ofType.ofType instanceof GraphQLScalarType
  ) {
    fieldConfig.type = new GraphQLNonNull(
      new GraphQLList(
        getDecodedType(type.ofType.ofType, directiveArgumentMap, self)
      )
    );
  }
}

// Default encode function
export function globalIdEncode(
  id: string,
  typeName: string
): string | undefined {
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

export type GlobalIdDecodeResult = {
  id: string | undefined;
  __typename: string | undefined;
};

// Default decode function
export function globalIdDecode(globalId: string): GlobalIdDecodeResult {
  if (globalId === undefined || globalId === null)
    return { id: undefined, __typename: undefined };
  const paddedGlobalId = globalId + "===".slice((globalId.length + 3) % 4);
  const urlSafeGlobalId = paddedGlobalId.replace(/-/g, "+").replace(/_/g, "/");
  const decoded = Buffer.from(urlSafeGlobalId, "base64").toString("utf8");
  const parts = decoded.split(":");

  if (parts.length !== 2) {
    throw new Error(`Invalid global ID: ${globalId}`);
  }

  return { id: parts[0], __typename: parts[1] };
}
