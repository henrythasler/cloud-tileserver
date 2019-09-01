import { Tileserver, Vectortile, Config } from "../src/tileserver";
import { expect } from "chai";
import { readFileSync } from "fs";
import { parse } from "@iarna/toml";
import { gzip } from "zlib";
import { promisify } from "util";
const asyncgzip = promisify(gzip);

import "jest";

const testAssetsPath = "test/assets/";
const testOutputPath = "test/out/";

const config = <Config><unknown>parse(readFileSync(`${testAssetsPath}simple.toml`, "utf8"));
const dummyServer = new Tileserver({ sources: [] }, "testBucket");

/** Setup mocks for pg */
const mockQuery = jest.fn();
const mockConnect = jest.fn();

//const mockQuery = jest.fn().mockResolvedValue({ rows: [{ data: Buffer.from("data") }, { data: Buffer.from("something") }] })
jest.mock('pg', () => ({
    Client: class {
        connect = mockConnect
        query = mockQuery
        end = jest.fn().mockResolvedValue(null)
    }
}));

/** Setup mocks for aws */
const mockS3putObject = jest.fn();
// const mockS3putObject = jest.fn().mockReturnValue({ promise: () => { return Promise.resolve({}) } })

jest.mock('aws-sdk', () => {
    return {
        S3: jest.fn(() => ({
            putObject: mockS3putObject
        }))
    };
});

describe("getVectortile", function () {
    beforeEach(() => {
        mockConnect.mockReset();
        mockQuery.mockReset();
        mockS3putObject.mockReset();
    });

    it("invalid tile", async function () {
        let path = "invalid"
        let expected: Vectortile = { res: -2, status: `[ERROR] - Tile not correctly specified in '${path}'` };
        let response = await dummyServer.getVectortile(path);
        expect(mockConnect.mock.calls.length).to.be.equal(0);
        expect(mockQuery.mock.calls.length).to.be.equal(0);
        expect(mockS3putObject.mock.calls.length).to.be.equal(0);
        expect(response).to.deep.equal(expected);
    });

    it("invalid source", async function () {
        let path = "/%%%%/14/8691/5677.mvt"
        let expected: Vectortile = { res: -3, status: `[ERROR] - Source not correctly specified in '${path}'` };
        let response = await dummyServer.getVectortile(path);
        expect(mockConnect.mock.calls.length).to.be.equal(0);
        expect(mockQuery.mock.calls.length).to.be.equal(0);
        expect(mockS3putObject.mock.calls.length).to.be.equal(0);
        expect(response).to.deep.equal(expected);
    });

    it("empty request", async function () {
        mockS3putObject.mockReturnValue({ promise: () => { return Promise.resolve({}) } });
        let path = "/local/14/8691/5677.mvt"
        let expected: Vectortile = {
            res: 1,
            status: `[INFO] - Empty query for '${path}'`,
            data: await <Buffer><unknown>asyncgzip("")
        }
        let response = await dummyServer.getVectortile(path);
        expect(mockConnect.mock.calls.length).to.be.equal(0);
        expect(mockQuery.mock.calls.length).to.be.equal(0);
        expect(mockS3putObject.mock.calls.length).to.be.equal(1);
        expect(response).to.deep.equal(expected);
    });

    it("regular request", async function () {
        mockS3putObject.mockReturnValue({ promise: () => { return Promise.resolve({}) } });
        mockQuery.mockResolvedValue({ rows: [{ mvt: Buffer.from("data") }, { mvt: Buffer.from("something") }] })
        mockConnect.mockResolvedValue(null);
        let path = "/local/14/8691/5677.mvt"
        let expected: Vectortile = {
            res: 0,
            data: await <Buffer><unknown>asyncgzip("data")
        }
        let server = new Tileserver(config, "testBucket");
        let response = await server.getVectortile(path);
        expect(mockConnect.mock.calls.length).to.be.equal(1);
        expect(mockQuery.mock.calls.length).to.be.equal(1);
        expect(mockS3putObject.mock.calls.length).to.be.equal(1);
        expect(response).to.deep.equal(expected);
    });

    it("regular request w/o gzip", async function () {
        mockS3putObject.mockReturnValue({ promise: () => { return Promise.resolve({}) } });
        mockQuery.mockResolvedValue({ rows: [{ mvt: Buffer.from("data") }, { mvt: Buffer.from("something") }] })
        mockConnect.mockResolvedValue(null);
        let path = "/local/14/8691/5677.mvt"
        let expected: Vectortile = {
            res: 0,
            data: Buffer.from("data")
        }
        let server = new Tileserver(config, "testBucket", undefined, false);
        let response = await server.getVectortile(path);
        expect(mockConnect.mock.calls.length).to.be.equal(1);
        expect(mockQuery.mock.calls.length).to.be.equal(1);
        expect(mockS3putObject.mock.calls.length).to.be.equal(1);
        expect(response).to.deep.equal(expected);
    });

    it("regular request w/o cacheBucketName", async function () {
        mockS3putObject.mockReturnValue({ promise: () => { return Promise.resolve({}) } });
        mockQuery.mockResolvedValue({ rows: [{ mvt: Buffer.from("data") }, { mvt: Buffer.from("something") }] })
        mockConnect.mockResolvedValue(null);
        let path = "/local/14/8691/5677.mvt"
        let expected: Vectortile = {
            res: 0,
            data: await <Buffer><unknown>asyncgzip("data")
        }
        let server = new Tileserver(config, undefined);
        let response = await server.getVectortile(path);
        expect(mockConnect.mock.calls.length).to.be.equal(1);
        expect(mockQuery.mock.calls.length).to.be.equal(1);
        expect(mockS3putObject.mock.calls.length).to.be.equal(0);
        expect(response).to.deep.equal(expected);
    });

    it("postgres connect error", async function () {
        mockS3putObject.mockReturnValue({ promise: () => { return Promise.resolve({}) } });
        mockQuery.mockResolvedValue({ rows: [{ mvt: Buffer.from("data") }, { mvt: Buffer.from("something") }] })
        mockConnect.mockRejectedValue(new Error("simulated connect error"));
        let path = "/local/14/8691/5677.mvt"
        let expected: Vectortile = {
            res: -4,
            status: `[ERROR] - Database error: simulated connect error`
        }
        let server = new Tileserver(config, "testBucket");
        let response = await server.getVectortile(path);
        expect(mockConnect.mock.calls.length).to.be.equal(1);
        expect(mockQuery.mock.calls.length).to.be.equal(0);
        expect(mockS3putObject.mock.calls.length).to.be.equal(0);
        expect(response).to.deep.equal(expected);
    });

    it("postgres query error", async function () {
        mockS3putObject.mockReturnValue({ promise: () => { return Promise.resolve({}) } });
        mockConnect.mockResolvedValue(null)
        mockQuery.mockRejectedValue(new Error("simulated query error"));
        let path = "/local/14/8691/5677.mvt"
        let expected: Vectortile = {
            res: -4,
            status: `[ERROR] - Database error: simulated query error`
        }
        let server = new Tileserver(config, "testBucket");
        let response = await server.getVectortile(path);
        expect(mockConnect.mock.calls.length).to.be.equal(1);
        expect(mockQuery.mock.calls.length).to.be.equal(1);
        expect(mockS3putObject.mock.calls.length).to.be.equal(0);
        expect(response).to.deep.equal(expected);
    });

    it("S3 error", async function () {
        mockS3putObject.mockReturnValue({ promise: () => { return Promise.reject(new Error("simulated message")) } });
        mockQuery.mockResolvedValue({ rows: [{ mvt: Buffer.from("data") }, { mvt: Buffer.from("something") }] })
        mockConnect.mockResolvedValue(null);
        let path = "/local/14/8691/5677.mvt"
        let expected: Vectortile = {
            res: 2,
            status: `[INFO] - Could not put to S3: simulated message`,
            data: await <Buffer><unknown>asyncgzip("data"),
        }
        let server = new Tileserver(config, "testBucket");
        let response = await server.getVectortile(path);
        expect(mockConnect.mock.calls.length).to.be.equal(1);
        expect(mockQuery.mock.calls.length).to.be.equal(1);
        expect(mockS3putObject.mock.calls.length).to.be.equal(1);
        expect(response).to.deep.equal(expected);
    });
});
