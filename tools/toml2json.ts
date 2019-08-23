import { parse } from "@iarna/toml";
import { readFileSync } from "fs";
console.log(JSON.stringify(parse(readFileSync("/dev/stdin", "utf8")), null, 2));