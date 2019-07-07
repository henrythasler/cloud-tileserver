"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.handler = async (event = {}) => {
    console.log('Hello World 2222!');
    const response = JSON.stringify(event, null, 2);
    return response;
};
