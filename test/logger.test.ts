import { Log, LogLevels } from "../src/tileserver";
import "jest";

describe("logger", function () {
    it("regular constructor", function () {
        let log = new Log(LogLevels.INFO);
        log.show("log", LogLevels.TRACE);
    });    

    it("use default value in constructor", function () {
        let log = new Log();
        log.show("log", LogLevels.TRACE);
    });    
});
