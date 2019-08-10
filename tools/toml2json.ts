import { parse } from "@iarna/toml";
import * as fs from "fs";
const input = fs.readFileSync("/dev/stdin", "utf8");

const obj = parse(input);
console.log(JSON.stringify(obj, null, 2));
