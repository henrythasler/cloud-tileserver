import { Config, getClientConfig, fetchTileFromDatabase } from "../src/index";
import { expect } from "chai";
import {readFileSync} from "fs";
import { parse } from "@iarna/toml";

import "jest";
import { ClientConfig } from "pg";

jest.mock('pg', () => ({
    Client: class {
      public connect = jest.fn().mockResolvedValue(this)
      public query = jest.fn()
        .mockResolvedValue({ rows: [{ data: Buffer.from("data") }, { data: Buffer.from("something") }] })
      public end = jest.fn().mockResolvedValue(this)
    },
  }))

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


describe("fetchTileFromDatabase", function () {
    it("regular response", async function () {
        let config = <Config><unknown>parse(readFileSync(`${testAssetsPath}simple.toml`, "utf8"));
        let pgconfig:ClientConfig = getClientConfig("local", config);

        // mockedClient.query.mockResolvedValue({ rows: [{ data: 'data' }] });
        let res = await fetchTileFromDatabase("SELECT true", pgconfig);
        expect(res.toString()).to.equal("data");
    });
});