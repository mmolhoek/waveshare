import { SpiDevice, openSync as spiOpenSync } from "spi-device";
import { Gpio } from "onoff";

/**
 * Pin configuration for the ePaper display
 */
export interface EPD4in26Config {
  spiDevice?: string; // SPI device path, default: '/dev/spidev0.0'
  spiSpeedHz?: number; // SPI speed in Hz, default: 4000000
  rstPin?: number; // Reset pin (BCM), default: 17
  dcPin?: number; // Data/Command pin (BCM), default: 25
  csPin?: number; // Chip Select pin (BCM), default: 8
  busyPin?: number; // Busy pin (BCM), default: 24
  powerPin?: number; // Power control pin (BCM), default: 18
}

/**
 * Display specifications for 4.26" ePaper
 */
export const EPD_WIDTH = 800;
export const EPD_HEIGHT = 480;

/**
 * Main class for controlling the Waveshare 4.26" ePaper display
 */
export class EPD4in26 {
  private readonly WIDTH = EPD_WIDTH;
  private readonly HEIGHT = EPD_HEIGHT;

  private spi: SpiDevice;
  private rst: Gpio;
  private dc: Gpio;
  private cs: Gpio;
  private busy: Gpio;
  private power: Gpio;
  private buffer: Buffer;

  constructor(config: EPD4in26Config = {}) {
    const {
      spiSpeedHz = 4000000,
      rstPin = 17,
      dcPin = 25,
      csPin = 8,
      busyPin = 24,
      powerPin = 18,
    } = config;

    // Initialize SPI
    this.spi = spiOpenSync(0, 0, {
      mode: 0,
      maxSpeedHz: spiSpeedHz,
      bitsPerWord: 8,
    });

    // Initialize GPIO pins with debug logs
    console.log("Initializing GPIO pins...");
    try {
      this.power = new Gpio(powerPin, "out");
      this.power.writeSync(1); // Power on the display
      console.log("Power pin initialized and set to HIGH");
      this.rst = new Gpio(rstPin, "out");
      console.log("RST pin initialized");
      this.dc = new Gpio(dcPin, "out");
      console.log("DC pin initialized");
      this.cs = new Gpio(csPin, "out");
      console.log("CS pin initialized");
      this.busy = new Gpio(busyPin, "in");
      console.log("Busy pin initialized");
    } catch (error) {
      console.error(
        `Error initializing GPIO pins: ${(error as Error).message}`,
      );
      throw error;
    }

    // Initialize buffer
    this.buffer = Buffer.alloc((this.WIDTH / 8) * this.HEIGHT);
  }

  /**
   * Hardware reset
   */
  private async reset(): Promise<void> {
    this.rst.writeSync(1);
    await this.delay(20);
    this.rst.writeSync(0);
    await this.delay(2);
    this.rst.writeSync(1);
    await this.delay(20);
  }

  /**
   * Send command to the display
   */
  private sendCommand(command: number): void {
    this.dc.writeSync(0);
    this.cs.writeSync(0);
    this.spi.transferSync([
      { sendBuffer: Buffer.from([command]), byteLength: 1 },
    ]);
    this.cs.writeSync(1);
  }

  /**
   * Send data to the display
   */
  private sendData(data: number | Buffer): void {
    this.dc.writeSync(1);
    this.cs.writeSync(0);

    if (typeof data === "number") {
      this.spi.transferSync([
        { sendBuffer: Buffer.from([data]), byteLength: 1 },
      ]);
    } else {
      this.spi.transferSync([{ sendBuffer: data, byteLength: data.length }]);
    }

    this.cs.writeSync(1);
  }

  /**
   * Wait until the busy pin is idle
   */
  private async readBusy(): Promise<void> {
    console.log("e-Paper busy");
    let count = 0;
    while (this.busy.readSync() === 0) {
      await this.delay(10);
      count++;
      if (count > 1000) {
        console.log("Busy timeout!");
        break;
      }
    }
    await this.delay(20);
    console.log("e-Paper busy release");
  }

  /**
   * Utility delay function
   */
  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Initialize the ePaper display
   */
  async init(): Promise<void> {
    await this.reset();

    await this.readBusy();
    this.sendCommand(0x12); // SWRESET
    await this.readBusy();

    this.sendCommand(0x01); // Driver output control
    this.sendData(0xdf);
    this.sendData(0x01);
    this.sendData(0x00);

    this.sendCommand(0x11); // data entry mode
    this.sendData(0x03);

    this.sendCommand(0x44); // set Ram-X address start/end position
    this.sendData(0x00);
    this.sendData(0x31); // 0x31-->(49+1)*8=400

    this.sendCommand(0x45); // set Ram-Y address start/end position
    this.sendData(0xdf); // 0xDF-->(223+1)=224
    this.sendData(0x01);
    this.sendData(0x00);
    this.sendData(0x00);

    this.sendCommand(0x3c); // BorderWavefrom
    this.sendData(0x01);

    this.sendCommand(0x18); // Read built-in temperature sensor
    this.sendData(0x80);

    this.sendCommand(0x22); // Load Temperature and waveform setting.
    this.sendData(0xb1);
    this.sendCommand(0x20);
    await this.readBusy();

    this.sendCommand(0x4e); // set RAM x address count to 0
    this.sendData(0x00);
    this.sendCommand(0x4f); // set RAM y address count to 0
    this.sendData(0xdf);
    this.sendData(0x01);
    await this.readBusy();

    console.log("EPD initialized");
  }

  /**
   * Clear the display
   */
  async clear(): Promise<void> {
    this.sendCommand(0x24);
    for (let i = 0; i < (this.WIDTH / 8) * this.HEIGHT; i++) {
      this.sendData(0xff);
    }
    await this.turnOnDisplay();
  }

  /**
   * Display the buffer contents
   */
  async display(imageBuffer?: Buffer): Promise<void> {
    const buf = imageBuffer || this.buffer;

    this.sendCommand(0x24);
    this.sendData(buf);
    await this.turnOnDisplay();
  }

  /**
   * Turn on display
   */
  private async turnOnDisplay(): Promise<void> {
    this.sendCommand(0x22);
    this.sendData(0xf7);
    this.sendCommand(0x20);
    await this.readBusy();
  }

  /**
   * Enter deep sleep mode
   */
  async sleep(): Promise<void> {
    this.sendCommand(0x10); // deep sleep
    this.sendData(0x01);
    await this.delay(100);
  }

  /**
   * Get the internal buffer
   */
  getBuffer(): Buffer {
    return this.buffer;
  }

  /**
   * Set a pixel in the buffer
   * @param x X coordinate
   * @param y Y coordinate
   * @param color 0 for white, 1 for black
   */
  setPixel(x: number, y: number, color: number): void {
    if (x < 0 || x >= this.WIDTH || y < 0 || y >= this.HEIGHT) {
      return;
    }

    const byteIndex = (x + y * this.WIDTH) >> 3;
    const bitIndex = 7 - (x & 7);

    if (color === 0) {
      this.buffer[byteIndex] |= 1 << bitIndex;
    } else {
      this.buffer[byteIndex] &= ~(1 << bitIndex);
    }
  }

  /**
   * Draw a horizontal line
   */
  drawHLine(x: number, y: number, width: number, color: number): void {
    for (let i = 0; i < width; i++) {
      this.setPixel(x + i, y, color);
    }
  }

  /**
   * Draw a vertical line
   */
  drawVLine(x: number, y: number, height: number, color: number): void {
    for (let i = 0; i < height; i++) {
      this.setPixel(x, y + i, color);
    }
  }

  /**
   * Draw a rectangle
   */
  drawRect(
    x: number,
    y: number,
    width: number,
    height: number,
    color: number,
  ): void {
    this.drawHLine(x, y, width, color);
    this.drawHLine(x, y + height - 1, width, color);
    this.drawVLine(x, y, height, color);
    this.drawVLine(x + width - 1, y, height, color);
  }

  /**
   * Fill a rectangle
   */
  fillRect(
    x: number,
    y: number,
    width: number,
    height: number,
    color: number,
  ): void {
    for (let i = 0; i < height; i++) {
      this.drawHLine(x, y + i, width, color);
    }
  }

  /**
   * Clear the buffer (set all pixels to white)
   */
  clearBuffer(): void {
    this.buffer.fill(0xff);
  }

  /**
   * Fill the buffer with a color
   */
  fillBuffer(color: number): void {
    this.buffer.fill(color === 0 ? 0xff : 0x00);
  }

  /**
   * Load image from buffer
   * Buffer should be in the format: 1 bit per pixel, packed
   */
  loadImage(imageBuffer: Buffer): void {
    if (imageBuffer.length === this.buffer.length) {
      imageBuffer.copy(this.buffer);
    } else {
      console.error("Image buffer size mismatch");
    }
  }

  /**
   * Clean up resources
   */
  cleanup(): void {
    this.rst.unexport();
    this.dc.unexport();
    this.cs.unexport();
    this.busy.unexport();
    this.power.writeSync(0); // Power off the display
    this.power.unexport();
    console.log("EPD resources cleaned up");
  }
}
