import { Tile } from "../src/projection";
import { Tileserver } from "../src/tileserver";
import { expect } from "chai";

import "jest";

const tileserver = new Tileserver({ sources: [] }, "testBucket")

describe("Parsing functions", function () {
    it("extractTile regular #1 - simple path", function () {
        let tile: Tile | null = tileserver.extractTile("/local/0/0/0.mvt");
        expect(tile).to.be.an('object');
        expect(tile).to.deep.equal({ "x": 0, "y": 0, "z": 0 });
    });
    it("extractTile regular #2 - complex path", function () {
        let tile: Tile | null = tileserver.extractTile("/local/11/1087/714.mvt");
        expect(tile).to.be.an('object');
        expect(tile).to.deep.equal({ "x": 1087, "y": 714, "z": 11 });
    });
    it("extractTile regular #3 - strange path", function () {
        let tile: Tile | null = tileserver.extractTile("/local/1337/something/11/1087/714.mvt");
        expect(tile).to.be.an('object');
        expect(tile).to.deep.equal({ "x": 1087, "y": 714, "z": 11 });
    });

    it("extractTile negative #1 - y-value missing", function () {
        let tile: Tile | null = tileserver.extractTile("/local/1087/714.mvt");
        expect(tile).to.be.null;
    });
    it("extractTile negative #2 - wrong extension", function () {
        let tile: Tile | null = tileserver.extractTile("/local/11/1087/714.pbf");
        expect(tile).to.be.null;
    });
    it("extractTile negative #3 - totally useless request", function () {
        let tile: Tile | null = tileserver.extractTile("foo");
        expect(tile).to.be.null;
    });


    it("extractSource regular #1 - simple path", function () {
        let source: string | null = tileserver.extractSource("/local/0/0/0.mvt");
        expect(source).to.be.equal('local');
    });
    it("extractSource regular #2 - strange path", function () {
        let source: string | null = tileserver.extractSource("/foo/13bar37/global/11/1087/714.mvt/foo2/local/11/1087/714.mvt");
        expect(source).to.be.equal('local');
    });

    it("extractSource negative #1 - incomplete path", function () {
        let source: string | null = tileserver.extractSource("/local/");
        expect(source).to.be.null;
    });
    it("extractSource negative #2 - totally useless request", function () {
        let source: string | null = tileserver.extractSource("foo");
        expect(source).to.be.null;
    });
    it("extractSource SQL-Injection #1 - `select now()`", function () {
        let source: string | null = tileserver.extractSource("/select+now%28%29/0/0/0.mvt");
        expect(source).to.be.equal('29');
    });

})
