"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.handler = async (event, context) => {
    console.log(`getRemainingTimeInMillis=${context.getRemainingTimeInMillis()}`);
    let response = JSON.stringify(event, null, 2);
    return Promise.resolve(response);
};
