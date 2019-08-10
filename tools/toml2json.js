"use strict";
exports.__esModule = true;
var toml_1 = require("@iarna/toml");
var fs = require("fs");
var input = fs.readFileSync("/dev/stdin", "utf8");
var obj = toml_1.parse(input);
console.log(JSON.stringify(obj, null, 2));
