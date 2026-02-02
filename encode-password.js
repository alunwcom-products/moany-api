import bcrypt from "bcrypt";
import { v4 as uuidv4 } from 'uuid';

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

console.log(`GENERATED UUID:\t${uuidv4()}`);
console.log(`ENCODED TEXT:\t${await encode(process.argv[2])}`);
