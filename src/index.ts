import * as lgpio from "lgpio";

/**
 * Pin configuration for the ePaper display
 */
export interface EPD4in26Config {
  spiDevice?: string; // SPI device path, default: '/dev/spidev0.0'
  rstGPIO?: number; // Reset pin (BCM), default: 17
  dcGPIO?: number; // Data/Command pin (BCM), default: 25
  busyGPIO?: number; // Busy pin (BCM), default: 24
  powerGPIO?: number; // Power control pin (BCM), default: 18
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
  private rstGPIO: number;
  private dcGPIO: number;
  private busyGPIO: number;
  private powerGPIO: number;
  private chip: number; // Handle for GPIO chip
  private spiHandle: number; // Handle for SPI device
  private buffer: Buffer;

  constructor(config: EPD4in26Config = {}) {
    const { rstGPIO = 17, dcGPIO = 25, busyGPIO = 24, powerGPIO = 18 } = config;
    this.rstGPIO = rstGPIO;
    this.dcGPIO = dcGPIO;
    this.busyGPIO = busyGPIO;
    this.powerGPIO = powerGPIO;

    // Open GPIO chip
    this.chip = lgpio.gpiochipOpen(0); // Use GPIO chip 0

    // Open SPI device
    this.spiHandle = lgpio.spiOpen(0, 0, 256000); // SPI channel 0, chip select 0, speed 256 kHz

    // Initialize GPIO pins with lgpio
    lgpio.gpioClaimOutput(this.chip, this.rstGPIO, undefined, false);
    lgpio.gpioClaimOutput(this.chip, this.dcGPIO, undefined, false);
    lgpio.gpioClaimInput(this.chip, this.busyGPIO);
    lgpio.gpioClaimOutput(this.chip, this.powerGPIO, undefined, true); // Power pin HIGH

    // Initialize buffer
    this.buffer = Buffer.alloc((this.WIDTH / 8) * this.HEIGHT);
  }

  /**
   * Hardware reset
   */
  private async reset(): Promise<void> {
    lgpio.gpioWrite(this.chip, this.rstGPIO, true);
    await this.delay(20);
    lgpio.gpioWrite(this.chip, this.rstGPIO, false);
    await this.delay(2);
    lgpio.gpioWrite(this.chip, this.rstGPIO, true);
    await this.delay(20);
  }

  /**
   * Send command to the display
   */
  private sendCommand(command: number): void {
    lgpio.gpioWrite(this.chip, this.dcGPIO, false);
    const txBuffer = Buffer.from([command]);
    const rxBuffer = Buffer.alloc(1);
    lgpio.spiXfer(this.spiHandle, txBuffer, rxBuffer);
  }

  /**
   * Send data to the display
   */
  private sendData(data: number | Buffer): void {
    lgpio.gpioWrite(this.chip, this.dcGPIO, true); // Set DC pin to HIGH for data

    if (typeof data === "number") {
      // If data is a single byte, send it as a Uint8Array
      const txBuffer = new Uint8Array([data]);
      lgpio.spiWrite(this.spiHandle, txBuffer);
    } else {
      // If data is a Buffer, convert it to Uint8Array before sending
      const txBuffer = new Uint8Array(data);
      lgpio.spiWrite(this.spiHandle, txBuffer);

      // Split large buffers into smaller chunks
      const chunkSize = 48000;
      for (let i = 0; i < txBuffer.length; i += chunkSize) {
        const chunk = txBuffer.subarray(i, i + chunkSize);
        lgpio.spiWrite(this.spiHandle, chunk);
      }
    }
  }

  /**
   * Send raw bytes to the SPI interface in a single transaction
   * @param data Buffer containing the bytes to send
   */
  sendSPIBytes(data: Buffer): void {
    lgpio.gpioWrite(this.chip, this.dcGPIO, true); // Set DC pin to HIGH for data
    // Convert the Buffer to a Uint8Array for SPI transmission
    const txBuffer = new Uint8Array(data);

    // Send the entire buffer in a single SPI transaction
    lgpio.spiWrite(this.spiHandle, txBuffer);
  }

  /**
   * Wait until the busy pin is idle
   */
  private async epaperReady(): Promise<void> {
    let count = 0;
    while (lgpio.gpioRead(this.chip, this.busyGPIO) === true) {
      await this.delay(10);
      count++;
      if (count > 1000) {
        break;
      }
    }
    await this.delay(20);
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
    // if (lgpio.gpiochipOpen(4) !== 0) {
    //   throw new Error("Failed to initialize GPIO chip");
    // }

    await this.reset();
    await this.epaperReady();

    this.sendCommand(0x12); // SWRESET
    await this.epaperReady();

    this.sendCommand(0x18); // Use the internal temperature sensor
    this.sendData(0x80);

    this.sendCommand(0x0c); // Set soft start
    this.sendData(0xae);
    this.sendData(0xc7);
    this.sendData(0xc3);
    this.sendData(0xc0);
    this.sendData(0x80);

    this.sendCommand(0x01); // Driver output control
    this.sendData((this.HEIGHT - 1) & 0xff); // Y (low byte)
    this.sendData((this.HEIGHT - 1) >> 8); // Y (high byte)
    this.sendData(0x02);

    this.sendCommand(0x3c); // Border setting
    this.sendData(0x01);

    this.sendCommand(0x11); // Data entry mode
    this.sendData(0x01); // X-mode x+ y-

    this.setWindow(0, this.HEIGHT - 1, this.WIDTH - 1, 0);

    this.setCursor(0, 0);
    await this.epaperReady();
  }

  /**
   * Clear the display
   */
  async clear(): Promise<void> {
    // Fill the buffer with 0xFF (white)

    console.time("Buffer fill");
    this.buffer.fill(0xff);
    console.timeEnd("Buffer fill");

    // Write the buffer to memory area 0x24
    this.sendCommand(0x24);
    console.time("SPI Write Clear");
    this.sendSPIBytes(this.buffer);
    console.timeEnd("SPI Write Clear");

    // Write the buffer to memory area 0x26
    this.sendCommand(0x26);
    console.time("SPI Write Clear 2");
    this.sendSPIBytes(this.buffer);
    console.timeEnd("SPI Write Clear 2");

    // Turn on the display
    console.time("Turn On Display");
    await this.turnOnDisplay();
    console.timeEnd("Turn On Display");
  }

  /**
   * Display the buffer contents
   */
  async display(imageBuffer?: Buffer): Promise<void> {
    const buf = imageBuffer || this.buffer;

    this.sendCommand(0x24);
    this.sendSPIBytes(buf);
    await this.turnOnDisplay();
  }

  /**
   * Turn on display
   */
  private async turnOnDisplay(): Promise<void> {
    this.sendCommand(0x22);
    this.sendData(0xf7);
    this.sendCommand(0x20);
    await this.epaperReady();
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
    // Set all output pins to a safe state
    lgpio.gpioWrite(this.chip, this.powerGPIO, false); // Power off the display
    lgpio.gpiochipClose(this.chip); // Close GPIO chip
    lgpio.spiClose(this.spiHandle); // Close SPI
  }
  /**
   * Set the display window
   */
  setWindow(xStart: number, yStart: number, xEnd: number, yEnd: number): void {
    this.sendCommand(0x44); // Set RAM X address start/end position
    this.sendData(xStart & 0xff);
    this.sendData((xStart >> 8) & 0x03);
    this.sendData(xEnd & 0xff);
    this.sendData((xEnd >> 8) & 0x03);

    this.sendCommand(0x45); // Set RAM Y address start/end position
    this.sendData(yStart & 0xff);
    this.sendData((yStart >> 8) & 0xff);
    this.sendData(yEnd & 0xff);
    this.sendData((yEnd >> 8) & 0xff);
  }

  /**
   * Set the cursor position
   */
  setCursor(x: number, y: number): void {
    this.sendCommand(0x4e); // Set RAM X address counter
    this.sendData(x & 0xff);
    this.sendData((x >> 8) & 0x03);

    this.sendCommand(0x4f); // Set RAM Y address counter
    this.sendData(y & 0xff);
    this.sendData((y >> 8) & 0xff);
  }
}
