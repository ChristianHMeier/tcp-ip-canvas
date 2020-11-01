import CongestionControl from './congestion-control.js';
import Packet from '../packet.js';

export default class Cubic extends CongestionControl {
    constructor(endToEnd, timeout, bandwidth, draw) {
        super(endToEnd, timeout, bandwidth, draw);

        this.aggresivenessConstant = 0.4; //C in the original algorithm, value recommended by RFC 8312
        this.decreaseConstant = 0.7; //ß in the original algorithm, value recommended by RFC 8312
        this.windowMax = 0; //Based on the start value found in both tcp_bic.c and tcp_cubic.c in the Linux kernel
        this.lastTime = Date.now();
    }
    onACK(packet, index) {
        super.onACK(packet);
        if (packet.dupIndex !== null) {
            this.duplicateACKIndex = this.duplicateACKIndex !== null ? this.duplicateACKIndex : packet.dupIndex; 
            this.duplicateACKsCount++;
        } 
        if (index === this.packets.length - 1 && this.duplicateACKsCount === 0) {
            this.startIndex += this.congestionWindow;
            if (this.congestionWindow < this.bandwidth) {
                const k = Math.cbrt(this.windowMax * (1 - this.decreaseConstant) / this.aggresivenessConstant);
                const t = (Date.now() - this.lastTime) / 1000; // time elapsed since the last congestion in seconds
                const increaseValue = this.windowMax === 0 ? 1 : Math.floor(this.aggresivenessConstant * Math.pow((t - k), 3)) + this.windowMax;
                this.windowIncrease((this.congestionWindow + increaseValue));
            } else { 
                this.updateSlowStartThreshold();
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
    }
    on3Acks(index) {
        super.on3Acks(index);
        this.packets.splice(0, index + 1);
        this.updateSlowStartThreshold();
        this.duplicateACKIndex = null;
        this.duplicateACKsCount = 0;
    }
    updateSlowStartThreshold() {
        super.updateSlowStartThreshold();
        this.lastTime = Date.now();
        if (this.congestionWindow < this.windowMax) {// fast convergence
            this.windowMax = Math.floor(this.congestionWindow * (2 - this.decreaseConstant) / 2);
            if (this.windowMax === 0) {
                this.windowMax++;
            }
        }
        else {// multiplicative decrease
            this.windowMax = this.congestionWindow;
            this.congestionWindow = Math.floor(this.congestionWindow * (1 - this.decreaseConstant));
            if (this.congestionWindow === 0) {
                this.congestionWindow++;
            }
        }
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
    update() {
        super.update();
    }
}
