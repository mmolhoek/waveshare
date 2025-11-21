import * as lgpio from "lgpio";
import sharp from "sharp";
import * as fs from "fs";
import * as bmp from "bmp-js";

/**
 * Pin configuration for the waveshare 4.26 ePaper display (800x480) 1-bit black and white
 */
export interface EPDConfig {
  width?: number; // Display width, default: 800
  height?: number; // Display height, default: 480
  spiDevice?: string; // SPI device path, default: '/dev/spidev0.0'
  rstGPIO?: number; // Reset pin (BCM), default: 17
  dcGPIO?: number; // Data/Command pin (BCM), default: 25
  busyGPIO?: number; // Busy pin (BCM), default: 24
  powerGPIO?: number; // Power control pin (BCM), default: 18
  debug?: boolean; // Enable debug timing, default: false
}

/**
 * Main class for controlling the Waveshare 4.26" ePaper display
 */
export class EPD {
  private readonly WIDTH: number;
  private readonly HEIGHT: number;
  private rstGPIO: number;
  private dcGPIO: number;
  private busyGPIO: number;
  private powerGPIO: number;
  private debug: boolean;
  private chip: number; // Handle for GPIO chip
  private spiHandle: number; // Handle for SPI device
  private buffer: Buffer;

  constructor(config: EPDConfig = {}) {
    const {
      width = 800,
      height = 480,
      rstGPIO = 17,
      dcGPIO = 25,
      busyGPIO = 24,
      powerGPIO = 18,
      debug = false,
    } = config;
    this.WIDTH = width || 800;
    this.HEIGHT = height || 480;
    this.rstGPIO = rstGPIO;
    this.dcGPIO = dcGPIO;
    this.busyGPIO = busyGPIO;
    this.powerGPIO = powerGPIO;

    // Open GPIO chip
    this.debug = debug;
    this.chip = lgpio.gpiochipOpen(0); // Use GPIO chip 0

    // Open SPI device
    this.spiHandle = lgpio.spiOpen(0, 0, 256000); // SPI channel 0, chip select 0, speed 256 kHz

    // Initialize GPIO pins with lgpio
    lgpio.gpioClaimOutput(this.chip, this.rstGPIO, undefined, false);
    lgpio.gpioClaimOutput(this.chip, this.dcGPIO, undefined, false);
    lgpio.gpioClaimInput(this.chip, this.busyGPIO);
    lgpio.gpioClaimOutput(this.chip, this.powerGPIO, undefined, true); // Power pin HIGH

    // Initialize buffer
    if (this.debug)
      console.log(
        `epaper: Display (${this.WIDTH}, ${this.HEIGHT}), buffer size: ${(this.WIDTH / 8) * this.HEIGHT} bytes`,
      );
    this.buffer = Buffer.alloc((this.WIDTH / 8) * this.HEIGHT);
  }

  public get width(): number {
    return this.WIDTH;
  }

  public get height(): number {
    return this.HEIGHT;
  }

  /**
   * Hardware reset
   */
  private async reset(): Promise<void> {
    if (this.debug) console.time("epaper: reset");
    lgpio.gpioWrite(this.chip, this.rstGPIO, true);
    await this.delay(20);
    lgpio.gpioWrite(this.chip, this.rstGPIO, false);
    await this.delay(2);
    lgpio.gpioWrite(this.chip, this.rstGPIO, true);
    await this.delay(20);
    if (this.debug) console.timeEnd("epaper: reset");
  }

  /**
   * Send command to the display
   */
  private sendCommand(command: number): void {
    lgpio.gpioWrite(this.chip, this.dcGPIO, false);
    const txBuffer = Buffer.from([command]);
    // no need to read data back for now
    // const rxBuffer = Buffer.alloc(1);
    // lgpio.spiXfer(this.spiHandle, txBuffer, rxBuffer);
    lgpio.spiWrite(this.spiHandle, new Uint8Array(txBuffer));
  }

  /**
   * Send data to the display
   */
  private sendData(data: number | Buffer): void {
    if (this.debug && typeof data !== "number") console.time("sendData");
    lgpio.gpioWrite(this.chip, this.dcGPIO, true); // Set DC pin to HIGH for data

    if (typeof data === "number") {
      // If data is a single byte, send it as a Uint8Array
      const txBuffer = new Uint8Array([data]);
      lgpio.spiWrite(this.spiHandle, txBuffer);
    } else {
      // If data is a Buffer, convert it to Uint8Array before sending
      const txBuffer = new Uint8Array(data);
      lgpio.spiWrite(this.spiHandle, txBuffer);
    }
    if (this.debug && typeof data !== "number") console.timeEnd("sendData");
  }

  /**
   * Wait until the busy pin is idle
   */
  private async epaperReady(): Promise<void> {
    let count = 0;
    if (this.debug) console.time("epaper: epaperReady");
    while (lgpio.gpioRead(this.chip, this.busyGPIO) === true) {
      await this.delay(5);
      count++;
      if (count > 1000) {
        break;
      }
    }
    if (this.debug) console.timeEnd("epaper: epaperReady");
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

    if (this.debug) console.time("epaper: init");
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
    if (this.debug) console.timeEnd("epaper: init");
  }

  /**
   * Clear the display
   */
  async clear(fast: boolean = true): Promise<void> {
    if (this.debug) console.time("epaper: clear");
    if (this.debug) console.time("epaper: clear: Buffer fill");
    // Fill the buffer with 0xFF (white)
    this.buffer.fill(0xff);
    if (this.debug) console.timeEnd("epaper: clear: Buffer fill");

    if (this.debug) console.time("epaper: clear: Sending data");
    // Write the buffer to memory area 0x24
    this.sendCommand(0x24);
    console.log("SPI Write Clear 1");
    this.sendData(this.buffer);
    if (this.debug) console.timeEnd("epaper: clear: Sending data");

    // // Write the buffer to memory area 0x26 (optional second memory area for color displays)
    // this.sendCommand(0x26);
    // console.time("SPI Write Clear 2");
    // this.sendData(this.buffer);
    // console.timeEnd("SPI Write Clear 2");
    //
    // Turn on the display
    if (this.debug) console.time("epaper: clear: Turn on display");
    await this.turnOnDisplay(fast);
    if (this.debug) console.timeEnd("epaper: clear: Turn on display");
    if (this.debug) console.timeEnd("epaper: clear");
  }

  /**
   * Display the buffer contents
   */
  async display(imageBuffer?: Buffer): Promise<void> {
    if (this.debug) console.time("epaper: display");
    const buf = imageBuffer || this.buffer;

    this.sendCommand(0x24);
    this.sendData(buf);
    await this.turnOnDisplay();
    if (this.debug) console.timeEnd("epaper: display");
  }

  /**
   * Turn on display
   */
  private async turnOnDisplay(fast: boolean = true): Promise<void> {
    if (this.debug) console.time("epaper: turnOnDisplay");
    this.sendCommand(0x22);
    this.sendData(fast ? 0xff : 0xf7);
    this.sendCommand(0x20);
    await this.epaperReady();
    if (this.debug) console.timeEnd("epaper: turnOnDisplay");
  }

  /**
   * Enter deep sleep mode
   */
  async sleep(): Promise<void> {
    if (this.debug) console.time("epaper: sleep");
    this.sendCommand(0x10); // deep sleep
    this.sendData(0x01);
    await this.delay(100);
    if (this.debug) console.timeEnd("epaper: sleep");
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
   * Load image from BMP file
   * @param path Path to the BMP file
   */
  async loadImageInBuffer(path: string): Promise<Buffer> {
    // Load the BMP file using sharp
    const bmpBuffer = fs.readFileSync(path);
    let bitmap;
    try {
      bitmap = bmp.decode(bmpBuffer);
    } catch (error) {
      console.log(
        "epaper: Image is not in BMP format, converting using sharp...",
      );
      try {
        await sharp(bmpBuffer)
          .raw()
          .toBuffer()
          .then((data) => {
            console.log("epaper: Image loaded, converting to BMP format...");
            bitmap = bmp.encode({
              data: data,
              width: this.WIDTH,
              height: this.HEIGHT,
            });
            bitmap = bmp.decode(bitmap.data);
            console.log("epaper: Image converted to BMP!");
          })
          .catch((err) => {
            console.error("epaper: Error:", err);
          });
      } catch (err) {
        console.error("epaper: Failed to convert image to BMP format:", err);
      }
    }
    if (!bitmap) {
      throw new Error("Failed to load image");
    }

    // Determine the scaling factor if the image is larger than the display
    const scaleFactor = Math.min(
      this.WIDTH / bitmap.width,
      this.HEIGHT / bitmap.height,
      1, // Ensure we don't upscale smaller images
    );

    const targetWidth = Math.floor(bitmap.width * scaleFactor);
    const targetHeight = Math.floor(bitmap.height * scaleFactor);

    // Resize and process the image using sharp
    const packedBytesBuffer = await sharp(bitmap.data, {
      raw: {
        width: bitmap.width,
        height: bitmap.height,
        channels: 4, // Assuming bmp-js output is RGBA
      },
    })
      .resize(targetWidth, targetHeight) // Resize the image if necessary
      .greyscale() // Convert to 8-bit grayscale
      .threshold(128) // Apply a threshold to make it purely black and white
      .toColourspace("b-w") // Explicitly set the 1-bit colorspace
      .raw() // Request raw output bytes
      .toBuffer(); // Get the final buffer

    const buf = Buffer.alloc((this.WIDTH / 8) * this.HEIGHT, 0xff); // Start with all white pixels

    // Calculate offsets for centering the image
    const xOffset = Math.max(0, Math.floor((this.WIDTH - targetWidth) / 2));
    const yOffset = Math.max(0, Math.floor((this.HEIGHT - targetHeight) / 2));

    // Process the raw pixel data and copy it into the display buffer
    for (let y = 0; y < targetHeight; y++) {
      for (let x = 0; x < targetWidth; x++) {
        const pixelIndex = y * targetWidth + x; // Index in the raw pixel data
        const byteIndex = Math.floor(
          (x + xOffset + (y + yOffset) * this.WIDTH) / 8,
        ); // Byte index in the buffer
        const bitIndex = 7 - ((x + xOffset) % 8); // Bit index within the byte

        // Check if the pixel is black (value 0)
        if (packedBytesBuffer[pixelIndex] === 0) {
          buf[byteIndex] &= ~(1 << bitIndex); // Set the bit to 0 for black
        }
      }
    }

    return buf;
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
