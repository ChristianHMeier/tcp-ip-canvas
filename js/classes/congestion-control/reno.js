import CongestionControl from './congestion-control.js';
import Packet from '../packet.js';

export default class Reno extends CongestionControl {
    constructor(endToEnd, timeout, bandwidth, draw) {
        super(endToEnd, timeout, bandwidth, draw);
    }
    onACK(packet, index) {
        super.onACK(packet, index);
        if (packet.dupIndex !== null) {
            this.duplicateACKIndex = this.duplicateACKIndex !== null ? this.duplicateACKIndex : packet.dupIndex; 
            this.duplicateACKsCount++;
        }
        if (index === this.packets.length - 1 && this.duplicateACKsCount === 0) {
            this.startIndex += this.congestionWindow;
            if (this.congestionWindow >= this.bandwidth) { // drop the cwd to half when the bandwidth limit is hit
                this.updateSlowStartThreshold();
                this.congestionWindow = this.slowStartThreshold 
            } else { // duplicate otherwise
                this.windowIncrease(this.congestionWindow * 2);
            }
            this.packets.splice(0);
        } else if (index <= this.packets.length - 1 && this.duplicateACKsCount === 3) {
            this.startIndex = packet.dupIndex;
            this.on3Acks(packet.dupIndex);
        }
    }
    onSend() {
        super.onSend();
        if (this.congestionWindow > this.bandwidth) {
            this.congestionWindow = this.bandwidth;
        }
        const inflight = this.packets.length;
        if (inflight < this.congestionWindow) {
            if (inflight > 0) {
                if (this.packets[this.packets.length - 1].sentTime + 30 > Date.now()) { // delay between packets
                    return
                }
            }
            const packetX = (this.packets.length + this.startIndex) * (this.packetWidth + 4);
            const packet = new Packet(packetX, 2, false);
            this.packets.push(packet);
        }
    }
    onTimeout() {
        super.onTimeout();
        this.packets.splice(0);
        this.duplicateACKIndex = null;
        this.duplicateACKsCount = 0;
        this.updateSlowStartThreshold();
        this.congestionWindow = this.slowStartThreshold;
    }
    on3Acks(index) {
        super.on3Acks(index);
        this.packets.splice(0, index + 1);
        this.updateSlowStartThreshold();
        this.congestionWindow = this.slowStartThreshold + this.duplicateACKsCount;
        this.duplicateACKIndex = null;
        this.duplicateACKsCount = 0;
    }
    updateSlowStartThreshold() {
        super.updateSlowStartThreshold();
        this.slowStartThreshold = Math.floor(this.congestionWindow / 2);
        if (this.slowStartThreshold === 0) {
            this.slowStartThreshold++;
        }
        //For each duplicate ACK receive increase CWD by one. If the increase CWD is greater than the amount of data in the pipe then transmit a new segment else wait. If there are ‘w’ segments in the window and one is lost, the[sic] we will receive (w-1) duplicate ACK’s. 
    }
    customFields() {
        super.customFields()
        return null;
    }
    windowDecrease(decreaseValue) {
        super.windowDecrease(decreaseValue);
    }
    windowIncrease(increaseValue) {
        super.windowIncrease(increaseValue);
    }
    get getCwd() {
        super.getCwd();
    }
    update() {
        super.update();
    }
}
