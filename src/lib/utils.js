import { uuidv7 } from "uuidv7";

// abstract key creation
// currently using uuidv4 but planning to migrate to uuidv7
function getKey() {
  return uuidv7();
}

export {
  getKey
}