# Solidity API reference (cheatsheet)

Project compiler: solc 0.8.36 (`contracts/foundry.toml`).

## Operator precedence (evaluated top to bottom)

| # | Description | Operator |
|---|---|---|
| 1 | Postfix increment and decrement | `++`, `--` |
| 1 | New expression | `new <typename>` |
| 1 | Array subscripting | `<array>[<index>]` |
| 1 | Member access | `<object>.<member>` |
| 1 | Function-like call | `<func>(<args...>)` |
| 1 | Parentheses | `(<statement>)` |
| 2 | Prefix increment and decrement | `++`, `--` |
| 2 | Unary minus | `-` |
| 2 | Unary operations | `delete` |
| 2 | Logical NOT | `!` |
| 2 | Bitwise NOT | `~` |
| 3 | Exponentiation | `**` |
| 4 | Multiplication, division and modulo | `*`, `/`, `%` |
| 5 | Addition and subtraction | `+`, `-` |
| 6 | Bitwise shift | `<<`, `>>` |
| 7 | Bitwise AND | `&` |
| 8 | Bitwise XOR | `^` |
| 9 | Bitwise OR | `\|` |
| 10 | Inequality | `<`, `>`, `<=`, `>=` |
| 11 | Equality | `==`, `!=` |
| 12 | Logical AND | `&&` |
| 13 | Logical OR | `\|\|` |
| 14 | Ternary | `<conditional> ? <if-true> : <if-false>` |
| 14 | Assignment | `=`, `\|=`, `^=`, `&=`, `<<=`, `>>=`, `+=`, `-=`, `*=`, `/=`, `%=` |
| 15 | Comma | `,` |

Note: `<<` binds weaker than `+`/`-`, and `&`/`|` bind stronger than comparisons. Example: `step << 1 <= n` is `(step << 1) <= n`.

## ABI encoding and decoding

- `abi.decode(bytes memory encodedData, (...)) returns (...)`: ABI-decodes the data. Types go in parentheses as the second argument. Example: `(uint a, uint[2] memory b, bytes memory c) = abi.decode(data, (uint, uint[2], bytes))`
- `abi.encode(...) returns (bytes memory)`: ABI-encodes the arguments.
- `abi.encodePacked(...) returns (bytes memory)`: packed encoding. This encoding can be ambiguous.
- `abi.encodeWithSelector(bytes4 selector, ...) returns (bytes memory)`: ABI-encodes the arguments from the second one and prepends the 4-byte selector.
- `abi.encodeCall(function functionPointer, (...)) returns (bytes memory)`: ABI-encodes a call to `functionPointer` with the tuple arguments. Full type check. Same result as `abi.encodeWithSelector(functionPointer.selector, ...)`.
- `abi.encodeWithSignature(string memory signature, ...) returns (bytes memory)`: same as `abi.encodeWithSelector(bytes4(keccak256(bytes(signature))), ...)`.

## Members of bytes and string

- `bytes.concat(...) returns (bytes memory)`: concatenates a variable number of arguments to one byte array.
- `string.concat(...) returns (string memory)`: concatenates a variable number of arguments to one string.

## Members of address

- `<address>.balance (uint256)`: balance in wei.
- `<address>.code (bytes memory)`: code at the address (can be empty).
- `<address>.codehash (bytes32)`: code hash of the address.
- `<address>.call(bytes memory) returns (bool, bytes memory)`: low-level `CALL`. Returns success and return data.
- `<address>.delegatecall(bytes memory) returns (bool, bytes memory)`: low-level `DELEGATECALL`.
- `<address>.staticcall(bytes memory) returns (bool, bytes memory)`: low-level `STATICCALL`.
- `<address payable>.send(uint256 amount) returns (bool)`: sends wei, returns `false` on failure (deprecated).
- `<address payable>.transfer(uint256 amount)`: sends wei, reverts on failure (deprecated).

## Block and transaction properties

- `blockhash(uint blockNumber) returns (bytes32)`: hash of the block. Works only for the 256 most recent blocks.
- `blobhash(uint index) returns (bytes32)`: versioned hash of the index-th blob of the current transaction (EIP-4844). Zero if there is no such blob.
- `block.basefee (uint)`: base fee of the current block (EIP-3198, EIP-1559).
- `block.blobbasefee (uint)`: blob base fee of the current block (EIP-7516, EIP-4844).
- `block.chainid (uint)`: current chain id.
- `block.coinbase (address payable)`: current block miner address.
- `block.difficulty (uint)`: before Paris, block difficulty. After Paris, a deprecated alias for `block.prevrandao`.
- `block.gaslimit (uint)`: current block gas limit.
- `block.number (uint)`: current block number.
- `block.prevrandao (uint)`: random number from the beacon chain (EVM >= Paris, EIP-4399). The block proposer knows it in advance: do not use it for prizes.
- `block.slotnum (uint64)`: current beacon chain slot number (EVM >= Amsterdam, EIP-7843).
- `block.timestamp (uint)`: current block timestamp, seconds since Unix epoch.
- `gasleft() returns (uint256)`: remaining gas.
- `msg.data (bytes)`: complete calldata.
- `msg.sender (address)`: sender of the current call.
- `msg.sig (bytes4)`: first 4 bytes of the calldata (function selector).
- `msg.value (uint)`: wei sent with the message.
- `tx.gasprice (uint)`: gas price of the transaction.
- `tx.origin (address)`: sender of the transaction (full call chain).

## Validations and assertions

- `assert(bool condition)`: reverts if false. Use for internal errors.
- `require(bool condition)`: reverts if false. Use for bad input or errors in external components.
- `require(bool condition, string memory message)`: same, with an error message.
- `revert()`: aborts and reverts state changes.
- `revert(string memory message)`: same, with an explanation.

## Math and cryptography

- `keccak256(bytes memory) returns (bytes32)`: Keccak-256 hash.
- `sha256(bytes memory) returns (bytes32)`: SHA-256 hash.
- `ripemd160(bytes memory) returns (bytes20)`: RIPEMD-160 hash.
- `ecrecover(bytes32 hash, uint8 v, bytes32 r, bytes32 s) returns (address)`: recovers the signer address. Returns zero on error.
- `addmod(uint x, uint y, uint k) returns (uint)`: `(x + y) % k` with arbitrary precision (no wrap at 2**256). Asserts `k != 0`.
- `mulmod(uint x, uint y, uint k) returns (uint)`: `(x * y) % k` with arbitrary precision. Asserts `k != 0`.
- `erc7201(string memory id) returns (uint)`: base slot of an ERC-7201 storage namespace. Usable at compile time.

## Contract-related

- `this`: the current contract, explicitly convertible to `address` or `address payable`.
- `super`: the contract one level higher in the inheritance hierarchy.
- `selfdestruct(address payable recipient)`: sends all funds to the recipient. Destroys the contract only on EVMs before Cancun, or when called in the creating transaction.

## Type information

- `type(C).name (string)`: contract name.
- `type(C).creationCode (bytes memory)`: creation bytecode.
- `type(C).runtimeCode (bytes memory)`: runtime bytecode.
- `type(I).interfaceId (bytes4)`: EIP-165 interface id.
- `type(T).min (T)`: minimum value of integer type `T`.
- `type(T).max (T)`: maximum value of integer type `T`.

## Function visibility

```solidity
function myFunction() <visibility specifier> returns (bool) {
    return true;
}
```

- `public`: visible externally and internally. Creates a getter for state variables.
- `private`: visible only in the current contract.
- `external`: visible only externally (functions only). Internal calls must go through `this.func`.
- `internal`: visible only internally.

## Modifiers

- `pure` (functions): no read or write of state.
- `view` (functions): no write of state.
- `payable` (functions): can receive ether with the call.
- `constant` (state variables): no assignment except initialization. Uses no storage slot.
- `immutable` (state variables): assigned at construction, then constant. Stored in code.
- `anonymous` (events): the event signature is not stored as a topic.
- `indexed` (event parameters): the parameter is stored as a topic.
- `virtual` (functions, modifiers): derived contracts can override it.
- `override`: the function, modifier, or public state variable overrides one in a base contract.
