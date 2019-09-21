import { handler } from "../src/index";
import { Context } from 'aws-lambda';
import { expect } from "chai";

import { gzip } from "zlib";
import { promisify } from "util";
const asyncgzip = promisify(gzip);

import "jest";

/** Setup mocks for postgres */
jest.mock('pg', () => ({
    Client: class {
        connect = jest.fn().mockResolvedValue(this)
        query = jest.fn().mockResolvedValue({ rows: [{ mvt: Buffer.from("data") }, { mvt: Buffer.from("something") }] })
        end = jest.fn().mockResolvedValue(this)
    }
}));

/** Setup mocks for aws */
const mockPutObject = jest.fn().mockReturnValue({ promise: () => { return Promise.resolve({}) } })
jest.mock('aws-sdk', () => {
    return {
        S3: jest.fn(() => ({
            putObject: mockPutObject
        }))
    };
});


// fake Context
const ctx: Context = {
    callbackWaitsForEmptyEventLoop: true,
    functionName: "",
    functionVersion: "",
    invokedFunctionArn: "",
    memoryLimitInMB: 128,
    awsRequestId: "",
    logGroupName: "",
    logStreamName: "",

    getRemainingTimeInMillis: () => { return 3000; },
    done: () => { },
    fail: () => { },
    succeed: () => { }
}

describe('environmental variables', () => {
    const OLD_ENV = process.env;

    beforeEach(() => {
        mockPutObject.mockClear()
        jest.resetModules() // this is important - it clears the cache
        process.env = { ...OLD_ENV };
        delete process.env.LOG_LEVEL;     // as this was specified in package.json for test:*
    });

    afterEach(() => {
        process.env = OLD_ENV;
    });

    it("no environmental variables set", async function () {
        const index = require('../src/index');
        const response = await index.handler({ path: "/local/14/8691/5677.mvt" }, ctx, () => { });
        const gzipped = await asyncgzip("data") as Buffer;
        expect(response).to.deep.equal({
            statusCode: 200,
            headers: {
                'Content-Type': 'application/vnd.mapbox-vector-tile',
                'Content-Encoding': 'gzip',
                'access-control-allow-origin': '*'
            },
            body: gzipped.toString('base64'),
            isBase64Encoded: true
        });
        expect(mockPutObject.mock.calls.length).to.be.equal(0);
    });

    it("LOG_LEVEL=1", async function () {
        process.env.LOG_LEVEL = "1";
        const index = require('../src/index');
        const response = await index.handler({ path: "/local/14/8691/5677.mvt" }, ctx, () => { });
        const gzipped = await asyncgzip("data") as Buffer;
        expect(response).to.deep.equal({
            statusCode: 200,
            headers: {
                'Content-Type': 'application/vnd.mapbox-vector-tile',
                'Content-Encoding': 'gzip',
                'access-control-allow-origin': '*'
            },
            body: gzipped.toString('base64'),
            isBase64Encoded: true
        });
        expect(mockPutObject.mock.calls.length).to.be.equal(0);
    });

    it("CACHE_BUCKET=sampleBucket", async function () {
        process.env.CACHE_BUCKET = "sampleBucket";
        const index = require('../src/index');
        const response = await index.handler({ path: "/local/14/8691/5677.mvt" }, ctx, () => { });
        const gzipped = await asyncgzip("data") as Buffer;
        expect(response).to.deep.equal({
            statusCode: 200,
            headers: {
                'Content-Type': 'application/vnd.mapbox-vector-tile',
                'Content-Encoding': 'gzip',
                'access-control-allow-origin': '*'
            },
            body: gzipped.toString('base64'),
            isBase64Encoded: true
        });
        expect(mockPutObject.mock.calls.length).to.be.equal(1);
    });

    it("GZIP=false", async function () {
        process.env.GZIP = "false";
        const index = require('../src/index');
        const response = await index.handler({ path: "/local/14/8691/5677.mvt" }, ctx, () => { });
        expect(response).to.deep.equal({
            statusCode: 200,
            headers: {
                'Content-Type': 'application/vnd.mapbox-vector-tile',
                'Content-Encoding': 'identity',
                'access-control-allow-origin': '*'
            },
            body: Buffer.from('data').toString('base64'),
            isBase64Encoded: true
        });
        expect(mockPutObject.mock.calls.length).to.be.equal(0);
    });

});