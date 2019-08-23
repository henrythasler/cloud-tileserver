import { handler } from "../src/index";
import { Context } from 'aws-lambda';
import { expect } from "chai";

import "jest";


describe("handler", function () {
    it("invalid request", function () {
        let ctx:Context = {
            // fake Context
            callbackWaitsForEmptyEventLoop: true,
            functionName: "string",
            functionVersion: "string",
            invokedFunctionArn: "string",
            memoryLimitInMB: 128,
            awsRequestId: "string",
            logGroupName: "string",
            logStreamName: "string",

            getRemainingTimeInMillis: () => {return 0;},
            done: () => {},
            fail: () => {},
            succeed: () => {}
        }
        let response = handler({path: "invalid"}, ctx , () => {});
        expect(response).to.be.empty;
    });
});
