export default class Timer {
    constructor(endToEnd, timeOut) {
        this.endToEnd = endToEnd;
        this.timeOut = timeOut;
        this.progress = 0;
        this.progressBase = timeOut;
    }
}
  