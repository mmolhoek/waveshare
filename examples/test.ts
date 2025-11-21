// Example usage of the Waveshare ePaper display library

import { EPD } from "../src/index";

async function main() {
  // Initialize the display with default pins
  // and default width and height for a 4.26-inch display (800x480)
  const epd = new EPD({
    debug: true, // Enable debug mode for verbose logging
  });

  try {
    // Initialize the display
    await epd.init();

    // Example 1: Clear the display
    await epd.clear(false);

    // Example 2: Draw some shapes
    epd.clearBuffer();
    //
    epd.fillRect(50, 50, epd.width - 100, epd.height - 100, 1);
    epd.fillRect(100, 100, epd.width - 200, epd.height - 200, 0);
    epd.drawRect(150, 150, epd.width - 300, epd.height - 300, 1);
    //
    // // Display the buffer
    await epd.display();
    // await delay(2000);
    let image = await epd.loadImageInBuffer("./examples/large.bmp");
    await epd.display(image);
    // await delay(2000);
    image = await epd.loadImageInBuffer("./examples/1bit.bmp");
    await epd.display(image);
    // await delay(2000);
    image = await epd.loadImageInBuffer("./examples/4in26_Scale.bmp");
    await epd.display(image);
    // await delay(2000);
    image = await epd.loadImageInBuffer("./examples/7in5_V2.bmp");
    await epd.display(image);
    // await delay(2000);
    await epd.sleep();
  } catch (error) {
    console.error("Error:", error);
  } finally {
    // Clean up GPIO resources
    epd.cleanup();
  }
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Run the example
main().catch(console.error);
