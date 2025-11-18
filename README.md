# Waveshare 4.26" ePaper Display - TypeScript Library

A TypeScript library for controlling the Waveshare 4.26 inch ePaper display (800x480) on Raspberry Pi via SPI interface.

## Features

- Full TypeScript support with type definitions
- SPI communication with the ePaper display
- GPIO control for display management
- Buffer-based drawing operations
- Basic graphics primitives (lines, rectangles)
- Display initialization and sleep mode
- Compatible with Raspberry Pi 5 (and earlier models)

## Hardware Requirements

- Raspberry Pi (tested on Pi 5, compatible with Pi 3/4)
- Waveshare 4.26 inch ePaper display
- SPI connection enabled on Raspberry Pi

## Pin Connections

Default pin configuration (BCM numbering):

| Function | BCM Pin | Physical Pin          |
| -------- | ------- | --------------------- |
| RST      | 17      | 11                    |
| DC       | 25      | 22                    |
| CS       | 8       | 24                    |
| BUSY     | 24      | 18                    |
| SCLK     | 11      | 23                    |
| MOSI     | 10      | 19                    |
| GND      | GND     | 6/9/14/20/25/30/34/39 |
| VCC      | 3.3V    | 1/17                  |

## Installation

1. Enable SPI on your Raspberry Pi:

```bash
sudo raspi-config
# Navigate to: Interface Options -> SPI -> Enable
```

2. Install Node.js (if not already installed):

```bash
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs
```

3. Clone or create the project:

```bash
mkdir waveshare-epd-ts
cd waveshare-epd-ts
```

4. Install dependencies:

```bash
npm install
```

## Usage

### Basic Example

```typescript
import { EPD4in26 } from "./waveshare-epd4in26";

async function main() {
  const epd = new EPD4in26();

  try {
    // Initialize the display
    await epd.init();

    // Clear the display
    await epd.clear();

    // Draw on the buffer
    epd.clearBuffer();
    epd.fillRect(100, 100, 200, 150, 1);
    epd.drawRect(0, 0, 800, 480, 1);

    // Display the buffer
    await epd.display();

    // Enter sleep mode
    await epd.sleep();
  } finally {
    epd.cleanup();
  }
}

main().catch(console.error);
```

### Custom Pin Configuration

```typescript
const epd = new EPD4in26({
  rstPin: 17,
  dcPin: 25,
  csPin: 8,
  busyPin: 24,
  spiSpeedHz: 4000000,
});
```

## API Reference

### EPD4in26 Class

#### Constructor

```typescript
constructor(config?: EPD4in26Config)
```

Creates a new instance with optional pin configuration.

#### Methods

##### `async init(): Promise<void>`

Initializes the ePaper display. Must be called before any other operations.

##### `async clear(): Promise<void>`

Clears the entire display to white.

##### `async display(imageBuffer?: Buffer): Promise<void>`

Displays the internal buffer or a provided buffer on the screen.

##### `async sleep(): Promise<void>`

Puts the display into deep sleep mode to save power.

##### `clearBuffer(): void`

Clears the internal buffer (sets all pixels to white).

##### `fillBuffer(color: number): void`

Fills the entire buffer with the specified color (0 = white, 1 = black).

##### `setPixel(x: number, y: number, color: number): void`

Sets a single pixel in the buffer.

##### `drawHLine(x: number, y: number, width: number, color: number): void`

Draws a horizontal line.

##### `drawVLine(x: number, y: number, height: number, color: number): void`

Draws a vertical line.

##### `drawRect(x: number, y: number, width: number, height: number, color: number): void`

Draws a rectangle outline.

##### `fillRect(x: number, y: number, width: number, height: number, color: number): void`

Draws a filled rectangle.

##### `loadImage(imageBuffer: Buffer): void`

Loads an image from a buffer. Buffer must be (800/8) \* 480 = 48000 bytes.

##### `getBuffer(): Buffer`

Returns the internal display buffer.

##### `cleanup(): void`

Releases GPIO resources. Should be called when done using the display.

## Display Specifications

- Resolution: 800 x 480 pixels
- Colors: Black and White (1-bit)
- Interface: SPI
- Refresh time: ~4-5 seconds (full refresh)
- Power consumption: ~0.1mW (sleep mode)

## Buffer Format

The display buffer uses 1 bit per pixel, packed into bytes:

- Buffer size: (800 / 8) \* 480 = 48,000 bytes
- Color: 0 = White, 1 = Black
- Bit order: MSB first
- Byte order: Row-major (left to right, top to bottom)

## Building

```bash
npm run build
```

## Running Examples

```bash
npm run example
```

## Troubleshooting

### SPI not available

Make sure SPI is enabled:

```bash
ls /dev/spi*
```

You should see `/dev/spidev0.0` and `/dev/spidev0.1`.

### Permission denied

Run with sudo or add user to spi and gpio groups:

```bash
sudo usermod -a -G spi,gpio $USER
```

Then log out and back in.

### Display not responding

- Check all pin connections
- Verify the display is receiving power (3.3V)
- Try resetting the Raspberry Pi
- Check that the BUSY pin is properly connected

## Notes

- The display has a limited refresh rate. Avoid frequent full refreshes.
- The ePaper display retains its image even when powered off.
- Deep sleep mode significantly reduces power consumption.
- Always call `cleanup()` when done to properly release GPIO resources.

## References

- [Waveshare 4.26" ePaper HAT Manual](https://www.waveshare.com/wiki/4.26inch_e-Paper_HAT_Manual)
- [Waveshare GitHub Repository](https://github.com/waveshare/e-Paper)
- [onoff GPIO Library](https://github.com/fivdi/onoff)
- [spi-device Library](https://github.com/fivdi/spi-device)

## License

MIT

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.
