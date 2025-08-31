import { Tile } from "../src/projection";
import { Tileserver } from "../src/tileserver";

import "jest";

const tileserver = new Tileserver({ sources: [] }, "testBucket")

describe("Parsing functions", function () {
    it("extractTile regular #1 - simple path", function () {
        let tile: Tile | null = tileserver.extractTile("/local/0/0/0.mvt");
        expect(tile).toBeInstanceOf(Object);
        expect(tile).toStrictEqual({ "x": 0, "y": 0, "z": 0 });
    });
    it("extractTile regular #2 - complex path", function () {
        let tile: Tile | null = tileserver.extractTile("/local/11/1087/714.mvt");
        expect(tile).toBeInstanceOf(Object);
        expect(tile).toStrictEqual({ "x": 1087, "y": 714, "z": 11 });
    });
    it("extractTile regular #3 - strange path", function () {
        let tile: Tile | null = tileserver.extractTile("/local/1337/something/11/1087/714.mvt");
        expect(tile).toBeInstanceOf(Object);
        expect(tile).toStrictEqual({ "x": 1087, "y": 714, "z": 11 });
    });

    it("extractTile negative #1 - y-value missing", function () {
        let tile: Tile | null = tileserver.extractTile("/local/1087/714.mvt");
        expect(tile).toBeNull();
    });
    it("extractTile negative #2 - wrong extension", function () {
        let tile: Tile | null = tileserver.extractTile("/local/11/1087/714.pbf");
        expect(tile).toBeNull();
    });
    it("extractTile negative #3 - totally useless request", function () {
        let tile: Tile | null = tileserver.extractTile("foo");
        expect(tile).toBeNull();
    });
    it("extractTile negative #4 - invalid extension", function () {
        let tile: Tile | null = tileserver.extractTile("/local/14/8691/5677.mvtinvalid");
        expect(tile).toBeNull();
    });
    it("extractTile negative #5 - oversized input", function () {
        const longString = '9'.repeat(1024);
        let tile: Tile | null = tileserver.extractTile(longString);
        expect(tile).toBeNull();
    });


    it("extractSource regular #1 - simple path", function () {
        let source: string | null = tileserver.extractSource("/local/0/0/0.mvt");
        expect(source).toBe('local');
    });
    it("extractSource regular #2 - strange path", function () {
        let source: string | null = tileserver.extractSource("/foo/13bar37/global/11/1087/714.mvt/foo2/local/11/1087/714.mvt");
        expect(source).toBe('local');
    });

    it("extractSource negative #1 - incomplete path", function () {
        let source: string | null = tileserver.extractSource("/local/");
        expect(source).toBeNull();
    });
    it("extractSource negative #2 - totally useless request", function () {
        let source: string | null = tileserver.extractSource("foo");
        expect(source).toBeNull();
    });
    it("extractSource negative #3 - input length limit exceeded", function () {
        const longString = '9'.repeat(1024);
        let source: string | null = tileserver.extractSource(longString);
        expect(source).toBeNull();
    });    
    it("extractSource SQL-Injection #1 - `select now()`", function () {
        let source: string | null = tileserver.extractSource("/select+now%28%29/0/0/0.mvt");
        expect(source).toBe('29');
    });

})
