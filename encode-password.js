import bcrypt from "bcrypt";

const saltRounds = 11;

async function encode(plainText) {
  const encoded = await bcrypt.hash(plainText, saltRounds);
  console.log(encoded);
}

if (process.argv.length !== 3) {
  console.warn("USAGE: plain text to be encoded must be provided as argument!");
  process.exit(-1);
}

encode(process.argv[2]);

