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
