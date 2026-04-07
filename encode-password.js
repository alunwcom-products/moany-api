import bcrypt from "bcrypt";
import { getKey } from "./src/lib/utils.js";

const saltRounds = 11;

async function encode(plainText) {
  const encoded = await bcrypt.hash(plainText, saltRounds);
  //console.log(encoded);
  return encoded;
}

if (process.argv.length !== 3) {
  console.warn("USAGE: plain text to be encoded must be provided as argument!");
  process.exit(-1);
}

console.log(`GENERATED UUID:\t${getKey()}`);
console.log(`ENCODED TEXT:\t${await encode(process.argv[2])}`);
