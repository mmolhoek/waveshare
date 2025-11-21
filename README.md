# Waveshare 4.26" ePaper Display - TypeScript Library

A TypeScript library for controlling the Waveshare 4.26 inch ePaper display (800x480) on Raspberry Pi via SPI interface.

## Features

- SPI communication with the ePaper display
- GPIO control for display management
- Buffer-based drawing operations
- Basic graphics primitives (lines, rectangles)
- Sending of 1-bit bmp images to the display
- Compatible with Raspberry Pi 5 (and earlier models)

## Hardware Requirements

- Raspberry Pi (tested on Pi 5, compatible with Pi 3/4, including Zero i theoretically)
- Waveshare 4.26 inch ePaper display (800x480) HAT or any other compatible model of Waveshare.
- SPI connection enabled on Raspberry Pi

## Installation instructions on the Raspberry Pi

1. Enable SPI on your Raspberry Pi:

```bash
sudo raspi-config
# Navigate to: Interface Options -> SPI -> Enable
# Reboot
sudo reboot
# Install gpiod for GPIO control
sudo apt update
sudo apt install gpiod
# check the gpio chip number,probably 0, do you see gpio pins?
gpioinfo -c0
# Edit /boot/firmware/config.txt and add
spidev.bufsiz=48000
# This will allow us to write a full image to the display buffer in one go
# as 800x480/8=48000 bytes. Divided by 8 because each byte holds 8 pixels (1 bit per pixel)
# if you have a different display size, adjust accordingly.
# if you get : Error writing to SPI device: spi xfer/read/write failed, you miscalculated the buffer size and set it too small.
```

2. Install Node:

```bash
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.3/install.sh | bash
# restart terminal or source ~/.bashrc
nvm install 22
```

3. Clone the project:

```bash
git clone https://github.com/mmolhoek/waveshare.git
cd waveshare
```

4. Install dependencies:

```bash
npm install
```

## Usage

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

- Check all pin connections. see the [layout](https://www.waveshare.com/wiki/4.26inch_e-Paper_HAT_Manual#Hardware_Connection) on the waveshare wiki.

## Notes

- The ePaper display retains its image even when powered off.
- Deep sleep mode significantly reduces power consumption.
- Always call `cleanup()` when done to properly release GPIO resources.

## References

- [Waveshare 4.26" ePaper HAT Manual](https://www.waveshare.com/wiki/4.26inch_e-Paper_HAT_Manual)
- [Waveshare GitHub Repository](https://github.com/waveshare/e-Paper)

## License

MIT

## Publishing to npm (for maintainers)

To publish this package to npm, follow these steps:

1. Make sure you are logged in to npm:

```bash
npm login
```

2 Build the project:

```bash
npm run build
```

3 Publish the package:

```bash
npm run publish:npm
```

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.
