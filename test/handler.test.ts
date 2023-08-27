process.env.CACHE_BUCKET = "sampleBucket";

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
const mockPutObject = jest.fn().mockResolvedValue(null)
jest.mock('@aws-sdk/client-s3', () => {
    return {
        S3Client: jest.fn(() => ({
            send: mockPutObject
        })),
        PutObjectCommand: jest.fn(),
    };
});



// fake Context
const ctx: Context = {
    callbackWaitsForEmptyEventLoop: true,
    functionName: "",
    functionVersion: "",
    invokedFunctionArn: "",
    memoryLimitInMB: "128",
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
        mockPutObject.mockClear();
    });

    it("regular request", async function () {
        let response = await handler({ path: "/local/14/8691/5677.mvt" }, ctx, () => { });
        let gzipped = await asyncgzip("data") as Buffer;
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

    it("invalid path", async function () {
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
        expect(mockPutObject.mock.calls.length).to.be.equal(0);
    });    

    it("Lambda Function URL request", async function () {
        const request = {
            version: '2.0',
            routeKey: '$default',
            rawPath: '/local/14/8691/5677.mvt',
            rawQueryString: '',
            headers: {
              'sec-fetch-mode': 'cors',
              'x-amzn-tls-version': 'TLSv1.2',
              'sec-fetch-site': 'cross-site',
              'accept-language': 'en-US',
              'x-forwarded-proto': 'https',
              'x-forwarded-port': '443',
              'x-forwarded-for': '127.0.0.1',
              accept: 'application/vnd.mapbox-vector-tile',
              'x-amzn-tls-cipher-suite': 'ECDHE-RSA-AES128-GCM-SHA256',
              'sec-ch-ua': '"Not.A/Brand";v="8", "Chromium";v="114"',
              'sec-ch-ua-mobile': '?0',
              'x-amzn-trace-id': 'Root=1',
              'sec-ch-ua-platform': '"Linux"',
              host: '1234.lambda-url.eu-central-1.on.aws',
              'accept-encoding': 'gzip, deflate, br',
              'sec-fetch-dest': 'empty',
              'user-agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Insomnia/2023.5.6 Chrome/114.0.5735.134 Electron/25.2.0 Safari/537.36'
            },
            requestContext: {
              accountId: 'anonymous',
              apiId: '1243',
              domainName: '1234.lambda-url.eu-central-1.on.aws',
              domainPrefix: '1234',
              http: {
                method: 'GET',
                path: '/local/14/8691/5677.mvt',
                protocol: 'HTTP/1.1',
                sourceIp: '127.0.0.1',
                userAgent: 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Insomnia/2023.5.6 Chrome/114.0.5735.134 Electron/25.2.0 Safari/537.36'
              },
              requestId: '2aaad740-522d-49bb-9db3-6a4aea9ddfa6',
              routeKey: '$default',
              stage: '$default',
              time: '27/Aug/2023:20:04:53 +0000',
              timeEpoch: 1693166693017
            },
            isBase64Encoded: false
          };

        let response = await handler(request, ctx, () => { });
        let gzipped = await asyncgzip("data") as Buffer;
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

    it("missing path", async function () {
        let response = await handler({ wrong: "path" }, ctx, () => { });
        expect(response).to.deep.equal({
            statusCode: 500,
            headers: {
                'Content-Type': 'text/html',
                'access-control-allow-origin': '*',
                'Content-Encoding': 'identity'
            },
            body: '{"res":-2,"status":"[ERROR] - Tile not correctly specified in \'\'"}',
            isBase64Encoded: false
        });
        expect(mockPutObject.mock.calls.length).to.be.equal(0);
    });    
});
