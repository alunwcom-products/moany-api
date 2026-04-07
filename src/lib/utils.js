import { uuidv7 } from "uuidv7";
import { v4 as uuidv4 } from 'uuid';

// abstract key creation
// currently using uuidv4 but planning to migrate to uuidv7
function getKey() {
  // return uuidv7();
  return uuidv4();
}

export {
  getKey
}