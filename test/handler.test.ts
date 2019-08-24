import { handler } from "../src/index";
import { Context } from 'aws-lambda';
import { expect } from "chai";

import { gzip } from "zlib";
import { promisify } from "util";
const asyncgzip = promisify(gzip);

import "jest";

/** Setup mocks for pg */
jest.mock('pg', () => ({
    Client: class {
        public connect = jest.fn().mockResolvedValue(this)
        public query = jest.fn()
            .mockResolvedValue({ rows: [{ data: Buffer.from("data") }, { data: Buffer.from("something") }] })
        public end = jest.fn().mockResolvedValue(this)
    },
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

    beforeEach(() => {
        mockS3putObject.mockReset();
    });

    it("invalid request", async function () {
        let response = await handler({ path: "invalid" }, ctx, () => { });
        expect(mockS3putObject.mock.calls.length).to.be.equal(0);
        expect(response).to.deep.equal({
            statusCode: 500,
            headers: {
                'Content-Type': 'text/html',
                'access-control-allow-origin': '*',
                'Content-Encoding': 'identity'
            },
            body: "Error",
            isBase64Encoded: false
        });
    });

    it("regular request", async function () {
        mockS3putObject.mockReturnValue({ promise: () => { return Promise.resolve({}) } })
        // mockS3putObject.mockImplementation((params) => {
        //     return {
        //         promise() {
        //             return Promise.resolve({ ETag: "0000" })
        //         }
        //     };
        // });

        let response = await handler({ path: "/local/14/8691/5677.mvt" }, ctx, () => { });
        expect(mockS3putObject.mock.calls.length).to.be.equal(1);

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
        mockS3putObject.mockReturnValue({ promise: () => { return Promise.reject({Error: "unknown"}) } })

        let response = await handler({ path: "/local/14/8691/5677.mvt" }, ctx, () => { });
        expect(mockS3putObject.mock.calls.length).to.be.equal(1);
        expect(response).to.deep.equal({
            statusCode: 500,
            headers: {
                'Content-Type': 'text/html',
                'access-control-allow-origin': '*',
                'Content-Encoding': 'identity'
            },
            body: `{"Error":"unknown"}`,
            isBase64Encoded: false
        });
    });    
});
