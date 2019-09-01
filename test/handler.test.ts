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
jest.mock('aws-sdk', () => {
    return {
        S3: jest.fn(() => ({
            putObject: jest.fn().mockReturnValue({ promise: () => { return Promise.resolve({}) } })
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

describe("handler", function () {
    it("regular request", async function () {
        let response = await handler({ path: "/local/14/8691/5677.mvt" }, ctx, () => { });
        let gzipped = await <Buffer><unknown>asyncgzip("data");
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
    });

    it("simulate error", async function () {
        let response = await handler({ path: "invalid" }, ctx, () => { });
        expect(response).to.deep.equal({
            statusCode: 500,
            headers: {
                'Content-Type': 'text/html',
                'access-control-allow-origin': '*',
                'Content-Encoding': 'identity'
            },
            body: '{"res":-2,"status":"[ERROR] - Tile not correctly specified in \'invalid\'"}',
            isBase64Encoded: false
        });
    });    
});
