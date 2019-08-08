import { Projection, Wgs84, Mercator, MercatorBoundingBox, WGS84BoundingBox, Tile, TileList } from "../src/projection";
import { expect } from "chai";

import "jest";

let proj = new Projection();

describe("Coordinate Transformation Tests", function () {
    it("getWGS84FromMercator with zeros", function () {
        let pos: Wgs84 = proj.getWGS84FromMercator({ x: 0, y: 0 });
        expect(pos).to.include({ "lng": 0, "lat": 0 });
    });

    it("getWGS84FromMercator with positive values", function () {
        let pos: Wgs84 = proj.getWGS84FromMercator({ x: 1252344, y: 6105178 });
        expect(pos).to.have.property("lng");
        expect(pos).to.have.property("lat");
        expect(pos.lng).to.be.closeTo(11.249999999999993, 0.00001);
        expect(pos.lat).to.be.closeTo(47.989921667414194, 0.00001);
    });

    it("getWGS84FromMercator with negative values", function () {
        let pos: Wgs84 = proj.getWGS84FromMercator({ x: -7604567, y: -7330617 });
        expect(pos).to.have.property("lng");
        expect(pos).to.have.property("lat");
        expect(pos.lng).to.be.closeTo(-68.31298828125001, 0.00001);
        expect(pos.lat).to.be.closeTo(-54.838663612975104, 0.00001);
    });

    it("getWGS84FromMercator projected bounds", function () {
        let pos: Wgs84 = proj.getWGS84FromMercator({ x: -20037508.342789, y: 20037508.342789 });
        expect(pos).to.have.property("lng");
        expect(pos).to.have.property("lat");
        expect(pos.lng).to.be.closeTo(-180, 0.00001);
        expect(pos.lat).to.be.closeTo(85.051129, 0.00001);
    });

    it("getMercatorFromPixels at Null-Island", function () {
        let pos: Mercator = proj.getMercatorFromPixels({ x: 256, y: 256 }, 1);
        expect(pos).to.have.property("x");
        expect(pos).to.have.property("y");
        expect(pos.x).to.be.closeTo(0, 0.00001);
        expect(pos.y).to.be.closeTo(0, 0.00001);
    });

    it("getMercatorFromPixels #1", function () {
        let pos: Mercator = proj.getMercatorFromPixels({ x: 0, y: 0 }, 1);
        expect(pos).to.have.property("x");
        expect(pos).to.have.property("y");
        expect(pos.x, "pos.x").to.be.closeTo(-20037508.342789, 0.00001);
        expect(pos.y, "pos.y").to.be.closeTo(20037508.342789, 0.00001);
    });

    it("getMercatorFromPixels #2", function () {
        let pos: Mercator = proj.getMercatorFromPixels({ x: 1301248, y: 2864384 }, 14);
        expect(pos).to.have.property("x");
        expect(pos).to.have.property("y");
        expect(pos.x, "pos.x").to.be.closeTo(-7604567.070035616, 0.00001);
        expect(pos.y, "pos.y").to.be.closeTo(-7330616.760661542, 0.00001);
    });

    it("getMercatorTileBounds #1", function () {
        let bound: MercatorBoundingBox = proj.getMercatorTileBounds({ x: 0, y: 0, z: 1 });
        expect(bound).to.have.property("leftbottom");
        expect(bound).to.have.property("righttop");
        expect(bound.leftbottom.x, "bound.leftbottom.x").to.be.closeTo(-20037508.342789, 0.00001);
        expect(bound.leftbottom.y, "bound.leftbottom.y").to.be.closeTo(0, 0.00001);
        expect(bound.righttop.x, "bound.righttop.x").to.be.closeTo(0, 0.00001);
        expect(bound.righttop.y, "bound.righttop.y").to.be.closeTo(20037508.342789, 0.00001);
    });

    it("getMercatorTileBounds #2", function () {
        let bound: MercatorBoundingBox = proj.getMercatorTileBounds({ x: 5083, y: 11188, z: 14 });
        expect(bound).to.have.property("leftbottom");
        expect(bound).to.have.property("righttop");
        expect(bound.leftbottom.x, "bound.leftbottom.x").to.be.closeTo(-7604567.070035616, 0.00001);
        expect(bound.leftbottom.y, "bound.leftbottom.y").to.be.closeTo(-7330616.760661542, 0.00001);
        expect(bound.righttop.x, "bound.righttop.x").to.be.closeTo(-7602121.08513049, 0.00001);
        expect(bound.righttop.y, "bound.righttop.y").to.be.closeTo(-7328170.775756419, 0.00001);
    });

    it("getWGS84TileBounds #1", function () {
        let bound: WGS84BoundingBox = proj.getWGS84TileBounds({ x: 0, y: 0, z: 1 });
        expect(bound).to.have.property("leftbottom");
        expect(bound).to.have.property("righttop");
        expect(bound.leftbottom.lng, "bound.leftbottom.lng").to.be.closeTo(-180, 0.00001);
        expect(bound.leftbottom.lat, "bound.leftbottom.lat").to.be.closeTo(0, 0.00001);
        expect(bound.righttop.lng, "bound.righttop.lng").to.be.closeTo(0, 0.00001);
        expect(bound.righttop.lat, "bound.righttop.lat").to.be.closeTo(85.051129, 0.00001);
    });

    it("getWGS84TileBounds #2", function () {
        let bound: WGS84BoundingBox = proj.getWGS84TileBounds({ x: 272, y: 177, z: 9 });
        expect(bound).to.have.property("leftbottom");
        expect(bound).to.have.property("righttop");
        expect(bound.leftbottom.lng, "bound.leftbottom.lng").to.be.closeTo(11.25, 0.00001);
        expect(bound.leftbottom.lat, "bound.leftbottom.lat").to.be.closeTo(47.98992189, 0.00001);
        expect(bound.righttop.lng, "bound.righttop.lng").to.be.closeTo(11.95312466, 0.00001);
        expect(bound.righttop.lat, "bound.righttop.lat").to.be.closeTo(48.45835188, 0.00001);
    });

    it("getWGS84TileBounds #3", function () {
        let bound: WGS84BoundingBox = proj.getWGS84TileBounds({ x: 4383, y: 2854, z: 13 });
        expect(bound).to.have.property("leftbottom");
        expect(bound).to.have.property("righttop");
        expect(bound.leftbottom.lng, "bound.leftbottom.lng").to.be.closeTo(12.61230469, 0.00001);
        expect(bound.leftbottom.lat, "bound.leftbottom.lat").to.be.closeTo(47.78363486, 0.00001);
        expect(bound.righttop.lng, "bound.righttop.lng").to.be.closeTo(12.65624966, 0.00001);
        expect(bound.righttop.lat, "bound.righttop.lat").to.be.closeTo(47.81315452, 0.00001);
    });

    it("getWGS84TileBounds #4", function () {
        let bound: WGS84BoundingBox = proj.getWGS84TileBounds({ x: 5, y: 10, z: 10 });
        expect(bound).to.have.property("leftbottom");
        expect(bound).to.have.property("righttop");
        expect(bound.leftbottom.lng, "bound.leftbottom.lng").to.be.closeTo(-178.242187, 0.00001);
        expect(bound.leftbottom.lat, "bound.leftbottom.lat").to.be.closeTo(84.706049, 0.00001);
        expect(bound.righttop.lng, "bound.righttop.lng").to.be.closeTo(-177.890625, 0.00001);
        expect(bound.righttop.lat, "bound.righttop.lat").to.be.closeTo(84.738387, 0.00001);
    });

    it("getWGS84TileCenter #1", function () {
        let center: Wgs84 = proj.getWGS84TileCenter({ x: 0, y: 0, z: 0 });
        expect(center).to.have.property("lng");
        expect(center).to.have.property("lat");
        expect(center.lng, "center.lng").to.be.closeTo(0, 0.00001);
        expect(center.lat, "center.lat").to.be.closeTo(0, 0.00001);
    });

    it("getWGS84TileCenter #2", function () {
        let center: Wgs84 = proj.getWGS84TileCenter({ x: 4383, y: 2854, z: 13 }, 256);
        expect(center).to.have.property("lng");
        expect(center).to.have.property("lat");
        expect(center.lng, "center.lng").to.be.closeTo(12.63427717, 0.00001);
        expect(center.lat, "center.lat").to.be.closeTo(47.79839469, 0.00001);
    });

    it("getTilePyramid #1", function () {
        let list: TileList = proj.getTilePyramid({ z: 0, x: 0, y: 0 });
        expect(list).to.have.lengthOf(5);
        expect(list).to.have.deep.ordered.members([
            <Tile>{ x: 0, y: 0, z: 0 },
            <Tile>{ x: 0, y: 0, z: 1 },
            <Tile>{ x: 1, y: 0, z: 1 },
            <Tile>{ x: 0, y: 1, z: 1 },
            <Tile>{ x: 1, y: 1, z: 1 }]
        );
    });

    it("getTilePyramid #2", function () {
        let list: TileList = proj.getTilePyramid({ z: 0, x: 0, y: 0 }, 2);
        expect(list).to.have.lengthOf(21);
        expect(list).to.include.deep.members([
            <Tile>{ z: 0, x: 0, y: 0 },
            <Tile>{ x: 0, y: 0, z: 1 },
            <Tile>{ x: 0, y: 0, z: 2 }]
        );
    });

    it("getTilePyramid #3", function () {
        let list: TileList = proj.getTilePyramid({ z: 9, x: 271, y: 178 }, 4);
        expect(list).to.have.lengthOf(341);
        expect(list).to.include.deep.members([
            <Tile>{ z: 13, x: 4351, y: 2863 },
            <Tile>{ z: 12, x: 2175, y: 1424 },
            <Tile>{ z: 11, x: 1084, y: 715 },
            <Tile>{ z: 10, x: 542, y: 356 },
            <Tile>{ z: 9, x: 271, y: 178 },
        ]
        );
    });

})


