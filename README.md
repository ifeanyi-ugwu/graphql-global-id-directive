# Graphql Global Id Directive

While transitioning to the use of global IDs (commonly known as node IDs), I found that encoding and decoding these IDs was a necessary step in various parts of my application, especially when using database IDs for queries and mutations. I sought a way to simplify this process by decoding the IDs before they reached the resolvers and encoding them on their way out. To address this, I created this package to make the use of global IDs straightforward and efficient. This package includes a `GlobalIdDirective` class, which offers two directives: `globalIdEncodeDirective` and `globalIdDecodeDirective`. These directives handle the encoding and decoding of global IDs, making the integration of global IDs into any GraphQL application a breeze.

## Installation

```bash
npm install graphql-global-id-directive
```

## Usage

First, import and create an instance of the `GlobalIdDirective` class:

```JavaScript
import { GlobalIdDirective } from "graphql-global-id-directive";
const globalIdDirective = new GlobalIdDirective();
```

### Define your schema

```js
const typeDefs = `
  interface Node {
    id: ID!
  }

  type Query {
    user(id: ID! @globalIdDecode): User
    node(id: ID! @globalIdDecode(returnIdOnly: false)): Node
  }

  type User implements Node {
    id: ID! @encodeGlobalId(typeName: "User")
    name: String
    email: String
  }
`;
```

In the type definition of the node query, use the `@globalIdDecode` directive with the `returnIdOnly` option set to `false`. This ensures that the stringified decoded global ID object is returned instead of just the underlying id which is the default behavior, allowing you to parse and use both the underlying `id` and `__typename` in your resolver.

### Apply the directives to your schema

```js
const { globalIdEncodeDirectiveTypeDefs, globalIdEncodeDirectiveTransformer } =
  globalIdDirective.globalIdEncodeDirective("encodeGlobalId"); // Use any name of your choice but avoid collisions with other directive names

const { globalIdDecodeDirectiveTypeDefs, globalIdDecodeDirectiveTransformer } =
  globalIdDirective.globalIdDecodeDirective("decodeGlobalId");

let schema = makeExecutableSchema({
  typeDefs: [
    typeDefs,
    globalIdEncodeDirectiveTypeDefs,
    globalIdDecodeDirectiveTypeDefs,
  ],
});

const directiveTransformers = [
  globalIdEncodeDirectiveTransformer,
  globalIdDecodeDirectiveTransformer,
];

schema = directiveTransformers.reduce(
  (currentSchema, transformer) => transformer(currentSchema),
  schema
);
```

## Using GlobalIdDirective with Node Resolver

You can utilize the decoded global IDs in your node resolver to retrieve any instance of a node. Here's an example of how you can do this:

```javascript
node: async (_, args, { dataSources }) => {
  // Parse the stringified ID back into an object
  const { id, __typename } = JSON.parse(args.id.toString());

  let node;
  switch (__typename) {
    case "User":
      node = await dataSources.userDb.getUser({ userId: id }); // Or fetch the user directly with the model. EG: UserModel.findById(id)
      break;
    case "Product":
      node = await dataSources.productDb.getProduct({ productId: id });
      break;
    case "Order":
      node = await dataSources.brandDb.getOrder({ orderId: id });
      break;
    // Add more cases as needed for other typenames
    default:
      throw new Error(`Unsupported typename: ${__typename}`); //Or do  perform another action
  }

  return { ...node.toObject({ virtuals: true }), __typename }; // I used a Mongoose document for this example
};
```

## Customization

The `GlobalIdDirective` class is designed to be easily customizable. You can extend the class and override the `encodeFn` and `decodeFn` methods to provide your own implementation for encoding and decoding global IDs.

Here's an example of how you can do this:

```javascript
class CustomGlobalIdDirective extends GlobalIdDirective {
  encodeFn(id, typeName) {
    // Your custom encoding logic here
  }

  decodeFn(globalId) {
    // Your custom decoding logic here
  }
}

const customGlobalIdDirective = new CustomGlobalIdDirective();
```

In this example, CustomGlobalIdDirective is a subclass of GlobalIdDirective. It overrides the encodeFn and decodeFn methods with custom logic for encoding and decoding global IDs.

## Contributing

Want to make this package even better? Fork the repository and submit a pull request to contribute.

## License

MIT License - see the [LICENSE](LICENSE) file for details.
