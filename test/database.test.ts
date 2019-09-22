import { Tileserver, Config } from "../src/tileserver";
import { expect } from "chai";
import { readFileSync } from "fs";
import { parse } from "@iarna/toml";

import "jest";
import { ClientConfig } from "pg";

/** Setup mocks for pg */
const mockQuery = jest.fn();

//const mockQuery = jest.fn().mockResolvedValue({ rows: [{ data: Buffer.from("data") }, { data: Buffer.from("something") }] })
jest.mock('pg', () => ({
    Client: class {
        connect = jest.fn().mockResolvedValue(null)
        query = mockQuery
        end = jest.fn().mockResolvedValue(null)
    }
}));

const fixturesPath = "test/fixtures/";
const testOutputPath = "test/out/";

describe("getClientConfig", function () {
    it("empty config", function () {
        let config = parse(readFileSync(`${fixturesPath}simple.toml`, "utf8")) as unknown as Config;
        let server = new Tileserver(config, "testBucket");
        let pgconfig: ClientConfig = server.getClientConfig("local");
        expect(pgconfig).to.be.empty;
    });

    it("full database config", function () {
        let config = parse(readFileSync(`${fixturesPath}simple_dbconfig.toml`, "utf8")) as unknown as Config;
        let server = new Tileserver(config, "testBucket");
        let pgconfig: ClientConfig = server.getClientConfig("local");
        expect(pgconfig).to.deep.equal({
            host: "localhost",
            port: 5432,
            user: "user",
            password: "secret",
            database: "local"
        });
    });

    it("source not found", function () {
        let config = parse(readFileSync(`${fixturesPath}simple_dbconfig.toml`, "utf8")) as unknown as Config;
        let server = new Tileserver(config, "testBucket");
        let pgconfig: ClientConfig = server.getClientConfig("unknown");
        expect(pgconfig).to.be.empty;
    });

});


describe("fetchTileFromDatabase", function () {
    beforeEach(() => {
        mockQuery.mockReset();
    });

    it("regular response", async function () {
        mockQuery.mockResolvedValue({ rows: [{ mvt: Buffer.from("data") }, { mvt: Buffer.from("something") }] })        
        let config = parse(readFileSync(`${fixturesPath}simple.toml`, "utf8")) as unknown as Config;
        let server = new Tileserver(config, "testBucket");
        let pgconfig: ClientConfig = server.getClientConfig("local");

        let res = await server.fetchTileFromDatabase("SELECT true", pgconfig);
        expect(mockQuery.mock.calls.length).to.be.equal(1);
        expect(res.toString()).to.equal("data");
    });

    it("row not found", async function () {
        mockQuery.mockResolvedValue({ rows: [{ wrong: Buffer.from("data") }, { mvt: Buffer.from("something") }] })
        let config = parse(readFileSync(`${fixturesPath}simple.toml`, "utf8")) as unknown as Config;
        let server = new Tileserver(config, "testBucket");
        let pgconfig: ClientConfig = server.getClientConfig("local");

        try {
            await server.fetchTileFromDatabase("SELECT true", pgconfig)    
        } catch (e) {
            expect(e).to.be.an("Error");
            expect(e).to.have.property("message", "Property \'mvt\' does not exist in res.rows[0]");
        }        
        expect(mockQuery.mock.calls.length).to.be.equal(1);
    });    
});