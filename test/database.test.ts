import { Config, getClientConfig } from "../src/index";
import { expect } from "chai";
import {readFileSync} from "fs";
import { parse } from "@iarna/toml";
import { ClientConfig } from "pg";

import "jest";

const testAssetsPath = "test/assets/";
const testOutputPath = "test/out/";

describe("getClientConfig", function () {
    it("empty config", function () {
        let config = <Config><unknown>parse(readFileSync(`${testAssetsPath}simple.toml`, "utf8"));
        let pgconfig:ClientConfig = getClientConfig("local", config);
        expect(pgconfig).to.be.empty;
    });

    it("full database config", function () {
        let config = <Config><unknown>parse(readFileSync(`${testAssetsPath}simple_dbconfig.toml`, "utf8"));
        let pgconfig:ClientConfig = getClientConfig("local", config);
        expect(pgconfig).to.deep.equal({
            host: "localhost",
            port: 5432,
            user: "user",
            password: "secret",
            database: "local"
        });
    });

    it("source not found", function () {
        let config = <Config><unknown>parse(readFileSync(`${testAssetsPath}simple_dbconfig.toml`, "utf8"));
        let pgconfig:ClientConfig = getClientConfig("unknown", config);
        expect(pgconfig).to.be.empty;
    });

});
