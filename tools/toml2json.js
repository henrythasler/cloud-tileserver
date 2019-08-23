"use strict";
exports.__esModule = true;
var toml_1 = require("@iarna/toml");
var fs_1 = require("fs");
console.log(JSON.stringify(toml_1.parse(fs_1.readFileSync("/dev/stdin", "utf8")), null, 2));
